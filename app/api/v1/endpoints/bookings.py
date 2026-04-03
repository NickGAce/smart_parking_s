from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.booking import Booking, BookingStatus
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.models.user import User, UserRole
from app.schemas.booking import BookingCreate, BookingOut, BookingUpdate
from app.schemas.pagination import BookingListResponse, PaginationMeta
from app.services.bookings import (
    BOOKING_BLOCKING_STATUSES,
    derive_initial_booking_status,
    ensure_can_manage_booking_operationally,
    normalize_client_datetime,
    server_now_utc_naive,
    sync_booking_statuses,
    sync_parking_spot_statuses,
    to_client_datetime,
    transition_booking_status,
    validate_check_in_window,
    validate_check_out_window,
    validate_manual_no_show,
)
from app.services.parking_rules import validate_booking_against_lot_rules

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
    result = await session.execute(
        select(ParkingSpot)
        .options(
            selectinload(ParkingSpot.parking_lot).selectinload(ParkingLot.working_hours),
            selectinload(ParkingSpot.parking_lot).selectinload(ParkingLot.schedule_exceptions),
        )
        .where(ParkingSpot.id == parking_spot_id)
    )
    spot = result.scalar_one_or_none()
    if not spot:
        raise HTTPException(status_code=404, detail="ParkingSpot not found")
    return spot


def _is_admin(user: User) -> bool:
    return user.role == UserRole.admin


