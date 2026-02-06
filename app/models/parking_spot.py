import enum

from sqlalchemy import String, Enum, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.parking_lot import ParkingLot  # Импортируем модель парковки
from app.models.booking import Booking  # Строковый тип для отложенного импорта


class SpotStatus(str, enum.Enum):
    available = "available"
    booked = "booked"
    blocked = "blocked"


class ParkingSpot(Base):
    __tablename__ = "parking_spots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    spot_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[SpotStatus] = mapped_column(Enum(SpotStatus), default=SpotStatus.available)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="available")
    parking_lot_id: Mapped[int] = mapped_column(ForeignKey("parking_lots.id"), nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Связь с парковкой
    parking_lot: Mapped["ParkingLot"] = relationship("ParkingLot", back_populates="spots")
    # Связь с пользователем
    owner: Mapped["User"] = relationship("User", back_populates="spots")

    # Связь с бронями
    bookings: Mapped[list["Booking"]] = relationship("Booking",
                                                     back_populates="parking_spot")  # Строковый тип для отложенного импорта

    def __repr__(self):
        return f"<ParkingSpot(id={self.id}, spot_number={self.spot_number}, status={self.status})>"
