import enum

from sqlalchemy import Boolean, CheckConstraint, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SpotStatus(str, enum.Enum):
    available = "available"
    booked = "booked"
    blocked = "blocked"


class SpotType(str, enum.Enum):
    regular = "regular"
    guest = "guest"
    disabled = "disabled"
    ev = "ev"
    reserved = "reserved"
    vip = "vip"


class VehicleType(str, enum.Enum):
    car = "car"
    bike = "bike"
    truck = "truck"


class SizeCategory(str, enum.Enum):
    small = "small"
    medium = "medium"
    large = "large"


class ParkingSpot(Base):
    __tablename__ = "parking_spots"
    __table_args__ = (
        UniqueConstraint("parking_lot_id", "spot_number", name="uq_parking_spots_lot_spot_number"),
        CheckConstraint("spot_number > 0", name="ck_parking_spots_spot_number_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    spot_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[SpotStatus] = mapped_column(Enum(SpotStatus), default=SpotStatus.available)
    # legacy column kept for backward compatibility with existing API clients
    type: Mapped[str] = mapped_column(String(50), nullable=False, default=SpotType.regular.value)
    spot_type: Mapped[SpotType] = mapped_column(Enum(SpotType), nullable=False, default=SpotType.regular)
    vehicle_type: Mapped[VehicleType] = mapped_column(Enum(VehicleType), nullable=False, default=VehicleType.car)
    has_charger: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    size_category: Mapped[SizeCategory] = mapped_column(Enum(SizeCategory), nullable=False, default=SizeCategory.medium)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("parking_zones.id"), nullable=True)
    parking_lot_id: Mapped[int] = mapped_column(ForeignKey("parking_lots.id"), nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)

    parking_lot: Mapped["ParkingLot"] = relationship("ParkingLot", back_populates="spots")
    owner: Mapped["User"] = relationship("User", back_populates="spots")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="parking_spot")
    zone: Mapped["ParkingZone | None"] = relationship("ParkingZone", back_populates="spots")

    def __repr__(self):
        return f"<ParkingSpot(id={self.id}, spot_number={self.spot_number}, status={self.status})>"
