from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_session
from app.models.parking_lot import ParkingLot
from app.schemas.parking_lot import ParkingLotCreate, ParkingLotOut, ParkingLotUpdate

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

@router.get("", response_model=list[ParkingLotOut])
async def list_parking_lots(session: AsyncSession = Depends(get_session)):
    res = await session.execute(select(ParkingLot))
    return res.scalars().all()

@router.get("/{parking_lot_id}", response_model=ParkingLotOut)
async def get_parking_lot(
    parking_lot_id: int, session: AsyncSession = Depends(get_session)
):
    res = await session.execute(select(ParkingLot).filter_by(id=parking_lot_id))
    parking_lot = res.scalar_one_or_none()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="ParkingLot not found")
    return parking_lot

@router.patch("/{parking_lot_id}", response_model=ParkingLotOut)
async def update_parking_lot(
    parking_lot_id: int,
    payload: ParkingLotUpdate,
    session: AsyncSession = Depends(get_session),
):
    res = await session.execute(select(ParkingLot).filter_by(id=parking_lot_id))
    parking_lot = res.scalar_one_or_none()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="ParkingLot not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(parking_lot, field, value)

    await session.commit()
    await session.refresh(parking_lot)
    return parking_lot

@router.delete("/{parking_lot_id}", status_code=204)
async def delete_parking_lot(
    parking_lot_id: int, session: AsyncSession = Depends(get_session)
):
    res = await session.execute(select(ParkingLot).filter_by(id=parking_lot_id))
    parking_lot = res.scalar_one_or_none()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="ParkingLot not found")
    await session.delete(parking_lot)
    await session.commit()
