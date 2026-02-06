from pydantic import BaseModel
from app.models.parking_spot import SpotStatus


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
