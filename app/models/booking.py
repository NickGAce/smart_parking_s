import enum
from datetime import datetime
from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

# Используем строковый тип для отложенного импорта
class BookingType(str, enum.Enum):
    guest = "guest"
    rental = "rental"


class BookingStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"
    expired = "expired"
    no_show = "no_show"

class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("start_time < end_time", name="ck_bookings_start_before_end"),
        Index("ix_bookings_status_start_time", "status", "start_time"),
        Index("ix_bookings_status_end_time", "status", "end_time"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    type: Mapped["BookingType"] = mapped_column(Enum(BookingType), default=BookingType.guest)  # Используем строковый тип
    status: Mapped["BookingStatus"] = mapped_column(
        Enum(BookingStatus), default=BookingStatus.pending, nullable=False
    )
    parking_spot_id: Mapped[int] = mapped_column(ForeignKey("parking_spots.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"), nullable=True, index=True)
    plate_number: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # Связь с местом парковки
    parking_spot: Mapped["ParkingSpot"] = relationship("ParkingSpot", back_populates="bookings")
    # Связь с пользователем
    user: Mapped["User"] = relationship("User", back_populates="bookings")
    vehicle: Mapped["Vehicle | None"] = relationship("Vehicle", back_populates="bookings")

    def __repr__(self):
        return f"<Booking(id={self.id}, spot={self.parking_spot.spot_number}, type={self.type})>"
