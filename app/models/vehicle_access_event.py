import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AccessDirection(str, enum.Enum):
    entry = "entry"
    exit = "exit"


class RecognitionSource(str, enum.Enum):
    manual = "manual"
    mock = "mock"
    provider = "provider"


class AccessDecision(str, enum.Enum):
    allowed = "allowed"
    denied = "denied"
    review = "review"




class ProcessingStatus(str, enum.Enum):
    pending = "pending"
    processed = "processed"
    failed = "failed"


class VehicleAccessEvent(Base):
    __tablename__ = "vehicle_access_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parking_lot_id: Mapped[int] = mapped_column(ForeignKey("parking_lots.id"), nullable=False, index=True)
    parking_spot_id: Mapped[int | None] = mapped_column(ForeignKey("parking_spots.id"), nullable=True, index=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"), nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"), nullable=True, index=True)
    plate_number: Mapped[str] = mapped_column(String(64), nullable=False)
    normalized_plate_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    direction: Mapped[AccessDirection] = mapped_column(Enum(AccessDirection), nullable=False, index=True)
    recognition_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    recognition_source: Mapped[RecognitionSource] = mapped_column(Enum(RecognitionSource), nullable=False)
    recognition_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    frame_timestamp: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    processing_status: Mapped[ProcessingStatus] = mapped_column(Enum(ProcessingStatus), nullable=False, default=ProcessingStatus.processed)
    decision: Mapped[AccessDecision] = mapped_column(Enum(AccessDecision), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)
