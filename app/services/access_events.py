from __future__ import annotations

from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.notification import NotificationType
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.models.vehicle_access_event import (
    AccessDecision,
    AccessDirection,
    ProcessingStatus,
    RecognitionSource,
    VehicleAccessEvent,
)
from app.schemas.access_event import AccessEventManualIn
from app.services.audit import log_audit_event
from app.services.booking_lifecycle import sync_booking_statuses, sync_parking_spot_statuses
from app.services.bookings import transition_booking_status
from app.services.notifications import NotificationPayload, notification_service
from app.services.plate_recognition import PlateRecognitionResult, normalize_plate_number, plate_recognition_service

LOW_CONFIDENCE_THRESHOLD = 0.7


async def _find_vehicle_by_plate(session: AsyncSession, normalized_plate_number: str) -> Vehicle | None:
    return (
        await session.execute(
            select(Vehicle)
            .where(Vehicle.normalized_plate_number == normalized_plate_number)
            .where(Vehicle.is_active.is_(True))
            .limit(1)
        )
    ).scalar_one_or_none()


async def _find_candidate_booking(
    session: AsyncSession,
    *,
    parking_lot_id: int,
    normalized_plate_number: str,
    direction: AccessDirection,
    vehicle: Vehicle | None,
) -> Booking | None:
    statuses = (
        [BookingStatus.active]
        if direction == AccessDirection.exit
        else [BookingStatus.confirmed, BookingStatus.pending, BookingStatus.active]
    )

    stmt = (
        select(Booking)
        .join(ParkingSpot, Booking.parking_spot_id == ParkingSpot.id)
        .where(ParkingSpot.parking_lot_id == parking_lot_id)
        .where(Booking.status.in_(statuses))
        .order_by(Booking.start_time.asc())
    )

    if vehicle is not None:
        stmt = stmt.where(or_(Booking.vehicle_id == vehicle.id, Booking.user_id == vehicle.user_id))

    bookings = (await session.execute(stmt)).scalars().all()
    for booking in bookings:
        if booking.plate_number and normalize_plate_number(booking.plate_number) == normalized_plate_number:
            return booking
        if vehicle and booking.vehicle_id == vehicle.id:
            return booking
    return None


async def _notify_security_team(
    session: AsyncSession,
    *,
    parking_lot: ParkingLot,
    title: str,
    message: str,
    booking_id: int | None = None,
) -> None:
    users_stmt = select(User).where(
        or_(User.role.in_([UserRole.admin, UserRole.guard]), User.id == parking_lot.owner_id)
    )
    users = (await session.execute(users_stmt)).scalars().all()

    seen: set[int] = set()
    for user in users:
        if user.id in seen:
            continue
        seen.add(user.id)
        await notification_service.create_notification(
            session,
            NotificationPayload(
                user_id=user.id,
                booking_id=booking_id,
                type=NotificationType.parking_rules_violation,
                title=title,
                message=message,
            ),
        )


async def process_manual_access_event(
    session: AsyncSession,
    *,
    actor: User,
    payload: AccessEventManualIn,
    request_metadata: dict | None,
) -> VehicleAccessEvent:
    normalized_plate = normalize_plate_number(payload.plate_number)
    recognition = PlateRecognitionResult(
        plate_number=payload.plate_number,
        normalized_plate_number=normalized_plate,
        confidence=payload.recognition_confidence,
        source=RecognitionSource.manual,
    )
    return await process_access_event(
        session=session,
        actor=actor,
        parking_lot_id=payload.parking_lot_id,
        direction=payload.direction,
        recognition=recognition,
        request_metadata=request_metadata,
    )


async def process_recognition_access_event(
    session: AsyncSession,
    *,
    actor: User,
    parking_lot_id: int,
    direction: AccessDirection,
    image_token: str | None,
    plate_number_hint: str | None,
    request_metadata: dict | None,
) -> VehicleAccessEvent:
    recognition = await plate_recognition_service.recognize(
        image_token=image_token,
        plate_number_hint=plate_number_hint,
    )
    return await process_access_event(
        session=session,
        actor=actor,
        parking_lot_id=parking_lot_id,
        direction=direction,
        recognition=recognition,
        request_metadata=request_metadata,
    )


