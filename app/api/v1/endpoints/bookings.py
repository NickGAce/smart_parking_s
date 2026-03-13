from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.booking import Booking, BookingStatus
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.models.user import User, UserRole
from app.schemas.booking import BookingCreate, BookingOut, BookingUpdate

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _overlap_filter(start_time: datetime, end_time: datetime):
    return and_(Booking.end_time > start_time, Booking.start_time < end_time)


async def _get_booking_or_404(session: AsyncSession, booking_id: int) -> Booking:
    result = await session.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


async def _get_spot_or_404(session: AsyncSession, parking_spot_id: int) -> ParkingSpot:
    result = await session.execute(select(ParkingSpot).where(ParkingSpot.id == parking_spot_id))
    spot = result.scalar_one_or_none()
    if not spot:
        raise HTTPException(status_code=404, detail="ParkingSpot not found")
    return spot


def _is_admin(user: User) -> bool:
    return user.role == UserRole.admin


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(
    payload: BookingCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new booking for a parking spot if time slot is available."""
    if payload.start_time >= payload.end_time:
        raise HTTPException(status_code=400, detail="start_time must be earlier than end_time")

    try:
        spot = await _get_spot_or_404(session, payload.parking_spot_id)
        if spot.status == SpotStatus.blocked:
            raise HTTPException(status_code=400, detail="Cannot book a blocked parking spot")

        conflict_result = await session.execute(
            select(Booking.id)
            .where(Booking.parking_spot_id == payload.parking_spot_id)
            .where(Booking.status == BookingStatus.active)
            .where(_overlap_filter(payload.start_time, payload.end_time))
            .limit(1)
        )
        if conflict_result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Booking time overlaps with an existing booking")

        booking = Booking(
            start_time=payload.start_time,
            end_time=payload.end_time,
            type=payload.type,
            parking_spot_id=payload.parking_spot_id,
            user_id=current_user.id,
            status=BookingStatus.active,
        )
        session.add(booking)
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await session.refresh(booking)
    return booking


@router.get("", response_model=list[BookingOut])
async def list_bookings(
    mine: bool = False,
    parking_lot_id: int | None = None,
    parking_spot_id: int | None = None,
    from_time: datetime | None = Query(None, alias="from"),
    to_time: datetime | None = Query(None, alias="to"),
    status: BookingStatus | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List bookings with filters and role-based visibility restrictions."""
    if from_time is not None and to_time is not None and from_time >= to_time:
        raise HTTPException(status_code=400, detail="'from' must be earlier than 'to'")

    stmt = select(Booking).join(ParkingSpot, Booking.parking_spot_id == ParkingSpot.id)

    if parking_lot_id is not None:
        stmt = stmt.where(ParkingSpot.parking_lot_id == parking_lot_id)
    if parking_spot_id is not None:
        stmt = stmt.where(Booking.parking_spot_id == parking_spot_id)
    if from_time is not None:
        stmt = stmt.where(Booking.end_time > from_time)
    if to_time is not None:
        stmt = stmt.where(Booking.start_time < to_time)
    if status is not None:
        stmt = stmt.where(Booking.status == status)

    if mine:
        stmt = stmt.where(Booking.user_id == current_user.id)
    elif not _is_admin(current_user):
        stmt = stmt.where(
            or_(
                Booking.user_id == current_user.id,
                ParkingSpot.owner_id == current_user.id,
            )
        )

    result = await session.execute(stmt.order_by(Booking.start_time.desc()))
    return result.scalars().all()


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    booking = await _get_booking_or_404(session, booking_id)
    spot = await _get_spot_or_404(session, booking.parking_spot_id)

    if not _is_admin(current_user) and booking.user_id != current_user.id and spot.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions to access this booking")

    return booking


@router.patch("/{booking_id}", response_model=BookingOut)
async def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update booking times or cancel booking based on access rules."""
    if payload.start_time is not None and payload.end_time is not None and payload.start_time >= payload.end_time:
        raise HTTPException(status_code=400, detail="start_time must be earlier than end_time")

    try:
        booking = await _get_booking_or_404(session, booking_id)
        if not _is_admin(current_user) and booking.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions to modify this booking")

        next_start = payload.start_time if payload.start_time is not None else booking.start_time
        next_end = payload.end_time if payload.end_time is not None else booking.end_time
        if next_start >= next_end:
            raise HTTPException(status_code=400, detail="start_time must be earlier than end_time")

        if payload.status == BookingStatus.cancelled:
            booking.status = BookingStatus.cancelled
        elif payload.status is not None and not _is_admin(current_user):
            raise HTTPException(status_code=403, detail="Only admins can set this booking status")
        elif payload.status is not None:
            booking.status = payload.status

        if payload.start_time is not None:
            booking.start_time = payload.start_time
        if payload.end_time is not None:
            booking.end_time = payload.end_time

        if payload.start_time is not None or payload.end_time is not None:
            overlap_stmt = (
                select(Booking.id)
                .where(Booking.parking_spot_id == booking.parking_spot_id)
                .where(Booking.id != booking.id)
                .where(Booking.status == BookingStatus.active)
                .where(_overlap_filter(next_start, next_end))
                .limit(1)
            )
            overlap_result = await session.execute(overlap_stmt)
            if overlap_result.scalar_one_or_none() is not None:
                raise HTTPException(status_code=409, detail="Booking time overlaps with an existing booking")
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    await session.refresh(booking)
    return booking


@router.delete("/{booking_id}", status_code=204)
async def cancel_booking(
    booking_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Soft-cancel booking by changing status to cancelled."""
    try:
        booking = await _get_booking_or_404(session, booking_id)
        if not _is_admin(current_user) and booking.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions to cancel this booking")
        booking.status = BookingStatus.cancelled
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    return Response(status_code=204)
