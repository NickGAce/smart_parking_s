from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select

from app.db.session import get_session
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.models.parking_lot import ParkingLot
from app.models.booking import Booking, BookingStatus
from app.schemas.parking_spot import ParkingSpotCreate, ParkingSpotOut, ParkingSpotUpdate

router = APIRouter(prefix="/parking_spots", tags=["parking_spots"])


async def _has_active_booking(
    session: AsyncSession,
    spot_id: int,
    window_start: datetime,
    window_end: datetime,
) -> bool:
    overlap_condition = and_(
        Booking.end_time > window_start,
        Booking.start_time < window_end,
    )
    result = await session.execute(
        select(Booking.id)
        .where(Booking.parking_spot_id == spot_id)
        .where(Booking.status == BookingStatus.active)
        .where(overlap_condition)
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _to_spot_out(
    session: AsyncSession,
    spot: ParkingSpot,
    from_time: datetime,
    to_time: datetime,
) -> ParkingSpotOut:
    effective_status = SpotStatus.available
    if spot.status == SpotStatus.blocked:
        effective_status = SpotStatus.blocked
    elif await _has_active_booking(session, spot.id, from_time, to_time):
        effective_status = SpotStatus.booked

    return ParkingSpotOut(
        id=spot.id,
        spot_number=spot.spot_number,
        status=spot.status,
        effective_status=effective_status,
        type=spot.type,
        parking_lot_id=spot.parking_lot_id,
    )


@router.post("", response_model=ParkingSpotOut, status_code=201)
async def create_parking_spot(
    payload: ParkingSpotCreate,
    session: AsyncSession = Depends(get_session),
):
    # Проверяем, существует ли парковка с данным ID
    res = await session.execute(select(ParkingLot).where(ParkingLot.id == payload.parking_lot_id))
    parking_lot = res.scalar_one_or_none()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="ParkingLot not found")

    # Создаем парковочное место
    parking_spot = ParkingSpot(
        spot_number=payload.spot_number,
        status=SpotStatus.available,  # Место изначально доступно
        type=payload.type,
        parking_lot_id=payload.parking_lot_id,
    )

    session.add(parking_spot)
    await session.commit()
    await session.refresh(parking_spot)

    return await _to_spot_out(
        session,
        parking_spot,
        datetime.utcnow(),
        datetime.utcnow(),
    )

@router.get("", response_model=list[ParkingSpotOut])
async def list_parking_spots(
    from_time: datetime | None = Query(None, alias="from"),
    to_time: datetime | None = Query(None, alias="to"),
    session: AsyncSession = Depends(get_session),
):
    if (from_time and not to_time) or (to_time and not from_time):
        raise HTTPException(status_code=400, detail="Both 'from' and 'to' must be provided")
    if from_time and to_time and from_time >= to_time:
        raise HTTPException(status_code=400, detail="'from' must be earlier than 'to'")

    if not from_time and not to_time:
        from_time = datetime.utcnow()
        to_time = from_time

    res = await session.execute(select(ParkingSpot))
    spots = res.scalars().all()
    return [await _to_spot_out(session, spot, from_time, to_time) for spot in spots]

@router.get("/{parking_spot_id}", response_model=ParkingSpotOut)
async def get_parking_spot(
    parking_spot_id: int, session: AsyncSession = Depends(get_session)
):
    res = await session.execute(select(ParkingSpot).filter_by(id=parking_spot_id))
    parking_spot = res.scalar_one_or_none()
    if not parking_spot:
        raise HTTPException(status_code=404, detail="ParkingSpot not found")
    now = datetime.utcnow()
    return await _to_spot_out(session, parking_spot, now, now)

@router.patch("/{parking_spot_id}", response_model=ParkingSpotOut)
async def update_parking_spot(
    parking_spot_id: int,
    payload: ParkingSpotUpdate,
    session: AsyncSession = Depends(get_session),
):
    res = await session.execute(select(ParkingSpot).filter_by(id=parking_spot_id))
    parking_spot = res.scalar_one_or_none()
    if not parking_spot:
        raise HTTPException(status_code=404, detail="ParkingSpot not found")

    if payload.parking_lot_id is not None:
        res = await session.execute(
            select(ParkingLot).where(ParkingLot.id == payload.parking_lot_id)
        )
        parking_lot = res.scalar_one_or_none()
        if not parking_lot:
            raise HTTPException(status_code=404, detail="ParkingLot not found")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(parking_spot, field, value)

    await session.commit()
    await session.refresh(parking_spot)
    now = datetime.utcnow()
    return await _to_spot_out(session, parking_spot, now, now)

@router.delete("/{parking_spot_id}", status_code=204)
async def delete_parking_spot(
    parking_spot_id: int, session: AsyncSession = Depends(get_session)
):
    res = await session.execute(select(ParkingSpot).filter_by(id=parking_spot_id))
    parking_spot = res.scalar_one_or_none()
    if not parking_spot:
        raise HTTPException(status_code=404, detail="ParkingSpot not found")
    await session.delete(parking_spot)
    await session.commit()
