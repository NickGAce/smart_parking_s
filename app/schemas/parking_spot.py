from pydantic import BaseModel
from app.models.parking_spot import SpotStatus


class ParkingSpotOut(BaseModel):
    id: int
    spot_number: int
    status: SpotStatus
    type: str
    parking_lot_id: int

    class Config:
        from_attributes = True  
