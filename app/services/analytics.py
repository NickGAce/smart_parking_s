from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import Integer, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.parking_spot import ParkingSpot
from app.models.parking_zone import ParkingZone

BOOKED_STATUSES = (
    BookingStatus.confirmed,
    BookingStatus.active,
    BookingStatus.completed,
    BookingStatus.no_show,
)


@dataclass
class AnalyticsFilters:
    parking_lot_id: int | None
    zone: str | None
    period: str
    from_time: datetime
    to_time: datetime


@dataclass
class BookingMetrics:
    bookings_count: int
    average_booking_duration_minutes: float
    cancellation_rate: float
    no_show_rate: float
    status_breakdown: dict[str, int]


def resolve_period_window(
    period: str,
    from_time: datetime | None,
    to_time: datetime | None,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    now = now or datetime.utcnow()

    if from_time and to_time:
        return from_time, to_time

    if period == "day":
        return now - timedelta(days=1), now
    if period == "week":
        return now - timedelta(days=7), now
    if period == "month":
        return now - timedelta(days=30), now

    raise ValueError("Unsupported period")


def _dialect_name(session: AsyncSession) -> str:
    bind = session.get_bind()
    if bind is None:
        return "sqlite"
    return bind.dialect.name


def _duration_minutes_expr(session: AsyncSession, start_col, end_col):
    if _dialect_name(session) == "postgresql":
        return func.extract("epoch", end_col - start_col) / 60.0
    return (func.julianday(end_col) - func.julianday(start_col)) * 24.0 * 60.0


def _overlap_seconds_expr(session: AsyncSession, from_time: datetime, to_time: datetime):
    if _dialect_name(session) == "postgresql":
        overlap_start = func.greatest(Booking.start_time, from_time)
        overlap_end = func.least(Booking.end_time, to_time)
        return case(
            (overlap_end > overlap_start, func.extract("epoch", overlap_end - overlap_start)),
            else_=0.0,
        )

    overlap_start = func.max(Booking.start_time, from_time)
    overlap_end = func.min(Booking.end_time, to_time)
    return case(
        (overlap_end > overlap_start, (func.julianday(overlap_end) - func.julianday(overlap_start)) * 86400.0),
        else_=0.0,
    )


async def get_total_spots(session: AsyncSession, filters: AnalyticsFilters) -> int:
    stmt = select(func.count(ParkingSpot.id))

    if filters.parking_lot_id is not None:
        stmt = stmt.where(ParkingSpot.parking_lot_id == filters.parking_lot_id)
    if filters.zone is not None:
        stmt = stmt.join(ParkingZone, ParkingSpot.zone_id == ParkingZone.id).where(ParkingZone.name == filters.zone)

    result = await session.execute(stmt)
    return int(result.scalar_one() or 0)


async def get_occupancy_percent(session: AsyncSession, filters: AnalyticsFilters) -> float:
    spot_count = await get_total_spots(session, filters)
    if spot_count == 0:
        return 0.0

    occupied_seconds_expr = _overlap_seconds_expr(session, filters.from_time, filters.to_time)
    stmt = (
        select(func.sum(occupied_seconds_expr).label("occupied_seconds"))
        .select_from(Booking)
        .join(ParkingSpot, Booking.parking_spot_id == ParkingSpot.id)
        .outerjoin(ParkingZone, ParkingSpot.zone_id == ParkingZone.id)
        .where(Booking.status.in_(BOOKED_STATUSES))
        .where(Booking.end_time > filters.from_time)
        .where(Booking.start_time < filters.to_time)
    )

    if filters.parking_lot_id is not None:
        stmt = stmt.where(ParkingSpot.parking_lot_id == filters.parking_lot_id)
    if filters.zone is not None:
        stmt = stmt.where(ParkingZone.name == filters.zone)

    result = await session.execute(stmt)
    occupied_seconds_value = float(result.scalar_one() or 0.0)

    total_seconds = max((filters.to_time - filters.from_time).total_seconds() * spot_count, 1)
    return round(min((occupied_seconds_value / total_seconds) * 100.0, 100.0), 2)


async def get_booking_metrics(session: AsyncSession, filters: AnalyticsFilters) -> BookingMetrics:
    duration_minutes = _duration_minutes_expr(session, Booking.start_time, Booking.end_time)
    stmt = (
        select(
            func.count(Booking.id).label("total"),
            func.avg(duration_minutes).label("avg_minutes"),
            func.sum(case((Booking.status == BookingStatus.cancelled, 1), else_=0)).label("cancelled"),
            func.sum(case((Booking.status == BookingStatus.no_show, 1), else_=0)).label("no_show"),
            func.sum(case((Booking.status == BookingStatus.completed, 1), else_=0)).label("completed"),
            func.sum(case((Booking.status == BookingStatus.active, 1), else_=0)).label("active"),
            func.sum(case((Booking.status == BookingStatus.confirmed, 1), else_=0)).label("confirmed"),
            func.sum(case((Booking.status == BookingStatus.expired, 1), else_=0)).label("expired"),
            func.sum(case((Booking.status == BookingStatus.pending, 1), else_=0)).label("pending"),
        )
        .select_from(Booking)
        .join(ParkingSpot, Booking.parking_spot_id == ParkingSpot.id)
        .outerjoin(ParkingZone, ParkingSpot.zone_id == ParkingZone.id)
        .where(Booking.end_time > filters.from_time)
        .where(Booking.start_time < filters.to_time)
    )

    if filters.parking_lot_id is not None:
        stmt = stmt.where(ParkingSpot.parking_lot_id == filters.parking_lot_id)
    if filters.zone is not None:
        stmt = stmt.where(ParkingZone.name == filters.zone)

    result = (await session.execute(stmt)).one()

    total = int(result.total or 0)
    cancelled = int(result.cancelled or 0)
    no_show = int(result.no_show or 0)

    return BookingMetrics(
        bookings_count=total,
        average_booking_duration_minutes=round(float(result.avg_minutes or 0.0), 2),
        cancellation_rate=round((cancelled / total), 4) if total else 0.0,
        no_show_rate=round((no_show / total), 4) if total else 0.0,
        status_breakdown={
            BookingStatus.pending.value: int(result.pending or 0),
            BookingStatus.confirmed.value: int(result.confirmed or 0),
            BookingStatus.active.value: int(result.active or 0),
            BookingStatus.completed.value: int(result.completed or 0),
            BookingStatus.cancelled.value: cancelled,
            BookingStatus.expired.value: int(result.expired or 0),
            BookingStatus.no_show.value: no_show,
        },
    )


async def get_occupancy_by_zone(session: AsyncSession, filters: AnalyticsFilters) -> list[dict[str, float | str]]:
    total_period_seconds = max((filters.to_time - filters.from_time).total_seconds(), 1)

    occupied_seconds = func.sum(_overlap_seconds_expr(session, filters.from_time, filters.to_time))

    stmt = (
        select(
            ParkingZone.name.label("zone"),
            occupied_seconds.label("occupied_seconds"),
            func.count(func.distinct(ParkingSpot.id)).label("spots"),
        )
        .select_from(ParkingSpot)
        .join(ParkingZone, ParkingSpot.zone_id == ParkingZone.id)
        .outerjoin(
            Booking,
            (Booking.parking_spot_id == ParkingSpot.id)
            & (Booking.status.in_(BOOKED_STATUSES))
            & (Booking.end_time > filters.from_time)
            & (Booking.start_time < filters.to_time),
        )
        .group_by(ParkingZone.name)
    )

    if filters.parking_lot_id is not None:
        stmt = stmt.where(ParkingSpot.parking_lot_id == filters.parking_lot_id)
    if filters.zone is not None:
        stmt = stmt.where(ParkingZone.name == filters.zone)

    rows = (await session.execute(stmt)).all()
    result: list[dict[str, float | str]] = []
    for row in rows:
        spots = int(row.spots or 0)
        denominator = max(spots * total_period_seconds, 1)
        pct = min((float(row.occupied_seconds or 0.0) / denominator) * 100.0, 100.0)
        result.append({"zone": row.zone, "occupancy_percent": round(pct, 2)})

    return sorted(result, key=lambda item: item["occupancy_percent"], reverse=True)


async def get_occupancy_by_spot_type(session: AsyncSession, filters: AnalyticsFilters) -> list[dict[str, float | str]]:
    total_period_seconds = max((filters.to_time - filters.from_time).total_seconds(), 1)

    occupied_seconds = func.sum(_overlap_seconds_expr(session, filters.from_time, filters.to_time))

    stmt = (
        select(
            ParkingSpot.spot_type.label("spot_type"),
            occupied_seconds.label("occupied_seconds"),
            func.count(func.distinct(ParkingSpot.id)).label("spots"),
        )
        .select_from(ParkingSpot)
        .outerjoin(ParkingZone, ParkingSpot.zone_id == ParkingZone.id)
        .outerjoin(
            Booking,
            (Booking.parking_spot_id == ParkingSpot.id)
            & (Booking.status.in_(BOOKED_STATUSES))
            & (Booking.end_time > filters.from_time)
            & (Booking.start_time < filters.to_time),
        )
        .group_by(ParkingSpot.spot_type)
    )

    if filters.parking_lot_id is not None:
        stmt = stmt.where(ParkingSpot.parking_lot_id == filters.parking_lot_id)
    if filters.zone is not None:
        stmt = stmt.where(ParkingZone.name == filters.zone)

    rows = (await session.execute(stmt)).all()
    result: list[dict[str, float | str]] = []
    for row in rows:
        spots = int(row.spots or 0)
        denominator = max(spots * total_period_seconds, 1)
        pct = min((float(row.occupied_seconds or 0.0) / denominator) * 100.0, 100.0)
        result.append({"spot_type": row.spot_type.value if row.spot_type else "unknown", "occupancy_percent": round(pct, 2)})

    return sorted(result, key=lambda item: item["occupancy_percent"], reverse=True)


async def get_peak_hours(session: AsyncSession, filters: AnalyticsFilters, limit: int = 5) -> list[dict[str, int]]:
    if _dialect_name(session) == "postgresql":
        hour_bucket = cast(func.extract("hour", Booking.start_time), Integer)
    else:
        hour_bucket = cast(func.strftime("%H", Booking.start_time), Integer)

    stmt = (
        select(hour_bucket.label("hour"), func.count(Booking.id).label("bookings"))
        .select_from(Booking)
        .join(ParkingSpot, Booking.parking_spot_id == ParkingSpot.id)
        .outerjoin(ParkingZone, ParkingSpot.zone_id == ParkingZone.id)
        .where(Booking.status.in_(BOOKED_STATUSES))
        .where(Booking.end_time > filters.from_time)
        .where(Booking.start_time < filters.to_time)
        .group_by(hour_bucket)
        .order_by(func.count(Booking.id).desc(), hour_bucket.asc())
        .limit(limit)
    )

    if filters.parking_lot_id is not None:
        stmt = stmt.where(ParkingSpot.parking_lot_id == filters.parking_lot_id)
    if filters.zone is not None:
        stmt = stmt.where(ParkingZone.name == filters.zone)

    rows = (await session.execute(stmt)).all()
    return [{"hour": int(row.hour), "bookings": int(row.bookings)} for row in rows]
