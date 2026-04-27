from datetime import datetime

from pydantic import BaseModel, Field

from app.models.vehicle import VehicleType


class VehicleCreate(BaseModel):
    plate_number: str = Field(min_length=1, max_length=64)
    vehicle_type: VehicleType = VehicleType.car
    brand: str | None = None
    model: str | None = None
    color: str | None = None
    is_primary: bool = False
    is_active: bool = True


class VehicleUpdate(BaseModel):
    plate_number: str | None = Field(default=None, min_length=1, max_length=64)
    vehicle_type: VehicleType | None = None
    brand: str | None = None
    model: str | None = None
    color: str | None = None
    is_primary: bool | None = None
    is_active: bool | None = None


class VehicleOut(BaseModel):
    id: int
    user_id: int
    plate_number: str
    normalized_plate_number: str
    vehicle_type: VehicleType
    brand: str | None
    model: str | None
    color: str | None
    is_primary: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
