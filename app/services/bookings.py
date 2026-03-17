import re
from datetime import datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.core.config import settings

_FIXED_OFFSET_PATTERN = re.compile(r"^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$", re.IGNORECASE)


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


def to_client_datetime(dt: datetime, client_timezone: str | None) -> datetime:
    """Convert DB UTC-naive datetime to client timezone-aware datetime for API output."""
    utc_aware = dt.replace(tzinfo=timezone.utc)
    tz = _resolve_timezone(client_timezone)
    return utc_aware.astimezone(tz)


async def sync_booking_statuses(
    session: AsyncSession,
    now: datetime | None = None,
) -> int:
    """Mark ended active bookings as completed."""
    current = to_db_datetime(now or datetime.now(timezone.utc))
    result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.active)
        .where(Booking.end_time <= current)
        .values(status=BookingStatus.completed)
    )
    await session.commit()
    return result.rowcount or 0


async def sync_parking_spot_statuses(
    session: AsyncSession,
    spot_ids: list[int] | None = None,
    now: datetime | None = None,
) -> None:
    """Sync persisted parking spot status based on active bookings.

    blocked spots are not changed.
    """
    current = to_db_datetime(now or datetime.now(timezone.utc))
    booked_spots_subquery = select(Booking.parking_spot_id).where(Booking.status == BookingStatus.active)
    booked_spots_subquery = booked_spots_subquery.where(Booking.start_time <= current)
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
