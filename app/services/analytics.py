from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from statistics import mean
from typing import Protocol

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


@dataclass
class OccupancyForecastFilters:
    parking_lot_id: int | None
    zone: str | None
    target_from: datetime
    target_to: datetime
    history_days: int = 56
    bucket_size_hours: int = 1
    moving_average_window: int = 24


@dataclass
class ForecastBucket:
    time_bucket: datetime
    predicted_occupancy_percent: float
    confidence: str
    comment: str
    samples: int


class OccupancyForecastModel(Protocol):
    async def predict(self, session: AsyncSession, filters: OccupancyForecastFilters) -> list[ForecastBucket]:
        ...


class HistoricalPatternForecastModel:
    """
    Explainable forecasting model:
    - historical average
    - day-of-week average
    - hour-of-day average
    - day-of-week + hour average
    - optional simple moving average smoothing
    """

    async def predict(self, session: AsyncSession, filters: OccupancyForecastFilters) -> list[ForecastBucket]:
        if filters.target_from >= filters.target_to:
            return []

        bucket_seconds = filters.bucket_size_hours * 3600
        history_from = filters.target_from - timedelta(days=filters.history_days)

        spot_ids = await _get_filtered_spot_ids(session, filters.parking_lot_id, filters.zone)
        if not spot_ids:
            return [
                ForecastBucket(
                    time_bucket=bucket_start,
                    predicted_occupancy_percent=0.0,
                    confidence="low",
                    comment="No parking spots found for selected filters.",
                    samples=0,
                )
                for bucket_start in _iter_buckets(filters.target_from, filters.target_to, filters.bucket_size_hours)
            ]

        historical_bookings = await _get_bookings_for_period(session, spot_ids, history_from, filters.target_from)
        occupancy_by_bucket = _build_bucket_occupancy_map(
            bookings=historical_bookings,
            range_start=history_from,
            range_end=filters.target_from,
            bucket_size_hours=filters.bucket_size_hours,
            spot_count=len(spot_ids),
        )
        historical_series = sorted(occupancy_by_bucket.items(), key=lambda item: item[0])
        values = [value for _, value in historical_series]
        global_avg = mean(values) if values else 0.0

        by_dow: dict[int, list[float]] = {}
        by_hour: dict[int, list[float]] = {}
        by_dow_hour: dict[tuple[int, int], list[float]] = {}
        for bucket_start, value in historical_series:
            by_dow.setdefault(bucket_start.weekday(), []).append(value)
            by_hour.setdefault(bucket_start.hour, []).append(value)
            by_dow_hour.setdefault((bucket_start.weekday(), bucket_start.hour), []).append(value)

        result: list[ForecastBucket] = []
        moving_pool = values[-filters.moving_average_window :] if filters.moving_average_window > 0 else []

        for bucket_start in _iter_buckets(filters.target_from, filters.target_to, filters.bucket_size_hours):
            dow_values = by_dow.get(bucket_start.weekday(), [])
            hour_values = by_hour.get(bucket_start.hour, [])
            dow_hour_values = by_dow_hour.get((bucket_start.weekday(), bucket_start.hour), [])

            dow_avg = mean(dow_values) if dow_values else global_avg
            hour_avg = mean(hour_values) if hour_values else global_avg
            dow_hour_avg = mean(dow_hour_values) if dow_hour_values else (dow_avg + hour_avg) / 2

            if len(dow_hour_values) >= 3:
                base_prediction = (0.5 * dow_hour_avg) + (0.2 * dow_avg) + (0.2 * hour_avg) + (0.1 * global_avg)
            else:
                base_prediction = (0.4 * dow_avg) + (0.4 * hour_avg) + (0.2 * global_avg)

            if moving_pool:
                sma = mean(moving_pool)
                prediction = (0.8 * base_prediction) + (0.2 * sma)
            else:
                prediction = base_prediction

            prediction = round(min(max(prediction, 0.0), 100.0), 2)
            samples = len(dow_hour_values)

            if samples >= 6:
                confidence = "high"
                comment = "Strong weekday+hour history."
            elif samples >= 3:
                confidence = "medium"
                comment = "Moderate weekday+hour history."
            elif values:
                confidence = "low"
                comment = "Limited exact pattern samples; using broader averages."
            else:
                confidence = "low"
                comment = "No historical bookings in selected history window."

            result.append(
                ForecastBucket(
                    time_bucket=bucket_start,
                    predicted_occupancy_percent=prediction,
                    confidence=confidence,
                    comment=comment,
                    samples=samples,
                )
            )

            if filters.moving_average_window > 0:
                moving_pool.append(prediction)
                if len(moving_pool) > filters.moving_average_window:
                    moving_pool.pop(0)

        return result


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


