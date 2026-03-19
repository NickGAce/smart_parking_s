from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

# Убираем прямой импорт ParkingSpot
class ParkingLot(Base):
    __tablename__ = "parking_lots"
    __table_args__ = (
        CheckConstraint("total_spots > 0", name="ck_parking_lots_total_spots_positive"),
        CheckConstraint(
            "guest_spot_percentage >= 0 AND guest_spot_percentage <= 100",
            name="ck_parking_lots_guest_spot_percentage_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    total_spots: Mapped[int] = mapped_column(Integer, nullable=False)  # общее количество мест
    guest_spot_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=15)  # процент гостевых мест
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Связь с местами парковки
    spots: Mapped[list["ParkingSpot"]] = relationship("ParkingSpot", back_populates="parking_lot")  # Используем строку для отложенного импорта
    zones: Mapped[list["ParkingZone"]] = relationship("ParkingZone", back_populates="parking_lot")

    def __repr__(self):
        return f"<ParkingLot(id={self.id}, name={self.name})>"