async def process_access_event(
    session: AsyncSession,
    *,
    actor: User,
    parking_lot_id: int,
    direction: AccessDirection,
    recognition: PlateRecognitionResult,
    request_metadata: dict | None,
    image_url: str | None = None,
    video_url: str | None = None,
    frame_timestamp: float | None = None,
    processing_status: ProcessingStatus = ProcessingStatus.processed,
    decision_override: AccessDecision | None = None,
    reason_override: str | None = None,
    recognition_provider: str | None = None,
) -> VehicleAccessEvent:
    await sync_booking_statuses(session)

    parking_lot = (
        await session.execute(select(ParkingLot).where(ParkingLot.id == parking_lot_id))
    ).scalar_one_or_none()
    if parking_lot is None:
        raise ValueError("Parking lot not found")

    vehicle = await _find_vehicle_by_plate(session, recognition.normalized_plate_number)
    booking = await _find_candidate_booking(
        session,
        parking_lot_id=parking_lot_id,
        normalized_plate_number=recognition.normalized_plate_number,
        direction=direction,
        vehicle=vehicle,
    )

    decision = AccessDecision.review
    reason = "Требуется ручная проверка"

    if recognition.confidence is not None and recognition.confidence < LOW_CONFIDENCE_THRESHOLD:
        decision = AccessDecision.review
        reason = "Низкая уверенность распознавания номера"
    elif direction == AccessDirection.entry:
        if booking is None:
            decision = AccessDecision.review
            reason = "Номер не связан с активными бронированиями"
        elif booking.status == BookingStatus.active:
            decision = AccessDecision.allowed
            reason = "Бронирование уже активно"
        else:
            if booking.status == BookingStatus.pending:
                transition_booking_status(booking, BookingStatus.confirmed)
            transition_booking_status(booking, BookingStatus.active)
            decision = AccessDecision.allowed
            reason = "Выполнено автоматическое подтверждение въезда"
    else:
        if booking is None:
            decision = AccessDecision.denied
            reason = "Для выезда не найдено активное бронирование"
        else:
            transition_booking_status(booking, BookingStatus.completed)
            decision = AccessDecision.allowed
            reason = "Выполнено автоматическое подтверждение выезда"

    if decision_override is not None:
        decision = decision_override
    if reason_override is not None:
        reason = reason_override

    event = VehicleAccessEvent(
        parking_lot_id=parking_lot_id,
        parking_spot_id=booking.parking_spot_id if booking else None,
        booking_id=booking.id if booking else None,
        user_id=(vehicle.user_id if vehicle else (booking.user_id if booking else None)),
        vehicle_id=vehicle.id if vehicle else (booking.vehicle_id if booking else None),
        plate_number=recognition.plate_number,
        normalized_plate_number=recognition.normalized_plate_number,
        direction=direction,
        recognition_confidence=recognition.confidence,
        recognition_source=recognition.source,
        recognition_provider=recognition_provider,
        image_url=image_url,
        video_url=video_url,
        frame_timestamp=frame_timestamp,
        processing_status=processing_status,
        decision=decision,
        reason=reason,
    )
    session.add(event)
    await session.flush()

    if booking is not None:
        await sync_parking_spot_statuses(session, spot_ids=[booking.parking_spot_id], now=datetime.utcnow())

    if decision in {AccessDecision.review, AccessDecision.denied}:
        await _notify_security_team(
            session,
            parking_lot=parking_lot,
            title="Событие контроля доступа требует внимания",
            message=f"{reason}. Парковка: {parking_lot.name}, номер: {recognition.plate_number}.",
            booking_id=booking.id if booking else None,
        )

    action_type = "anpr.access_event"
    if vehicle is None:
        action_type = "anpr.unknown_plate_detected"

    await log_audit_event(
        session,
        action_type=action_type,
        entity_type="parking_lot",
        entity_id=parking_lot_id,
        actor_user=actor,
        new_values={
            "event_id": event.id,
            "decision": decision.value,
            "direction": direction.value,
            "plate_status": "unknown" if vehicle is None else "known",
            "vehicle_id": event.vehicle_id,
            "booking_id": event.booking_id,
        },
        source_metadata={
            **(request_metadata or {}),
            "plate_number": recognition.plate_number,
            "normalized_plate_number": recognition.normalized_plate_number,
            "recognition_source": recognition.source.value,
            "confidence": recognition.confidence,
            "unknown_plate": vehicle is None,
            "image_url": image_url,
            "video_url": video_url,
            "frame_timestamp": frame_timestamp,
            "processing_status": processing_status.value,
        },
    )

    await session.commit()
    await session.refresh(event)
    return event
