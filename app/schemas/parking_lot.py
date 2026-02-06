from pydantic import BaseModel
from typing import Optional


class ParkingLotCreate(BaseModel):
    name: str
    address: str
    total_spots: int
    guest_spot_percentage: Optional[int] = 15  # процент гостевых мест, по умолчанию 15%

    class Config:
        str_min_length = 6  # заменили старый ключ
        from_attributes = True


class ParkingLotOut(ParkingLotCreate):
    id: int

    class Config:
        from_attributes = True
