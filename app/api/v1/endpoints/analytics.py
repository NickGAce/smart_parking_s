from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.schemas.analytics import (
    AnalyticsBookingsOut,
    AnalyticsFiltersOut,
    AnalyticsOccupancyForecastOut,
    AnalyticsOccupancyOut,
    AnalyticsSummaryOut,
    OccupancyBySpotTypeOut,
    OccupancyForecastBucketOut,
    OccupancyByZoneOut,
    PeakHourOut,
)
from app.services.analytics import (
    AnalyticsFilters,
    OccupancyForecastFilters,
    get_booking_metrics,
    get_occupancy_forecast,
    get_occupancy_by_spot_type,
    get_occupancy_by_zone,
    get_occupancy_percent,
    get_peak_hours,
    resolve_forecast_window,
    resolve_period_window,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _build_filters(
    period: Literal["day", "week", "month"],
    from_time: datetime | None,
    to_time: datetime | None,
    parking_lot_id: int | None,
    zone: str | None,
) -> AnalyticsFilters:
    try:
        resolved_from, resolved_to = resolve_period_window(
            period=period,
            from_time=from_time,
            to_time=to_time,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if resolved_from >= resolved_to:
        raise HTTPException(status_code=400, detail="from must be earlier than to")

    return AnalyticsFilters(
        parking_lot_id=parking_lot_id,
        zone=zone,
        period=period,
        from_time=resolved_from,
        to_time=resolved_to,
    )


@router.get("/summary", response_model=AnalyticsSummaryOut)
async def analytics_summary(
    period: Literal["day", "week", "month"] = Query("week"),
    parking_lot_id: int | None = Query(default=None),
    zone: str | None = Query(default=None),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_session),
    _=Depends(get_current_user),
):
    filters = _build_filters(period, from_time, to_time, parking_lot_id, zone)

    occupancy = await get_occupancy_percent(session, filters)
    booking_metrics = await get_booking_metrics(session, filters)

    return AnalyticsSummaryOut(
        filters=AnalyticsFiltersOut(**filters.__dict__),
        occupancy_percent=occupancy,
        bookings_count=booking_metrics.bookings_count,
        average_booking_duration_minutes=booking_metrics.average_booking_duration_minutes,
        cancellation_rate=booking_metrics.cancellation_rate,
        no_show_rate=booking_metrics.no_show_rate,
    )


@router.get("/occupancy", response_model=AnalyticsOccupancyOut)
async def analytics_occupancy(
    period: Literal["day", "week", "month"] = Query("week"),
    parking_lot_id: int | None = Query(default=None),
    zone: str | None = Query(default=None),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_session),
    _=Depends(get_current_user),
):
    filters = _build_filters(period, from_time, to_time, parking_lot_id, zone)

    occupancy = await get_occupancy_percent(session, filters)
    by_zone = await get_occupancy_by_zone(session, filters)
    by_spot_type = await get_occupancy_by_spot_type(session, filters)
    peak_hours = await get_peak_hours(session, filters)

    return AnalyticsOccupancyOut(
        filters=AnalyticsFiltersOut(**filters.__dict__),
        occupancy_percent=occupancy,
        by_zone=[OccupancyByZoneOut(**item) for item in by_zone],
        by_spot_type=[OccupancyBySpotTypeOut(**item) for item in by_spot_type],
        peak_hours=[PeakHourOut(**item) for item in peak_hours],
    )


@router.get("/bookings", response_model=AnalyticsBookingsOut)
async def analytics_bookings(
    period: Literal["day", "week", "month"] = Query("week"),
    parking_lot_id: int | None = Query(default=None),
    zone: str | None = Query(default=None),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    session: AsyncSession = Depends(get_session),
    _=Depends(get_current_user),
):
    filters = _build_filters(period, from_time, to_time, parking_lot_id, zone)
    booking_metrics = await get_booking_metrics(session, filters)

    return AnalyticsBookingsOut(
        filters=AnalyticsFiltersOut(**filters.__dict__),
        bookings_count=booking_metrics.bookings_count,
        average_booking_duration_minutes=booking_metrics.average_booking_duration_minutes,
        cancellation_rate=booking_metrics.cancellation_rate,
        no_show_rate=booking_metrics.no_show_rate,
        status_breakdown=booking_metrics.status_breakdown,
    )


@router.get("/occupancy-forecast", response_model=AnalyticsOccupancyForecastOut)
async def analytics_occupancy_forecast(
    parking_lot_id: int | None = Query(default=None),
    zone: str | None = Query(default=None),
    target_date: date | None = Query(default=None),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    history_days: int = Query(default=56, ge=1, le=365),
    bucket_size_hours: int = Query(default=1, ge=1, le=24),
    moving_average_window: int = Query(default=24, ge=0, le=200),
    session: AsyncSession = Depends(get_session),
    _=Depends(get_current_user),
):
    try:
        target_from, target_to = resolve_forecast_window(target_date, from_time, to_time)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    filters = OccupancyForecastFilters(
        parking_lot_id=parking_lot_id,
        zone=zone,
        target_from=target_from,
        target_to=target_to,
        history_days=history_days,
        bucket_size_hours=bucket_size_hours,
        moving_average_window=moving_average_window,
    )

    forecast = await get_occupancy_forecast(session, filters)
    return AnalyticsOccupancyForecastOut(
        parking_lot_id=parking_lot_id,
        zone=zone,
        history_days=history_days,
        bucket_size_hours=bucket_size_hours,
        target_from=target_from,
        target_to=target_to,
        forecast=[OccupancyForecastBucketOut(**bucket.__dict__) for bucket in forecast],
    )
