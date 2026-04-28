from datetime import datetime

from pydantic import BaseModel, Field

from app.models.vehicle_access_event import AccessDecision, AccessDirection, ProcessingStatus, RecognitionSource
from app.schemas.pagination import PaginationMeta


class AccessEventCreateBase(BaseModel):
    parking_lot_id: int
    direction: AccessDirection
    plate_number: str = Field(min_length=1, max_length=64)


class AccessEventRecognizeIn(BaseModel):
    parking_lot_id: int
    direction: AccessDirection
    image_token: str | None = None
    plate_number_hint: str | None = None


class AccessEventManualIn(AccessEventCreateBase):
    recognition_confidence: float | None = Field(default=None, ge=0, le=1)


class AccessEventOut(BaseModel):
    id: int
    parking_lot_id: int
    parking_spot_id: int | None
    booking_id: int | None
    user_id: int | None
    vehicle_id: int | None
    plate_number: str
    normalized_plate_number: str
    direction: AccessDirection
    recognition_confidence: float | None
    recognition_source: RecognitionSource
    image_url: str | None
    video_url: str | None
    frame_timestamp: float | None
    processing_status: ProcessingStatus
    decision: AccessDecision
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True


class RecognitionCandidateOut(BaseModel):
    plate: str
    normalized_plate: str
    confidence: float
    valid: bool
    reason: str


class AccessEventRecognitionOut(AccessEventOut):
    raw_text: str | None = None
    candidates: list[RecognitionCandidateOut] = Field(default_factory=list)
    provider: str | None = None
    confidence: float | None = None
    recognition_reason: str | None = None
    processing_status_detail: str | None = None
    selected_plate: str | None = None
    normalized_plate: str | None = None
    preprocessing_steps: list[str] = Field(default_factory=list)


class AccessEventListResponse(BaseModel):
    items: list[AccessEventOut]
    meta: PaginationMeta
