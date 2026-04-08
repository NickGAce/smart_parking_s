from datetime import datetime
from typing import Optional

from pydantic import BaseModel, model_validator

from app.models.booking import BookingStatus, BookingType
from app.schemas.recommendation import RecommendationFilters, RecommendationPreferences, RecommendationWeights


class BookingCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    parking_spot_id: int | None = None
    type: BookingType = BookingType.guest

    # Auto-assign mode
    auto_assign: bool = False
    parking_lot_id: int | None = None
    recommendation_filters: RecommendationFilters | None = None
    recommendation_preferences: RecommendationPreferences | None = None
    recommendation_weights: RecommendationWeights | None = None

    @model_validator(mode="after")
    def validate_assignment_mode(self):
        if self.auto_assign:
            if self.parking_spot_id is not None:
                raise ValueError("Provide either parking_spot_id or auto_assign=true, not both")
            if self.parking_lot_id is None:
                raise ValueError("parking_lot_id is required when auto_assign=true")
        elif self.parking_spot_id is None:
            raise ValueError("parking_spot_id is required when auto_assign=false")

        return self

    class Config:
        from_attributes = True


class BookingUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    type: Optional[BookingType] = None
    status: Optional[BookingStatus] = None


class BookingOut(BaseModel):
    id: int
    user_id: int
    parking_spot_id: int
    type: BookingType
    status: BookingStatus
    start_time: datetime
    end_time: datetime
    assignment_mode: str = "manual"
    assignment_explanation: str | None = None

    class Config:
        from_attributes = True
