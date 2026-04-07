from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings
from app.models.booking import Booking, BookingStatus
from app.models.parking_spot import ParkingSpot, SpotStatus

def _resolve_timezone() -> timezone | ZoneInfo:
    tz_name = settings.default_timezone
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError as exc:
        raise RuntimeError("Invalid server default_timezone setting") from exc

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

    completed_result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.active)
        .where(Booking.end_time <= current)
        .values(status=BookingStatus.completed)
    )

    no_show_result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.confirmed)
        .where(Booking.start_time <= no_show_cutoff)
        .values(status=BookingStatus.no_show)
    )

    expired_result = await session.execute(
        update(Booking)
        .where(Booking.status == BookingStatus.pending)
        .where(Booking.start_time <= current)
        .values(status=BookingStatus.expired)
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
        .values(status=SpotStatus.available)
    )
    if spot_ids:
        available_stmt = available_stmt.where(ParkingSpot.id.in_(spot_ids))
    available_result = await session.execute(available_stmt)

    booked_stmt = (
        update(ParkingSpot)
        .where(ParkingSpot.status != SpotStatus.blocked)
        .where(ParkingSpot.id.in_(booked_spots_subquery))
        .values(status=SpotStatus.booked)
    )
    if spot_ids:
        booked_stmt = booked_stmt.where(ParkingSpot.id.in_(spot_ids))
    booked_result = await session.execute(booked_stmt)

    return available_result.rowcount or 0, booked_result.rowcount or 0

async def run_booking_lifecycle_sync(session: AsyncSession, now: datetime | None = None) -> LifecycleSyncStats:
    """Run full booking + spot synchronization in one transaction scope."""
    stats = await sync_booking_statuses(session=session, now=now)
    available_count, booked_count = await sync_parking_spot_statuses(session=session, now=now)
    stats.spot_available = available_count
    stats.spot_booked = booked_count
    return stats
