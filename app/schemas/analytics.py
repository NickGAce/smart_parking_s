from datetime import datetime

from pydantic import BaseModel, Field


class AnalyticsFiltersOut(BaseModel):
    parking_lot_id: int | None = None
    zone: str | None = None
    period: str
    from_time: datetime
    to_time: datetime


class OccupancyByZoneOut(BaseModel):
    zone: str
    occupancy_percent: float = Field(ge=0, le=100)


class OccupancyBySpotTypeOut(BaseModel):
    spot_type: str
    occupancy_percent: float = Field(ge=0, le=100)


class PeakHourOut(BaseModel):
    hour: int = Field(ge=0, le=23)
    bookings: int = Field(ge=0)


class AnalyticsSummaryOut(BaseModel):
    filters: AnalyticsFiltersOut
    occupancy_percent: float = Field(ge=0, le=100)
    bookings_count: int = Field(ge=0)
    average_booking_duration_minutes: float = Field(ge=0)
    cancellation_rate: float = Field(ge=0, le=1)
    no_show_rate: float = Field(ge=0, le=1)


class AnalyticsOccupancyOut(BaseModel):
    filters: AnalyticsFiltersOut
    occupancy_percent: float = Field(ge=0, le=100)
    by_zone: list[OccupancyByZoneOut]
    by_spot_type: list[OccupancyBySpotTypeOut]
    peak_hours: list[PeakHourOut]


class AnalyticsBookingsOut(BaseModel):
    filters: AnalyticsFiltersOut
    bookings_count: int = Field(ge=0)
    average_booking_duration_minutes: float = Field(ge=0)
    cancellation_rate: float = Field(ge=0, le=1)
    no_show_rate: float = Field(ge=0, le=1)
    status_breakdown: dict[str, int]
