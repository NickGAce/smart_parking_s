from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.parking_spot import ParkingSpot, SpotStatus


def to_db_datetime(dt: datetime) -> datetime:
    """Normalize datetimes for TIMESTAMP WITHOUT TIME ZONE columns (UTC naive)."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def normalize_client_datetime(dt: datetime, client_timezone: str | None) -> datetime:
    """Convert browser/client datetime to UTC naive for DB operations."""
    if dt.tzinfo is not None:
        return to_db_datetime(dt)

    if client_timezone:
        try:
            tz = ZoneInfo(client_timezone)
        except ZoneInfoNotFoundError as exc:
            raise HTTPException(status_code=400, detail="Invalid X-Timezone header") from exc
        return dt.replace(tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)

    # Fallback: treat naive datetime as UTC.
    return dt


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
) -> None:
    """Sync persisted parking spot status based on active bookings.

    blocked spots are not changed.
    """
    booked_spots_subquery = select(Booking.parking_spot_id).where(
        Booking.status == BookingStatus.active
    )
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
