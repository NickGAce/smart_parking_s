from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus


def to_db_datetime(dt: datetime) -> datetime:
    """Normalize datetimes for TIMESTAMP WITHOUT TIME ZONE columns (UTC naive)."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


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
