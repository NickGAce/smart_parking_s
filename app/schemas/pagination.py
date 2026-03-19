from pydantic import BaseModel

from app.schemas.booking import BookingOut
from app.schemas.parking_lot import ParkingLotOut
from app.schemas.parking_spot import ParkingSpotOut


class PaginationMeta(BaseModel):
    limit: int
    offset: int
    total: int


class ParkingLotListResponse(BaseModel):
    items: list[ParkingLotOut]
    meta: PaginationMeta


class ParkingSpotListResponse(BaseModel):
    items: list[ParkingSpotOut]
    meta: PaginationMeta


class BookingListResponse(BaseModel):
    items: list[BookingOut]
    meta: PaginationMeta
