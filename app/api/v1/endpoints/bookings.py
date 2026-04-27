from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.booking import Booking, BookingStatus
from app.models.notification import NotificationType
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.models.user import User, UserRole
from app.schemas.booking import BookingCreate, BookingOut, BookingUpdate
from app.schemas.pagination import BookingListResponse, PaginationMeta
from app.services.booking_lifecycle import run_booking_lifecycle_sync, sync_parking_spot_statuses
from app.services.bookings import (
    BOOKING_BLOCKING_STATUSES,
    derive_initial_booking_status,
    ensure_can_manage_booking_operationally,
    normalize_client_datetime,
    server_now_utc_naive,
    sync_booking_statuses,
    to_client_datetime,
    transition_booking_status,
    validate_check_in_window,
    validate_check_out_window,
    validate_manual_no_show,
)
from app.services.parking_rules import get_parking_lot_with_rules, validate_booking_against_lot_rules
from app.services.recommendations import pick_best_spot_for_booking
from app.services.audit import build_source_metadata, log_audit_event
from app.services.notifications import notification_service

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


def _booking_to_out(
    booking: Booking,
    client_timezone: str | None,
    assignment_mode: str = "manual",
    assignment_explanation: str | None = None,
    assignment_metadata: dict | None = None,
    decision_report=None,
) -> BookingOut:
    return BookingOut(
        id=booking.id,
        user_id=booking.user_id,
        parking_spot_id=booking.parking_spot_id,
        type=booking.type,
        status=booking.status,
        plate_number=booking.plate_number,
        start_time=to_client_datetime(booking.start_time, client_timezone),
        end_time=to_client_datetime(booking.end_time, client_timezone),
        assignment_mode=assignment_mode,
        assignment_explanation=assignment_explanation,
        assignment_metadata=assignment_metadata,
        decision_report=decision_report,
    )