def _booking_to_out(booking: Booking, client_timezone: str | None) -> BookingOut:
    return BookingOut(
        id=booking.id,
        user_id=booking.user_id,
        parking_spot_id=booking.parking_spot_id,
        type=booking.type,
        status=booking.status,
        start_time=to_client_datetime(booking.start_time, client_timezone),
        end_time=to_client_datetime(booking.end_time, client_timezone),
    )


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(
    payload: BookingCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create a new booking for a parking spot if time slot is available."""
    client_timezone = request.headers.get("X-Timezone")
    server_now = server_now_utc_naive()
    start_time = normalize_client_datetime(payload.start_time, client_timezone)
    end_time = normalize_client_datetime(payload.end_time, client_timezone)

    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="start_time must be earlier than end_time")

    await sync_booking_statuses(session, now=server_now)

    spot = await _get_spot_or_404(session, payload.parking_spot_id)
    if spot.status == SpotStatus.blocked:
        raise HTTPException(status_code=400, detail="Cannot book a blocked parking spot")

    validate_booking_against_lot_rules(spot.parking_lot, current_user, start_time, end_time)

    conflict_result = await session.execute(
        select(Booking.id)
        .where(Booking.parking_spot_id == payload.parking_spot_id)
        .where(Booking.status.in_(BOOKING_BLOCKING_STATUSES))
        .where(_overlap_filter(start_time, end_time))
        .limit(1)
    )
    if conflict_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Booking time overlaps with an existing booking")

    booking = Booking(
        start_time=start_time,
        end_time=end_time,
        type=payload.type,
        parking_spot_id=payload.parking_spot_id,
        user_id=current_user.id,
        status=derive_initial_booking_status(start_time=start_time, end_time=end_time, now=server_now),
    )
    session.add(booking)
    await session.flush()
    await sync_parking_spot_statuses(session, spot_ids=[payload.parking_spot_id], now=server_now)
    await session.commit()

    await session.refresh(booking)
    return _booking_to_out(booking, client_timezone)


@router.get("", response_model=BookingListResponse)
async def list_bookings(
    request: Request,
    mine: bool = False,
    parking_lot_id: int | None = None,
    parking_spot_id: int | None = None,
    from_time: datetime | None = Query(None, alias="from"),
    to_time: datetime | None = Query(None, alias="to"),
    status: BookingStatus | None = None,
    statuses: list[BookingStatus] | None = Query(default=None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_by: Literal["start_time", "end_time", "status", "id"] = Query("start_time"),
    sort_order: Literal["asc", "desc"] = Query("desc"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List bookings with filters and role-based visibility restrictions."""
    client_timezone = request.headers.get("X-Timezone")
    server_now = server_now_utc_naive()

    await sync_booking_statuses(session, now=server_now)
    await sync_parking_spot_statuses(session, now=server_now)
    await session.commit()

    if from_time is not None:
        from_time = normalize_client_datetime(from_time, client_timezone)
    if to_time is not None:
        to_time = normalize_client_datetime(to_time, client_timezone)

    if from_time is not None and to_time is not None and from_time >= to_time:
        raise HTTPException(status_code=400, detail="'from' must be earlier than 'to'")

    if status is not None and statuses:
        raise HTTPException(status_code=400, detail="Use either status or statuses, not both")

    status_filters = statuses or ([status] if status is not None else None)

    stmt = select(Booking).join(ParkingSpot, Booking.parking_spot_id == ParkingSpot.id)

    if parking_lot_id is not None:
        stmt = stmt.where(ParkingSpot.parking_lot_id == parking_lot_id)
    if parking_spot_id is not None:
        stmt = stmt.where(Booking.parking_spot_id == parking_spot_id)
    if from_time is not None:
        stmt = stmt.where(Booking.end_time > from_time)
    if to_time is not None:
        stmt = stmt.where(Booking.start_time < to_time)
    if status_filters is not None:
        stmt = stmt.where(Booking.status.in_(status_filters))

    if mine:
        stmt = stmt.where(Booking.user_id == current_user.id)
    elif not _is_admin(current_user):
        stmt = stmt.where(
            or_(
                Booking.user_id == current_user.id,
                ParkingSpot.owner_id == current_user.id,
            )
        )

    count_stmt = select(func.count(Booking.id)).select_from(Booking).join(
        ParkingSpot, Booking.parking_spot_id == ParkingSpot.id
    )

    if parking_lot_id is not None:
        count_stmt = count_stmt.where(ParkingSpot.parking_lot_id == parking_lot_id)
    if parking_spot_id is not None:
        count_stmt = count_stmt.where(Booking.parking_spot_id == parking_spot_id)
    if from_time is not None:
        count_stmt = count_stmt.where(Booking.end_time > from_time)
    if to_time is not None:
        count_stmt = count_stmt.where(Booking.start_time < to_time)
    if status_filters is not None:
        count_stmt = count_stmt.where(Booking.status.in_(status_filters))
    if mine:
        count_stmt = count_stmt.where(Booking.user_id == current_user.id)
    elif not _is_admin(current_user):
        count_stmt = count_stmt.where(
            or_(
                Booking.user_id == current_user.id,
                ParkingSpot.owner_id == current_user.id,
            )
        )

    sortable_fields = {
        "id": Booking.id,
        "start_time": Booking.start_time,
        "end_time": Booking.end_time,
        "status": Booking.status,
    }
    order_clause = sortable_fields[sort_by].desc() if sort_order == "desc" else sortable_fields[sort_by].asc()
    total = (await session.execute(count_stmt)).scalar_one()

    result = await session.execute(stmt.order_by(order_clause).limit(limit).offset(offset))
    bookings = result.scalars().all()
    items = [_booking_to_out(booking, client_timezone) for booking in bookings]
    return BookingListResponse(items=items, meta=PaginationMeta(limit=limit, offset=offset, total=total))


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(
    booking_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    client_timezone = request.headers.get("X-Timezone")
    server_now = server_now_utc_naive()

    await sync_booking_statuses(session, now=server_now)
    await sync_parking_spot_statuses(session, now=server_now)
    await session.commit()

    booking = await _get_booking_or_404(session, booking_id)
    spot = await _get_spot_or_404(session, booking.parking_spot_id)

    if not _is_admin(current_user) and booking.user_id != current_user.id and spot.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions to access this booking")

    return _booking_to_out(booking, client_timezone)


@router.patch("/{booking_id}", response_model=BookingOut)
async def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update booking fields and transition lifecycle status with explicit validation."""
    client_timezone = request.headers.get("X-Timezone")
    server_now = server_now_utc_naive()
    next_start_payload = (
        normalize_client_datetime(payload.start_time, client_timezone)
        if payload.start_time is not None
        else None
    )
    next_end_payload = (
        normalize_client_datetime(payload.end_time, client_timezone)
        if payload.end_time is not None
        else None
    )

    if next_start_payload is not None and next_end_payload is not None and next_start_payload >= next_end_payload:
        raise HTTPException(status_code=400, detail="start_time must be earlier than end_time")

    await sync_booking_statuses(session, now=server_now)

    booking = await _get_booking_or_404(session, booking_id)
    if not _is_admin(current_user) and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions to modify this booking")

    next_start = next_start_payload if next_start_payload is not None else booking.start_time
    next_end = next_end_payload if next_end_payload is not None else booking.end_time
    if next_start >= next_end:
        raise HTTPException(status_code=400, detail="start_time must be earlier than end_time")

    if payload.status is not None:
        if payload.status != BookingStatus.cancelled and not _is_admin(current_user):
            raise HTTPException(status_code=403, detail="Only admins can set this booking status")
        transition_booking_status(booking, payload.status)

    if payload.type is not None:
        booking.type = payload.type

    if payload.start_time is not None or payload.end_time is not None:
        spot = await _get_spot_or_404(session, booking.parking_spot_id)
        validate_booking_against_lot_rules(spot.parking_lot, current_user, next_start, next_end)
        overlap_stmt = (
            select(Booking.id)
            .where(Booking.parking_spot_id == booking.parking_spot_id)
            .where(Booking.id != booking.id)
            .where(Booking.status.in_(BOOKING_BLOCKING_STATUSES))
            .where(_overlap_filter(next_start, next_end))
            .limit(1)
        )
        overlap_result = await session.execute(overlap_stmt)
        if overlap_result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Booking time overlaps with an existing booking")

    if next_start_payload is not None:
        booking.start_time = next_start_payload
    if next_end_payload is not None:
        booking.end_time = next_end_payload

    await sync_booking_statuses(session, now=server_now)
    await sync_parking_spot_statuses(session, spot_ids=[booking.parking_spot_id], now=server_now)
    await session.commit()

    await session.refresh(booking)
    return _booking_to_out(booking, client_timezone)


@router.delete("/{booking_id}", status_code=204)
async def cancel_booking(
    booking_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Soft-cancel booking by changing status to cancelled."""
    server_now = server_now_utc_naive()

    await sync_booking_statuses(session, now=server_now)
    booking = await _get_booking_or_404(session, booking_id)
    if not _is_admin(current_user) and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions to cancel this booking")

    transition_booking_status(booking, BookingStatus.cancelled)
    await sync_parking_spot_statuses(session, spot_ids=[booking.parking_spot_id], now=server_now)
    await session.commit()

    return Response(status_code=204)


@router.post("/{booking_id}/check-in", response_model=BookingOut)
async def check_in_booking(
    booking_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    client_timezone = request.headers.get("X-Timezone")
    server_now = server_now_utc_naive()

    await sync_booking_statuses(session, now=server_now)
    booking = await _get_booking_or_404(session, booking_id)
    ensure_can_manage_booking_operationally(current_user, booking)
    validate_check_in_window(booking, server_now)
    transition_booking_status(booking, BookingStatus.active)

    await sync_parking_spot_statuses(session, spot_ids=[booking.parking_spot_id], now=server_now)
    await session.commit()
    await session.refresh(booking)
    return _booking_to_out(booking, client_timezone)


@router.post("/{booking_id}/check-out", response_model=BookingOut)
async def check_out_booking(
    booking_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    client_timezone = request.headers.get("X-Timezone")
    server_now = server_now_utc_naive()

    await sync_booking_statuses(session, now=server_now)
    booking = await _get_booking_or_404(session, booking_id)
    ensure_can_manage_booking_operationally(current_user, booking)
    validate_check_out_window(booking)
    transition_booking_status(booking, BookingStatus.completed)

    await sync_parking_spot_statuses(session, spot_ids=[booking.parking_spot_id], now=server_now)
    await session.commit()
    await session.refresh(booking)
    return _booking_to_out(booking, client_timezone)


@router.post("/{booking_id}/mark-no-show", response_model=BookingOut)
async def mark_booking_no_show(
    booking_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    client_timezone = request.headers.get("X-Timezone")
    server_now = server_now_utc_naive()

    await sync_booking_statuses(session, now=server_now)
    booking = await _get_booking_or_404(session, booking_id)
    ensure_can_manage_booking_operationally(current_user, booking)
    validate_manual_no_show(booking, server_now)
    transition_booking_status(booking, BookingStatus.no_show)

    await sync_parking_spot_statuses(session, spot_ids=[booking.parking_spot_id], now=server_now)
    await session.commit()
    await session.refresh(booking)
    return _booking_to_out(booking, client_timezone)
