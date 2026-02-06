from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_session
from app.models.parking_lot import ParkingLot
from app.schemas.parking_lot import ParkingLotCreate, ParkingLotOut

router = APIRouter(prefix="/parking", tags=["parking"])

@router.post("", response_model=ParkingLotOut, status_code=201)
async def create_parking_lot(
    payload: ParkingLotCreate, session: AsyncSession = Depends(get_session)
):
    parking_lot = ParkingLot(
        name=payload.name,
        address=payload.address,
        total_spots=payload.total_spots,
        guest_spot_percentage=payload.guest_spot_percentage,
    )
    session.add(parking_lot)
    await session.commit()
    await session.refresh(parking_lot)
    return parking_lot

@router.get("/{parking_lot_id}", response_model=ParkingLotOut)
async def get_parking_lot(
    parking_lot_id: int, session: AsyncSession = Depends(get_session)
):
    res = await session.execute(select(ParkingLot).filter_by(id=parking_lot_id))
    parking_lot = res.scalar_one_or_none()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="ParkingLot not found")
    return parking_lot

