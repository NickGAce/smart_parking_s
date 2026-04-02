from datetime import date, time

from sqlalchemy import Boolean, CheckConstraint, Date, ForeignKey, Integer, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ParkingLotWorkingHour(Base):
    __tablename__ = "parking_lot_working_hours"
    __table_args__ = (
        UniqueConstraint("parking_lot_id", "day_of_week", name="uq_working_hours_lot_day"),
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="ck_working_hours_day_of_week_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parking_lot_id: Mapped[int] = mapped_column(ForeignKey("parking_lots.id", ondelete="CASCADE"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    open_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    close_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    parking_lot: Mapped["ParkingLot"] = relationship("ParkingLot", back_populates="working_hours")


class ParkingLotScheduleException(Base):
    __tablename__ = "parking_lot_schedule_exceptions"
    __table_args__ = (UniqueConstraint("parking_lot_id", "date", name="uq_schedule_exceptions_lot_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    parking_lot_id: Mapped[int] = mapped_column(ForeignKey("parking_lots.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    open_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    close_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    parking_lot: Mapped["ParkingLot"] = relationship("ParkingLot", back_populates="schedule_exceptions")