def resolve_forecast_window(
    target_date: date | None,
    from_time: datetime | None,
    to_time: datetime | None,
) -> tuple[datetime, datetime]:
    if target_date is not None:
        if from_time is not None or to_time is not None:
            raise ValueError("Use either target_date or from/to, not both.")
        day_start = datetime.combine(target_date, time.min)
        return day_start, day_start + timedelta(days=1)

    if from_time is None or to_time is None:
        raise ValueError("Provide target_date or both from/to.")

    if from_time >= to_time:
        raise ValueError("from must be earlier than to")

    return from_time, to_time


def _iter_buckets(start: datetime, end: datetime, bucket_size_hours: int):
    cursor = start
    step = timedelta(hours=bucket_size_hours)
    while cursor < end:
        yield cursor
        cursor += step


async def _get_filtered_spot_ids(
    session: AsyncSession,
    parking_lot_id: int | None,
    zone: str | None,
) -> list[int]:
    stmt = select(ParkingSpot.id).select_from(ParkingSpot).outerjoin(ParkingZone, ParkingSpot.zone_id == ParkingZone.id)
    if parking_lot_id is not None:
        stmt = stmt.where(ParkingSpot.parking_lot_id == parking_lot_id)
    if zone is not None:
        stmt = stmt.where(ParkingZone.name == zone)
    rows = (await session.execute(stmt)).all()
    return [int(row.id) for row in rows]


async def _get_bookings_for_period(
    session: AsyncSession,
    spot_ids: list[int],
    from_time: datetime,
    to_time: datetime,
) -> list[Booking]:
    if not spot_ids:
        return []
    stmt = (
        select(Booking)
        .where(Booking.parking_spot_id.in_(spot_ids))
        .where(Booking.status.in_(BOOKED_STATUSES))
        .where(Booking.end_time > from_time)
        .where(Booking.start_time < to_time)
    )
    return list((await session.execute(stmt)).scalars().all())


def _build_bucket_occupancy_map(
    bookings: list[Booking],
    range_start: datetime,
    range_end: datetime,
    bucket_size_hours: int,
    spot_count: int,
) -> dict[datetime, float]:
    bucket_seconds = bucket_size_hours * 3600
    bucket_delta = timedelta(hours=bucket_size_hours)
    seconds_per_bucket: dict[datetime, float] = {bucket: 0.0 for bucket in _iter_buckets(range_start, range_end, bucket_size_hours)}

    for booking in bookings:
        start = max(booking.start_time, range_start)
        end = min(booking.end_time, range_end)
        if start >= end:
            continue
        offset_seconds = int((start - range_start).total_seconds())
        bucket_index = max(offset_seconds // bucket_seconds, 0)
        bucket_start = range_start + (bucket_index * bucket_delta)
        while bucket_start < end:
            bucket_end = bucket_start + bucket_delta
            overlap_start = max(start, bucket_start)
            overlap_end = min(end, bucket_end)
            if overlap_end > overlap_start and bucket_start in seconds_per_bucket:
                seconds_per_bucket[bucket_start] += (overlap_end - overlap_start).total_seconds()
            bucket_start = bucket_end

    denominator = max(spot_count * bucket_seconds, 1)
    return {bucket: round(min((seconds / denominator) * 100.0, 100.0), 2) for bucket, seconds in seconds_per_bucket.items()}


async def get_occupancy_forecast(
    session: AsyncSession,
    filters: OccupancyForecastFilters,
    model: OccupancyForecastModel | None = None,
) -> list[ForecastBucket]:
    forecasting_model = model or HistoricalPatternForecastModel()
    return await forecasting_model.predict(session, filters)
