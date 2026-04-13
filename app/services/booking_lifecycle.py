from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, tzinfo
import re

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings
from app.models.booking import Booking, BookingStatus
from app.models.notification import NotificationType
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.services.notifications import notification_service

_FIXED_OFFSET_PATTERN = re.compile(r"^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$")


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


def _resolve_timezone() -> tzinfo:
    tz_name = settings.default_timezone
    fixed_offset_tz = _parse_fixed_offset_timezone(tz_name)
    if fixed_offset_tz is not None:
        return fixed_offset_tz

    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        # Keep background sync operational even when tzdata is unavailable.
        try:
            return ZoneInfo("Europe/Moscow")
        except ZoneInfoNotFoundError:
            return timezone(timedelta(hours=3))


def to_db_datetime(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(_resolve_timezone()).replace(tzinfo=None)

BOOKING_BLOCKING_STATUSES = (
    BookingStatus.pending,
    BookingStatus.confirmed,
    BookingStatus.active,
)

@dataclass(slots=True)
class LifecycleSyncStats:
    expired: int = 0
    completed: int = 0
    no_show: int = 0
    spot_available: int = 0
    spot_booked: int = 0

    @property
    def total_booking_updates(self) -> int:
        return self.expired + self.completed + self.no_show

async def sync_booking_statuses(session: AsyncSession, now: datetime | None = None) -> LifecycleSyncStats:
    """Apply server-driven booking lifecycle transitions based on current time."""
    current = to_db_datetime(now or datetime.now(timezone.utc))
    no_show_cutoff = current - timedelta(minutes=settings.no_show_grace_minutes)

    starts_soon_from = current
    starts_soon_to = current + timedelta(minutes=settings.booking_starts_soon_minutes)
    starts_soon_result = await session.execute(
        select(Booking)
        .where(Booking.status == BookingStatus.confirmed)
        .where(Booking.start_time > starts_soon_from)
        .where(Booking.start_time <= starts_soon_to)
    )
    for booking in starts_soon_result.scalars().all():
        await notification_service.create_booking_starts_soon_if_missing(session, booking)

    completed_result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.active)
        .where(Booking.end_time <= current)
        .values(status=BookingStatus.completed)
        .execution_options(synchronize_session=False)
    )

    no_show_bookings = (
        await session.execute(
            select(Booking)
            .where(Booking.status == BookingStatus.confirmed)
            .where(Booking.start_time <= no_show_cutoff)
        )
    ).scalars().all()
    no_show_result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.confirmed)
        .where(Booking.start_time <= no_show_cutoff)
        .values(status=BookingStatus.no_show)
        .execution_options(synchronize_session=False)
    )
    for booking in no_show_bookings:
        await notification_service.create_for_booking_event(
            session=session,
            booking=booking,
            event_type=NotificationType.booking_no_show,
            title="Booking marked as no-show",
            message=f"Booking #{booking.id} was marked as no-show.",
        )

    expired_bookings = (
        await session.execute(
            select(Booking)
            .where(Booking.status == BookingStatus.pending)
            .where(Booking.start_time <= current)
        )
    ).scalars().all()
    expired_result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.pending)
        .where(Booking.start_time <= current)
        .values(status=BookingStatus.expired)
        .execution_options(synchronize_session=False)
    )
    for booking in expired_bookings:
        await notification_service.create_for_booking_event(
            session=session,
            booking=booking,
            event_type=NotificationType.booking_expired,
            title="Booking expired",
            message=f"Booking #{booking.id} expired before confirmation.",
        )

    return LifecycleSyncStats(
        expired=expired_result.rowcount or 0,
        completed=completed_result.rowcount or 0,
        no_show=no_show_result.rowcount or 0,
    )

async def sync_parking_spot_statuses(
    session: AsyncSession,
    spot_ids: list[int] | None = None,
    now: datetime | None = None,
) -> tuple[int, int]:
    """Sync persisted parking spot status based on blocking bookings."""
    current = to_db_datetime(now or datetime.now(timezone.utc))
    booked_spots_subquery = select(Booking.parking_spot_id).where(Booking.status.in_(BOOKING_BLOCKING_STATUSES))
    booked_spots_subquery = booked_spots_subquery.where(Booking.end_time > current)
    if spot_ids:
        booked_spots_subquery = booked_spots_subquery.where(Booking.parking_spot_id.in_(spot_ids))
    booked_spots_subquery = booked_spots_subquery.distinct()

    available_stmt = (
        update(ParkingSpot)
        .where(ParkingSpot.status != SpotStatus.blocked)
        .where(ParkingSpot.status != SpotStatus.available)
        .where(~ParkingSpot.id.in_(booked_spots_subquery))
        .values(status=SpotStatus.available)
        .execution_options(synchronize_session=False)
    )
    if spot_ids:
        available_stmt = available_stmt.where(ParkingSpot.id.in_(spot_ids))
    available_result = await session.execute(available_stmt)

    booked_stmt = (
        update(ParkingSpot)
        .where(ParkingSpot.status != SpotStatus.blocked)
        .where(ParkingSpot.status != SpotStatus.booked)
        .where(ParkingSpot.id.in_(booked_spots_subquery))
        .values(status=SpotStatus.booked)
        .execution_options(synchronize_session=False)
    )
    if spot_ids:
        booked_stmt = booked_stmt.where(ParkingSpot.id.in_(spot_ids))
    booked_result = await session.execute(booked_stmt)

    return available_result.rowcount or 0, booked_result.rowcount or 0

async def run_booking_lifecycle_sync(session: AsyncSession, now: datetime | None = None) -> LifecycleSyncStats:
    """Run full booking + spot synchronization in one transaction scope."""
    current = to_db_datetime(now or datetime.now(timezone.utc))
    stats = await sync_booking_statuses(session=session, now=current)
    available_count, booked_count = await sync_parking_spot_statuses(session=session, now=current)
    stats.spot_available = available_count
    stats.spot_booked = booked_count
    return stats
