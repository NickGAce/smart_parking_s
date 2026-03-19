import enum

from sqlalchemy import JSON, CheckConstraint, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AccessMode(str, enum.Enum):
    employees_only = "employees_only"
    guests_only = "guests_only"
    mixed = "mixed"


class ParkingLot(Base):
    __tablename__ = "parking_lots"
    __table_args__ = (
        CheckConstraint("total_spots > 0", name="ck_parking_lots_total_spots_positive"),
        CheckConstraint(
            "guest_spot_percentage >= 0 AND guest_spot_percentage <= 100",
            name="ck_parking_lots_guest_spot_percentage_range",
        ),
        CheckConstraint("min_booking_minutes > 0", name="ck_parking_lots_min_booking_minutes_positive"),
        CheckConstraint("max_booking_minutes > 0", name="ck_parking_lots_max_booking_minutes_positive"),
        CheckConstraint(
            "min_booking_minutes <= max_booking_minutes",
            name="ck_parking_lots_booking_min_lte_max",
        ),
        CheckConstraint("booking_step_minutes > 0", name="ck_parking_lots_booking_step_minutes_positive"),
        CheckConstraint("max_advance_minutes > 0", name="ck_parking_lots_max_advance_minutes_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    total_spots: Mapped[int] = mapped_column(Integer, nullable=False)
    guest_spot_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    access_mode: Mapped[AccessMode] = mapped_column(Enum(AccessMode), nullable=False, default=AccessMode.mixed)
    allowed_user_roles: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    min_booking_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    max_booking_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=720)
    booking_step_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    max_advance_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=10080)

    spots: Mapped[list["ParkingSpot"]] = relationship("ParkingSpot", back_populates="parking_lot")
    zones: Mapped[list["ParkingZone"]] = relationship("ParkingZone", back_populates="parking_lot")
    working_hours: Mapped[list["ParkingLotWorkingHour"]] = relationship(
        "ParkingLotWorkingHour", back_populates="parking_lot", cascade="all, delete-orphan"
    )
    schedule_exceptions: Mapped[list["ParkingLotScheduleException"]] = relationship(
        "ParkingLotScheduleException", back_populates="parking_lot", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<ParkingLot(id={self.id}, name={self.name})>"
