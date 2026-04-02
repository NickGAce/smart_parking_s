import re
from datetime import datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.booking import Booking, BookingStatus
from app.models.parking_spot import ParkingSpot, SpotStatus

_FIXED_OFFSET_PATTERN = re.compile(r"^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$")

TRANSITIONABLE_BOOKING_STATUSES = {
    BookingStatus.pending,
    BookingStatus.confirmed,
    BookingStatus.active,
}

BOOKING_BLOCKING_STATUSES = (
    BookingStatus.pending,
    BookingStatus.confirmed,
    BookingStatus.active,
)

ALLOWED_BOOKING_TRANSITIONS: dict[BookingStatus, set[BookingStatus]] = {
    BookingStatus.pending: {BookingStatus.confirmed, BookingStatus.cancelled, BookingStatus.expired},
    BookingStatus.confirmed: {
        BookingStatus.active,
        BookingStatus.completed,
        BookingStatus.cancelled,
        BookingStatus.expired,
        BookingStatus.no_show,
    },
    BookingStatus.active: {BookingStatus.completed, BookingStatus.cancelled},
    BookingStatus.completed: set(),
    BookingStatus.cancelled: set(),
    BookingStatus.expired: set(),
    BookingStatus.no_show: set(),
}


def _parse_fixed_offset_timezone(value: str) -> tzinfo | None:
    normalized = value.strip()
    if normalized.upper() in {"UTC", "GMT", "Z"}:
        return timezone.utc

    match = _FIXED_OFFSET_PATTERN.match(normalized)
    if not match:
        return None

    sign, hours_str, minutes_str = match.groups()
    hours = int(hours_str)
    minutes = int(minutes_str or 0)
    if hours > 14 or minutes > 59:
        return None

    delta = timedelta(hours=hours, minutes=minutes)
    if sign == "-":
        delta = -delta
    return timezone(delta)


def _resolve_timezone(client_timezone: str | None) -> tzinfo:
    tz_name = client_timezone or settings.default_timezone
    fixed_offset_tz = _parse_fixed_offset_timezone(tz_name)
    if fixed_offset_tz is not None:
        return fixed_offset_tz

    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError as exc:
        if client_timezone:
            raise HTTPException(status_code=400, detail="Invalid X-Timezone header") from exc

        # Keep API usable even with bad server config and preserve business rule: work in MSK.
        try:
            return ZoneInfo("Europe/Moscow")
        except ZoneInfoNotFoundError:
            return timezone(timedelta(hours=3))


def to_db_datetime(dt: datetime) -> datetime:
    """Normalize datetimes for TIMESTAMP WITHOUT TIME ZONE columns (UTC naive)."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def normalize_client_datetime(dt: datetime, client_timezone: str | None) -> datetime:
    """Convert browser/client datetime to UTC naive for DB operations."""
    if dt.tzinfo is not None:
        # Compatibility mode for clients that send local wall-clock time with trailing `Z`.
        # Reinterpret UTC-aware value as local wall time in request/default timezone.
        if dt.utcoffset() == timezone.utc.utcoffset(None):
            tz = _resolve_timezone(client_timezone)
            local_wall_time = dt.replace(tzinfo=None)
            return local_wall_time.replace(tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
        return to_db_datetime(dt)

    tz = _resolve_timezone(client_timezone)
    return dt.replace(tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)


def resolve_client_now(
    client_time: str | None,
    client_timezone: str | None,
) -> datetime:
    """Resolve 'now' from device/browser time and normalize to UTC naive."""
    if not client_time:
        return to_db_datetime(datetime.now(timezone.utc))

    try:
        parsed = datetime.fromisoformat(client_time)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid X-Device-Time header") from exc

    return normalize_client_datetime(parsed, client_timezone)


def server_now_utc_naive() -> datetime:
    """Return current server timestamp in UTC naive form used by DB/business logic."""
    return to_db_datetime(datetime.now(timezone.utc))


def to_client_datetime(dt: datetime, client_timezone: str | None) -> datetime:
    """Convert DB UTC-naive datetime to client timezone-aware datetime for API output."""
    utc_aware = dt.replace(tzinfo=timezone.utc)
    tz = _resolve_timezone(client_timezone)
    return utc_aware.astimezone(tz)


def can_transition_booking_status(current: BookingStatus, target: BookingStatus) -> bool:
    if current == target:
        return True
    return target in ALLOWED_BOOKING_TRANSITIONS[current]


def transition_booking_status(booking: Booking, target: BookingStatus) -> None:
    if not can_transition_booking_status(booking.status, target):
        raise HTTPException(
            status_code=409,
            detail=f"Invalid status transition: {booking.status.value} -> {target.value}",
        )
    booking.status = target


def derive_initial_booking_status(start_time: datetime, end_time: datetime, now: datetime) -> BookingStatus:
    if end_time <= now:
        return BookingStatus.expired
    if start_time <= now < end_time:
        return BookingStatus.active
    return BookingStatus.confirmed


async def sync_booking_statuses(
    session: AsyncSession,
    now: datetime | None = None,
) -> int:
    """Apply server-driven booking lifecycle transitions based on current time."""
    current = to_db_datetime(now or datetime.now(timezone.utc))
    updates_total = 0

    completed_result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.active)
        .where(Booking.end_time <= current)
        .values(status=BookingStatus.completed)
    )
    updates_total += completed_result.rowcount or 0

    active_result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.confirmed)
        .where(Booking.start_time <= current)
        .where(Booking.end_time > current)
        .values(status=BookingStatus.active)
    )
    updates_total += active_result.rowcount or 0

    no_show_result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.confirmed)
        .where(Booking.end_time <= current)
        .values(status=BookingStatus.no_show)
    )
    updates_total += no_show_result.rowcount or 0

    expired_result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.pending)
        .where(Booking.start_time <= current)
        .values(status=BookingStatus.expired)
    )
    updates_total += expired_result.rowcount or 0

    return updates_total


async def sync_parking_spot_statuses(
    session: AsyncSession,
    spot_ids: list[int] | None = None,
    now: datetime | None = None,
) -> None:
    """Sync persisted parking spot status based on blocking bookings.

    blocked spots are not changed.
    """
    current = to_db_datetime(now or datetime.now(timezone.utc))
    booked_spots_subquery = select(Booking.parking_spot_id).where(Booking.status.in_(BOOKING_BLOCKING_STATUSES))
    booked_spots_subquery = booked_spots_subquery.where(Booking.end_time > current)
    if spot_ids:
        booked_spots_subquery = booked_spots_subquery.where(Booking.parking_spot_id.in_(spot_ids))
    booked_spots_subquery = booked_spots_subquery.distinct()

    available_stmt = (
        update(ParkingSpot)
        .where(ParkingSpot.status != SpotStatus.blocked)
        .values(status=SpotStatus.available)
    )
    if spot_ids:
        available_stmt = available_stmt.where(ParkingSpot.id.in_(spot_ids))
    await session.execute(available_stmt)

    booked_stmt = (
        update(ParkingSpot)
        .where(ParkingSpot.status != SpotStatus.blocked)
        .where(ParkingSpot.id.in_(booked_spots_subquery))
        .values(status=SpotStatus.booked)
    )
    if spot_ids:
        booked_stmt = booked_stmt.where(ParkingSpot.id.in_(spot_ids))
    await session.execute(booked_stmt)
