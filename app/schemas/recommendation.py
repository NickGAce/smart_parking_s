from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.parking_spot import SizeCategory, SpotType, VehicleType
from app.models.user import UserRole


class RecommendationWeights(BaseModel):
    availability: float = Field(default=0.35, ge=0, le=1)
    spot_type: float = Field(default=0.15, ge=0, le=1)
    zone: float = Field(default=0.10, ge=0, le=1)
    charger: float = Field(default=0.10, ge=0, le=1)
    role: float = Field(default=0.20, ge=0, le=1)
    conflict: float = Field(default=0.10, ge=0, le=1)


class RecommendationFilters(BaseModel):
    spot_types: list[SpotType] | None = None
    zone_ids: list[int] | None = None
    vehicle_type: VehicleType | None = None
    size_category: SizeCategory | None = None
    requires_charger: bool | None = None


class RecommendationPreferences(BaseModel):
    preferred_spot_types: list[SpotType] | None = None
    preferred_zone_ids: list[int] | None = None
    prefer_charger: bool = False
    needs_accessible_spot: bool = False
    max_results: int = Field(default=5, ge=1, le=50)


class RecommendationUserContext(BaseModel):
    role: UserRole | None = None


class RecommendationRequest(BaseModel):
    user_context: RecommendationUserContext | None = None
    parking_lot_id: int
    from_time: datetime = Field(alias="from")
    to_time: datetime = Field(alias="to")
    filters: RecommendationFilters | None = None
    preferences: RecommendationPreferences | None = None
    weights: RecommendationWeights = Field(default_factory=RecommendationWeights)

    @model_validator(mode="after")
    def validate_interval(self):
        if self.from_time >= self.to_time:
            raise ValueError("'from' must be earlier than 'to'")
        return self


class RecommendationExplainFactor(BaseModel):
    factor: str
    value: float
    weight: float
    contribution: float
    reason: str


class RecommendedSpot(BaseModel):
    spot_id: int
    spot_number: int
    parking_lot_id: int
    zone_id: int | None
    zone_name: str | None
    spot_type: SpotType
    has_charger: bool
    score: float
    explainability: list[RecommendationExplainFactor]


class RecommendationResponse(BaseModel):
    parking_lot_id: int
    from_time: datetime = Field(alias="from")
    to_time: datetime = Field(alias="to")
    requested_by_role: str
    total_candidates: int
    recommended_spots: list[RecommendedSpot]
