import enum

from sqlalchemy import Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ZoneType(str, enum.Enum):
    general = "general"
    premium = "premium"
    service = "service"
    restricted = "restricted"


class AccessLevel(str, enum.Enum):
    public = "public"
    employees = "employees"
    permit_only = "permit_only"
    vip_only = "vip_only"


class ParkingZone(Base):
    __tablename__ = "parking_zones"
    __table_args__ = (
        UniqueConstraint("parking_lot_id", "name", name="uq_parking_zones_lot_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parking_lot_id: Mapped[int] = mapped_column(ForeignKey("parking_lots.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    zone_type: Mapped[ZoneType] = mapped_column(Enum(ZoneType), nullable=False, default=ZoneType.general)
    access_level: Mapped[AccessLevel] = mapped_column(Enum(AccessLevel), nullable=False, default=AccessLevel.public)

    parking_lot: Mapped["ParkingLot"] = relationship("ParkingLot", back_populates="zones")
    spots: Mapped[list["ParkingSpot"]] = relationship("ParkingSpot", back_populates="zone")
