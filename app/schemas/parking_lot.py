from datetime import date, time

from pydantic import BaseModel, Field, model_validator

from app.models.parking_lot import AccessMode
from app.models.user import UserRole


class ParkingLotCreate(BaseModel):
    name: str
    address: str
    total_spots: int
    guest_spot_percentage: int = 15

    access_mode: AccessMode = AccessMode.mixed
    allowed_user_roles: list[UserRole] = Field(default_factory=list)
    min_booking_minutes: int = 30
    max_booking_minutes: int = 720
    booking_step_minutes: int = 30
    max_advance_minutes: int = 10080

    class Config:
        str_min_length = 6
        from_attributes = True


class ParkingLotOut(ParkingLotCreate):
    id: int
    owner_id: int | None = None

    class Config:
        from_attributes = True


class ParkingLotUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    total_spots: int | None = None
    guest_spot_percentage: int | None = None
    access_mode: AccessMode | None = None
    allowed_user_roles: list[UserRole] | None = None
    min_booking_minutes: int | None = None
    max_booking_minutes: int | None = None
    booking_step_minutes: int | None = None
    max_advance_minutes: int | None = None

    class Config:
        from_attributes = True


class WorkingHourItem(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    open_time: time | None = None
    close_time: time | None = None
    is_closed: bool = False

    @model_validator(mode="after")
    def validate_times(self):
        if self.is_closed:
            return self
        if self.open_time is None or self.close_time is None:
            raise ValueError("open_time and close_time are required when day is open")
        if self.open_time >= self.close_time:
            raise ValueError("open_time must be earlier than close_time")
        return self


class ScheduleExceptionItem(BaseModel):
    date: date
    open_time: time | None = None
    close_time: time | None = None
    is_closed: bool = True

    @model_validator(mode="after")
    def validate_times(self):
        if self.is_closed:
            return self
        if self.open_time is None or self.close_time is None:
            raise ValueError("open_time and close_time are required when date is open")
        if self.open_time >= self.close_time:
            raise ValueError("open_time must be earlier than close_time")
        return self


class ParkingLotRulesUpdate(BaseModel):
    access_mode: AccessMode
    allowed_user_roles: list[UserRole] = Field(default_factory=list)
    min_booking_minutes: int = Field(..., gt=0)
    max_booking_minutes: int = Field(..., gt=0)
    booking_step_minutes: int = Field(..., gt=0)
    max_advance_minutes: int = Field(..., gt=0)
    working_hours: list[WorkingHourItem] = Field(default_factory=list)
    exceptions: list[ScheduleExceptionItem] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_booking_range(self):
        if self.min_booking_minutes > self.max_booking_minutes:
            raise ValueError("min_booking_minutes must be <= max_booking_minutes")
        return self


class ParkingLotRulesOut(ParkingLotRulesUpdate):
    parking_lot_id: int

    class Config:
        from_attributes = True
