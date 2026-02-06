from pydantic import BaseModel
from app.models.parking_spot import SpotStatus
from typing import Optional


class ParkingSpotCreate(BaseModel):
    spot_number: int
    parking_lot_id: int
    type: str = "available"

    class Config:
        from_attributes = True


class ParkingSpotOut(BaseModel):
    id: int
    spot_number: int
    status: SpotStatus
    type: str
    parking_lot_id: int

    class Config:
        from_attributes = True  


class ParkingSpotUpdate(BaseModel):
    spot_number: Optional[int] = None
    status: Optional[SpotStatus] = None
    type: Optional[str] = None
    owner_id: Optional[int] = None
    parking_lot_id: Optional[int] = None

    class Config:
        from_attributes = True
