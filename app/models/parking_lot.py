from sqlalchemy import String, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

# Убираем прямой импорт ParkingSpot
class ParkingLot(Base):
    __tablename__ = "parking_lots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    total_spots: Mapped[int] = mapped_column(Integer, nullable=False)  # общее количество мест
    guest_spot_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=15)  # процент гостевых мест
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Связь с местами парковки
    spots: Mapped[list["ParkingSpot"]] = relationship("ParkingSpot", back_populates="parking_lot")  # Используем строку для отложенного импорта

    def __repr__(self):
        return f"<ParkingLot(id={self.id}, name={self.name})>"
