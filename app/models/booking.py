import enum
from datetime import datetime
from sqlalchemy import Integer, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

# Используем строковый тип для отложенного импорта
class BookingType(str, enum.Enum):
    guest = "guest"
    rental = "rental"

class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    type: Mapped["BookingType"] = mapped_column(Enum(BookingType), default=BookingType.guest)  # Используем строковый тип
    parking_spot_id: Mapped[int] = mapped_column(ForeignKey("parking_spots.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Связь с местом парковки
    parking_spot: Mapped["ParkingSpot"] = relationship("ParkingSpot", back_populates="bookings")
    # Связь с пользователем
    user: Mapped["User"] = relationship("User", back_populates="bookings")

    def __repr__(self):
        return f"<Booking(id={self.id}, spot={self.parking_spot.spot_number}, type={self.type})>"
