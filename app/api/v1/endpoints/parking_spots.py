from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.db.session import get_session
from app.models.booking import Booking, BookingStatus
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.models.user import User, UserRole
from app.schemas.parking_spot import ParkingSpotCreate, ParkingSpotOut, ParkingSpotUpdate
from app.services.bookings import (
    normalize_client_datetime,
    resolve_client_now,
    sync_booking_statuses,
    sync_parking_spot_statuses,
    to_db_datetime as _to_db_datetime,
)

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


async def _get_spot_or_404(session: AsyncSession, parking_spot_id: int) -> ParkingSpot:
    res = await session.execute(select(ParkingSpot).where(ParkingSpot.id == parking_spot_id))
    parking_spot = res.scalar_one_or_none()
    if not parking_spot:
        raise HTTPException(status_code=404, detail="ParkingSpot not found")
    return parking_spot


async def _get_lot_or_404(session: AsyncSession, parking_lot_id: int) -> ParkingLot:
    res = await session.execute(select(ParkingLot).where(ParkingLot.id == parking_lot_id))
    parking_lot = res.scalar_one_or_none()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="ParkingLot not found")
    return parking_lot


def _is_admin(user: User) -> bool:
    return user.role == UserRole.admin


def _is_owner(user: User) -> bool:
    return user.role == UserRole.owner


def _can_owner_manage_lot(user: User, lot: ParkingLot) -> bool:
    return lot.owner_id == user.id


def _can_owner_manage_spot(user: User, spot: ParkingSpot, lot: ParkingLot | None = None) -> bool:
    if spot.owner_id == user.id:
        return True
    if lot is not None and lot.owner_id == user.id:
        return True
    return False


@router.post("", response_model=ParkingSpotOut, status_code=201)
async def create_parking_spot(
    payload: ParkingSpotCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_lot = await _get_lot_or_404(session, payload.parking_lot_id)

    if _is_owner(current_user) and not _can_owner_manage_lot(current_user, parking_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    parking_spot = ParkingSpot(
        spot_number=payload.spot_number,
        status=SpotStatus.available,
        type=payload.type,
        parking_lot_id=payload.parking_lot_id,
        owner_id=current_user.id if _is_owner(current_user) else None,
    )

    session.add(parking_spot)
    await session.commit()
    await session.refresh(parking_spot)

    now = _to_db_datetime(datetime.now(timezone.utc))
    return await _to_spot_out(session, parking_spot, now, now)


@router.get("", response_model=list[ParkingSpotOut])
async def list_parking_spots(
    request: Request,
    from_time: datetime | None = Query(None, alias="from"),
    to_time: datetime | None = Query(None, alias="to"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    client_timezone = request.headers.get("X-Timezone")
    device_now = resolve_client_now(request.headers.get("X-Device-Time"), client_timezone)

    await sync_booking_statuses(session)
    await sync_parking_spot_statuses(session)
    await session.commit()

    if (from_time and not to_time) or (to_time and not from_time):
        raise HTTPException(status_code=400, detail="Both 'from' and 'to' must be provided")

    if from_time is not None:
        from_time = normalize_client_datetime(from_time, client_timezone)
    if to_time is not None:
        to_time = normalize_client_datetime(to_time, client_timezone)

    if from_time and to_time and from_time >= to_time:
        raise HTTPException(status_code=400, detail="'from' must be earlier than 'to'")

    if not from_time and not to_time:
        from_time = device_now
        to_time = from_time

    stmt = select(ParkingSpot)
    if _is_owner(current_user):
        stmt = stmt.join(ParkingLot, ParkingLot.id == ParkingSpot.parking_lot_id).where(
            ParkingLot.owner_id == current_user.id
        )

    res = await session.execute(stmt)
    spots = res.scalars().all()
    return [await _to_spot_out(session, spot, from_time, to_time) for spot in spots]


@router.get("/{parking_spot_id}", response_model=ParkingSpotOut)
async def get_parking_spot(
    parking_spot_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    client_timezone = request.headers.get("X-Timezone")
    device_now = resolve_client_now(request.headers.get("X-Device-Time"), client_timezone)

    await sync_booking_statuses(session)
    await sync_parking_spot_statuses(session, spot_ids=[parking_spot_id])
    await session.commit()

    parking_spot = await _get_spot_or_404(session, parking_spot_id)

    if _is_owner(current_user):
        lot = await _get_lot_or_404(session, parking_spot.parking_lot_id)
        if not _can_owner_manage_spot(current_user, parking_spot, lot):
            raise HTTPException(status_code=403, detail="Not enough permissions")

    return await _to_spot_out(session, parking_spot, device_now, device_now)


@router.patch("/{parking_spot_id}", response_model=ParkingSpotOut)
async def update_parking_spot(
    parking_spot_id: int,
    payload: ParkingSpotUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_spot = await _get_spot_or_404(session, parking_spot_id)
    current_lot = await _get_lot_or_404(session, parking_spot.parking_lot_id)

    if _is_owner(current_user) and not _can_owner_manage_spot(current_user, parking_spot, current_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if payload.parking_lot_id is not None:
        target_lot = await _get_lot_or_404(session, payload.parking_lot_id)
        if _is_owner(current_user) and not _can_owner_manage_lot(current_user, target_lot):
            raise HTTPException(status_code=403, detail="Not enough permissions")

    data = payload.model_dump(exclude_unset=True)
    if _is_owner(current_user):
        data.pop("owner_id", None)

    for field, value in data.items():
        setattr(parking_spot, field, value)

    await session.commit()
    await session.refresh(parking_spot)
    now = _to_db_datetime(datetime.now(timezone.utc))
    return await _to_spot_out(session, parking_spot, now, now)


@router.delete("/{parking_spot_id}", status_code=204)
async def delete_parking_spot(
    parking_spot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_spot = await _get_spot_or_404(session, parking_spot_id)

    if _is_owner(current_user):
        lot = await _get_lot_or_404(session, parking_spot.parking_lot_id)
        if not _can_owner_manage_spot(current_user, parking_spot, lot):
            raise HTTPException(status_code=403, detail="Not enough permissions")

    await session.delete(parking_spot)
    await session.commit()