@router.post("", response_model=BookingOut, status_code=201)
async def create_booking(
    payload: BookingCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create booking in manual mode (explicit spot) or auto-assign mode."""
    client_timezone = request.headers.get("X-Timezone")
    server_now = server_now_utc_naive()
    start_time = normalize_client_datetime(payload.start_time, client_timezone)
    end_time = normalize_client_datetime(payload.end_time, client_timezone)

    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="start_time must be earlier than end_time")

    await sync_booking_statuses(session, now=server_now)

    assignment_mode = "auto" if payload.auto_assign else "manual"
    assignment_explanation: str | None = None
    assignment_metadata: dict | None = None
    decision_report = None

    if payload.auto_assign:
        parking_lot = await get_parking_lot_with_rules(session, payload.parking_lot_id)
        if parking_lot is None:
            raise HTTPException(status_code=404, detail="ParkingLot not found")

        validate_booking_against_lot_rules(parking_lot, current_user, start_time, end_time)

        best_spot, decision_report = await pick_best_spot_for_booking(
            session=session,
            parking_lot_id=payload.parking_lot_id,
            from_time=start_time,
            to_time=end_time,
            role=current_user.role,
            filters=payload.recommendation_filters,
            preferences=payload.recommendation_preferences,
            weights=payload.recommendation_weights,
        )
        if best_spot is None:
            raise HTTPException(
                status_code=409,
                detail="No suitable parking spot available for requested interval and constraints",
            )

        spot = await _get_spot_or_404(session, best_spot.spot_id)
        selected_spot_id = best_spot.spot_id
        assignment_explanation = (
            f"Автоматически назначено место №{best_spot.spot_number} (id={best_spot.spot_id}) с оценкой {best_spot.score}"
        )
        assignment_metadata = {
            "selected_spot_id": best_spot.spot_id,
            "score": best_spot.score,
        }
    else:
        spot = await _get_spot_or_404(session, payload.parking_spot_id)
        selected_spot_id = payload.parking_spot_id

    if spot.status == SpotStatus.blocked:
        raise HTTPException(status_code=400, detail="Cannot book a blocked parking spot")

    validate_booking_against_lot_rules(spot.parking_lot, current_user, start_time, end_time)

    conflict_result = await session.execute(
        select(Booking.id)
        .where(Booking.parking_spot_id == selected_spot_id)
        .where(Booking.status.in_(BOOKING_BLOCKING_STATUSES))
        .where(_overlap_filter(start_time, end_time))
        .limit(1)
    )
    if conflict_result.scalar_one_or_none() is not None:
        detail = (
            "Auto-assigned parking spot became unavailable, please retry"
            if payload.auto_assign
            else "Booking time overlaps with an existing booking"
        )
        raise HTTPException(status_code=409, detail=detail)

    booking = Booking(
        start_time=start_time,
        end_time=end_time,
        type=payload.type,
        parking_spot_id=selected_spot_id,
        user_id=current_user.id,
        status=derive_initial_booking_status(start_time=start_time, end_time=end_time, now=server_now),
        plate_number=payload.plate_number,
    )
    session.add(booking)
    await session.flush()
    await log_audit_event(
        session,
        action_type="booking.create",
        entity_type="booking",
        entity_id=booking.id,
        actor_user=current_user,
        new_values={
            "parking_spot_id": booking.parking_spot_id,
            "status": booking.status.value,
            "plate_number": booking.plate_number,
            "type": booking.type.value,
            "start_time": booking.start_time.isoformat(),
            "end_time": booking.end_time.isoformat(),
        },
        source_metadata=build_source_metadata(request),
    )
    await notification_service.create_for_booking_event(
        session=session,
        booking=booking,
        event_type=NotificationType.booking_created,
        title="Бронирование создано",
        message=f"Бронирование №{booking.id} успешно создано.",
    )
    if booking.status in {BookingStatus.confirmed, BookingStatus.active}:
        await notification_service.create_for_booking_event(
            session=session,
            booking=booking,
            event_type=NotificationType.booking_confirmed,
            title="Бронирование подтверждено",
            message=f"Бронирование №{booking.id} подтверждено.",
        )
    await sync_parking_spot_statuses(session, spot_ids=[selected_spot_id], now=server_now)
    await session.commit()

    await session.refresh(booking)
    return _booking_to_out(
        booking,
        client_timezone,
        assignment_mode=assignment_mode,
        assignment_explanation=assignment_explanation,
        assignment_metadata=assignment_metadata,
        decision_report=decision_report,
    )


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

    await run_booking_lifecycle_sync(session, now=server_now)
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

    await run_booking_lifecycle_sync(session, now=server_now)
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

    old_status = booking.status
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
    new_values = {
        "start_time": booking.start_time.isoformat(),
        "end_time": booking.end_time.isoformat(),
        "type": booking.type.value,
        "status": booking.status.value,
    }
    action_type = "booking.update"
    if old_status != booking.status:
        action_type = "booking.update_status.manual"
    await log_audit_event(
        session,
        action_type=action_type,
        entity_type="booking",
        entity_id=booking.id,
        actor_user=current_user,
        old_values={"status": old_status.value},
        new_values=new_values,
        source_metadata=build_source_metadata(request),
    )
    if old_status != booking.status:
        if booking.status == BookingStatus.cancelled:
            await notification_service.create_for_booking_event(
                session=session,
                booking=booking,
                event_type=NotificationType.booking_cancelled,
                title="Бронирование отменено",
                message=f"Бронирование №{booking.id} отменено.",
            )
        elif booking.status == BookingStatus.confirmed:
            await notification_service.create_for_booking_event(
                session=session,
                booking=booking,
                event_type=NotificationType.booking_confirmed,
                title="Бронирование подтверждено",
                message=f"Бронирование №{booking.id} подтверждено.",
            )

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

    previous_status = booking.status
    transition_booking_status(booking, BookingStatus.cancelled)
    await log_audit_event(
        session,
        action_type="booking.cancel",
        entity_type="booking",
        entity_id=booking.id,
        actor_user=current_user,
        old_values={"status": previous_status.value},
        new_values={"status": BookingStatus.cancelled.value},
        source_metadata=build_source_metadata(request),
    )
    await notification_service.create_for_booking_event(
        session=session,
        booking=booking,
        event_type=NotificationType.booking_cancelled,
        title="Бронирование отменено",
        message=f"Бронирование №{booking.id} отменено.",
    )
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
    previous_status = booking.status
    transition_booking_status(booking, BookingStatus.active)
    await log_audit_event(
        session,
        action_type="booking.check_in",
        entity_type="booking",
        entity_id=booking.id,
        actor_user=current_user,
        old_values={"status": previous_status.value},
        new_values={"status": BookingStatus.active.value},
        source_metadata=build_source_metadata(request),
    )

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
    previous_status = booking.status
    transition_booking_status(booking, BookingStatus.completed)
    await log_audit_event(
        session,
        action_type="booking.check_out",
        entity_type="booking",
        entity_id=booking.id,
        actor_user=current_user,
        old_values={"status": previous_status.value},
        new_values={"status": BookingStatus.completed.value},
        source_metadata=build_source_metadata(request),
    )

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
    previous_status = booking.status
    transition_booking_status(booking, BookingStatus.no_show)
    await log_audit_event(
        session,
        action_type="booking.update_status.manual",
        entity_type="booking",
        entity_id=booking.id,
        actor_user=current_user,
        old_values={"status": previous_status.value},
        new_values={"status": BookingStatus.no_show.value},
        source_metadata=build_source_metadata(request),
    )
    await notification_service.create_for_booking_event(
        session=session,
        booking=booking,
        event_type=NotificationType.booking_no_show,
        title="Бронирование отмечено как неиспользованное",
        message=f"Бронирование №{booking.id} отмечено как «неявка».",
    )

    await sync_parking_spot_statuses(session, spot_ids=[booking.parking_spot_id], now=server_now)
    await session.commit()
    await session.refresh(booking)
    return _booking_to_out(booking, client_timezone)
