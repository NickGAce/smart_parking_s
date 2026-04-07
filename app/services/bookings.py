import re
from datetime import datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException


from app.core.config import settings
from app.models.booking import Booking, BookingStatus
from app.models.user import User, UserRole

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


CHECKIN_ALLOWED_ROLES = {UserRole.admin, UserRole.guard}


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
    """Normalize datetimes for TIMESTAMP WITHOUT TIME ZONE columns (local wall-clock naive)."""
    if dt.tzinfo is None:
        return dt
    local_tz = _resolve_timezone(None)
    return dt.astimezone(local_tz).replace(tzinfo=None)


def normalize_client_datetime(dt: datetime, client_timezone: str | None) -> datetime:
    """Normalize browser/client datetime to local wall-clock naive value for DB operations."""
    if dt.tzinfo is not None:
        # Compatibility mode for clients that send local wall-clock time with trailing `Z`.
        # Reinterpret UTC-aware value as local wall time in request/default timezone.
        if dt.utcoffset() == timezone.utc.utcoffset(None):
            return dt.replace(tzinfo=None)
        tz = _resolve_timezone(client_timezone)
        return dt.astimezone(tz).replace(tzinfo=None)

    return dt


def resolve_client_now(
    client_time: str | None,
    client_timezone: str | None,
) -> datetime:
    """Resolve 'now' from device/browser time and normalize to local wall-clock naive."""
    if not client_time:
        return to_db_datetime(datetime.now(_resolve_timezone(None)))

    try:
        parsed = datetime.fromisoformat(client_time)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid X-Device-Time header") from exc

    return normalize_client_datetime(parsed, client_timezone)


def server_now_utc_naive() -> datetime:
    """Return current server timestamp in local wall-clock naive form used by DB/business logic."""
    return to_db_datetime(datetime.now(_resolve_timezone(None)))


def to_client_datetime(dt: datetime, client_timezone: str | None) -> datetime:
    """Convert DB local wall-clock naive datetime to client timezone-aware datetime for API output."""
    local_aware = dt.replace(tzinfo=_resolve_timezone(None))
    tz = _resolve_timezone(client_timezone)
    return local_aware.astimezone(tz)


def can_transition_booking_status(current: BookingStatus, target: BookingStatus) -> bool:
    if current == target:
        return True
    return target in ALLOWED_BOOKING_TRANSITIONS[current]


def can_manage_booking_operationally(actor: User, booking: Booking) -> bool:
    if actor.id == booking.user_id:
        return True
    return actor.role in CHECKIN_ALLOWED_ROLES


def ensure_can_manage_booking_operationally(actor: User, booking: Booking) -> None:
    if not can_manage_booking_operationally(actor, booking):
        raise HTTPException(status_code=403, detail="Not enough permissions for booking operation")


def validate_check_in_window(booking: Booking, now: datetime) -> None:
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(status_code=409, detail="Check-in is allowed only for confirmed bookings")

    check_in_open_at = booking.start_time - timedelta(minutes=settings.check_in_open_before_minutes)
    no_show_at = booking.start_time + timedelta(minutes=settings.no_show_grace_minutes)

    if now < check_in_open_at:
        raise HTTPException(status_code=409, detail="Check-in window has not opened yet")
    if now >= no_show_at:
        raise HTTPException(status_code=409, detail="Check-in window is closed, booking is no-show")
    if now >= booking.end_time:
        raise HTTPException(status_code=409, detail="Check-in is not allowed after booking end time")


def validate_check_out_window(booking: Booking) -> None:
    if booking.status != BookingStatus.active:
        raise HTTPException(status_code=409, detail="Check-out is allowed only for active bookings")


def validate_manual_no_show(booking: Booking, now: datetime) -> None:
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(status_code=409, detail="No-show can be set only for confirmed bookings")

    no_show_at = booking.start_time + timedelta(minutes=settings.no_show_grace_minutes)
    if now < no_show_at:
        raise HTTPException(status_code=409, detail="No-show cannot be set before grace window ends")


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

async def sync_booking_statuses(session, now: datetime | None = None):
    """Backward-compatible wrapper to avoid import-time circular dependency."""
    from app.services.booking_lifecycle import sync_booking_statuses as _sync_booking_statuses

    return await _sync_booking_statuses(session=session, now=now)


async def sync_parking_spot_statuses(session, spot_ids: list[int] | None = None, now: datetime | None = None):
    """Backward-compatible wrapper to avoid import-time circular dependency."""
    from app.services.booking_lifecycle import sync_parking_spot_statuses as _sync_parking_spot_statuses

    return await _sync_parking_spot_statuses(session=session, spot_ids=spot_ids, now=now)

