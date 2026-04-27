from datetime import datetime

from pydantic import BaseModel, Field
from typing import Literal


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


class OccupancyForecastBucketOut(BaseModel):
    time_bucket: datetime
    predicted_occupancy_percent: float = Field(ge=0, le=100)
    confidence: str
    comment: str
    samples: int = Field(ge=0)


class AnalyticsOccupancyForecastOut(BaseModel):
    parking_lot_id: int | None = None
    zone: str | None = None
    history_days: int = Field(ge=1, le=365)
    bucket_size_hours: int = Field(ge=1, le=24)
    target_from: datetime
    target_to: datetime
    forecast: list[OccupancyForecastBucketOut]


class ForecastQualityEvaluatedPeriodOut(BaseModel):
    from_time: datetime
    to_time: datetime
    bucket: Literal["hour", "day"]


class ForecastQualityResponse(BaseModel):
    parking_lot_id: int | None = None
    mae: float = Field(ge=0)
    mape: float = Field(ge=0)
    rmse: float | None = Field(default=None, ge=0)
    sample_size: int = Field(ge=0)
    confidence: Literal["low", "medium", "high"]
    explanation: str
    evaluated_period: ForecastQualityEvaluatedPeriodOut


ManagementRecommendationType = Literal[
    "overload",
    "no_show",
    "cancellation",
    "underutilization",
    "zone_imbalance",
    "rule_change",
    "security",
]
ManagementSeverity = Literal["low", "medium", "high", "critical"]


class ManagementRecommendationOut(BaseModel):
    id: str
    type: ManagementRecommendationType
    severity: ManagementSeverity
    title: str
    description: str
    recommended_action: str
    metric_source: str
    evidence: str
    expected_effect: str
    created_at: datetime


class ManagementRecommendationsResponse(BaseModel):
    period_from: datetime
    period_to: datetime
    parking_lot_id: int | None = None
    severity: ManagementSeverity | None = None
    items: list[ManagementRecommendationOut]
