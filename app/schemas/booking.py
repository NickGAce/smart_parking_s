from pydantic import BaseModel
from datetime import datetime
from app.models.booking import BookingType


class BookingCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    parking_spot_id: int
    type: BookingType = BookingType.guest

    class Config:
        from_attributes = True


class BookingOut(BookingCreate):
    id: int
    user_id: int

    class Config:
        from_attributes = True