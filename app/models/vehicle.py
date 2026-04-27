import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class VehicleType(str, enum.Enum):
    car = "car"
    ev = "ev"
    truck = "truck"
    bike = "bike"
    van = "van"


class Vehicle(Base):
    __tablename__ = "vehicles"
    __table_args__ = (
        UniqueConstraint("normalized_plate_number", name="uq_vehicles_normalized_plate_number"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    plate_number: Mapped[str] = mapped_column(String(64), nullable=False)
    normalized_plate_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    vehicle_type: Mapped[VehicleType] = mapped_column(Enum(VehicleType), nullable=False, default=VehicleType.car)
    brand: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="vehicles")
    bookings = relationship("Booking", back_populates="vehicle")
