from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_session
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.models.parking_lot import ParkingLot
from app.schemas.parking_spot import ParkingSpotOut

router = APIRouter(prefix="/parking_spots", tags=["parking_spots"])


@router.post("", response_model=ParkingSpotOut, status_code=201)
async def create_parking_spot(
    spot_number: int,
    parking_lot_id: int,
    session: AsyncSession = Depends(get_session),
):
    # Проверяем, существует ли парковка с данным ID
    res = await session.execute(select(ParkingLot).where(ParkingLot.id == parking_lot_id))
    parking_lot = res.scalar_one_or_none()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="ParkingLot not found")

    # Создаем парковочное место
    parking_spot = ParkingSpot(
        spot_number=spot_number,
        status=SpotStatus.available,  # Место изначально доступно
        parking_lot_id=parking_lot_id,
    )

    session.add(parking_spot)
    await session.commit()
    await session.refresh(parking_spot)

    return parking_spot

@router.get("/{parking_spot_id}", response_model=ParkingSpotOut)
async def get_parking_spot(
    parking_spot_id: int, session: AsyncSession = Depends(get_session)
):
    res = await session.execute(select(ParkingSpot).filter_by(id=parking_spot_id))
    parking_spot = res.scalar_one_or_none()
    if not parking_spot:
        raise HTTPException(status_code=404, detail="ParkingSpot not found")
    return parking_spot

