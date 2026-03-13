from pydantic import BaseModel
from datetime import datetime
from app.models.booking import BookingStatus, BookingType
from typing import Optional


class BookingCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    parking_spot_id: int
    type: BookingType = BookingType.guest

    class Config:
        from_attributes = True


class BookingUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    type: Optional[BookingType] = None
    status: Optional[BookingStatus] = None


class BookingOut(BookingCreate):
    id: int
    user_id: int
    status: BookingStatus

    class Config:
        from_attributes = True
