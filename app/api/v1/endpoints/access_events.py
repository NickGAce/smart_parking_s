from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.parking_lot import ParkingLot
from app.models.user import User, UserRole
from app.models.vehicle_access_event import AccessDecision, AccessDirection, ProcessingStatus, VehicleAccessEvent
from app.schemas.access_event import AccessEventListResponse, AccessEventManualIn, AccessEventOut, AccessEventRecognizeIn
from app.schemas.pagination import PaginationMeta
from app.services.access_events import process_access_event, process_manual_access_event, process_recognition_access_event
from app.services.audit import build_source_metadata
from app.services.media_storage import media_storage_service
from app.services.plate_recognition import PlateRecognitionResult
from app.services.plate_recognition_pipeline import plate_recognition_pipeline

router = APIRouter(prefix="/access-events", tags=["access-events"])

ALLOWED_OPERATOR_ROLES = {UserRole.admin, UserRole.owner, UserRole.guard}


def _can_operate(user: User) -> bool:
    return user.role in ALLOWED_OPERATOR_ROLES


def _build_visibility_filter(current_user: User):
    if current_user.role in {UserRole.admin, UserRole.guard}:
        return None
    if current_user.role == UserRole.owner:
        return ParkingLot.owner_id == current_user.id
    return VehicleAccessEvent.user_id == current_user.id


@router.post("/recognize", response_model=AccessEventOut, status_code=201)
async def recognize_access_event(
    payload: AccessEventRecognizeIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_operate(current_user):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    try:
        event = await process_recognition_access_event(
            session,
            actor=current_user,
            parking_lot_id=payload.parking_lot_id,
            direction=payload.direction,
            image_token=payload.image_token,
            plate_number_hint=payload.plate_number_hint,
            request_metadata=build_source_metadata(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return event


@router.post("/recognize/image", response_model=AccessEventOut, status_code=201)
async def recognize_access_event_image(
    request: Request,
    file: UploadFile = File(...),
    parking_lot_id: int = Form(...),
    direction: AccessDirection = Form(...),
    plate_hint: str | None = Form(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_operate(current_user):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    stored = await media_storage_service.save(file, folder="images")
    result = await plate_recognition_pipeline.recognize_from_image(file, plate_hint=plate_hint)
    recognition = PlateRecognitionResult(
        plate_number=result.plate_number,
        normalized_plate_number=result.normalized_plate_number,
        confidence=result.confidence,
        source=result.source,
    )

    event = await process_access_event(
        session,
        actor=current_user,
        parking_lot_id=parking_lot_id,
        direction=direction,
        recognition=recognition,
        request_metadata=build_source_metadata(request),
        image_url=stored.url,
        frame_timestamp=result.frame_timestamp,
        processing_status=ProcessingStatus.processed,
    )
    return event


@router.post("/recognize/video", response_model=AccessEventOut, status_code=201)
async def recognize_access_event_video(
    request: Request,
    file: UploadFile = File(...),
    parking_lot_id: int = Form(...),
    direction: AccessDirection = Form(...),
    plate_hint: str | None = Form(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_operate(current_user):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    stored = await media_storage_service.save(file, folder="videos")
    result = await plate_recognition_pipeline.recognize_from_video(file, plate_hint=plate_hint)
    recognition = PlateRecognitionResult(
        plate_number=result.plate_number,
        normalized_plate_number=result.normalized_plate_number,
        confidence=result.confidence,
        source=result.source,
    )

    event = await process_access_event(
        session,
        actor=current_user,
        parking_lot_id=parking_lot_id,
        direction=direction,
        recognition=recognition,
        request_metadata=build_source_metadata(request),
        video_url=stored.url,
        frame_timestamp=result.frame_timestamp,
        processing_status=ProcessingStatus.processed,
    )
    return event


@router.post("/manual", response_model=AccessEventOut, status_code=201)
async def manual_access_event(
    payload: AccessEventManualIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_operate(current_user):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    try:
        event = await process_manual_access_event(
            session,
            actor=current_user,
            payload=payload,
            request_metadata=build_source_metadata(request),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return event


@router.get("", response_model=AccessEventListResponse)
async def list_access_events(
    parking_lot_id: int | None = None,
    plate_number: str | None = None,
    decision: AccessDecision | None = None,
    direction: AccessDirection | None = None,
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(VehicleAccessEvent).join(ParkingLot, VehicleAccessEvent.parking_lot_id == ParkingLot.id)
    count_stmt = select(func.count(VehicleAccessEvent.id)).select_from(VehicleAccessEvent).join(
        ParkingLot, VehicleAccessEvent.parking_lot_id == ParkingLot.id
    )

    filters = []
    if parking_lot_id is not None:
        filters.append(VehicleAccessEvent.parking_lot_id == parking_lot_id)
    if plate_number:
        filters.append(VehicleAccessEvent.normalized_plate_number == plate_number.upper().replace(" ", "").replace("-", ""))
    if decision is not None:
        filters.append(VehicleAccessEvent.decision == decision)
    if direction is not None:
        filters.append(VehicleAccessEvent.direction == direction)
    if date_from is not None:
        filters.append(VehicleAccessEvent.created_at >= date_from)
    if date_to is not None:
        filters.append(VehicleAccessEvent.created_at <= date_to)

    visibility_filter = _build_visibility_filter(current_user)
    if visibility_filter is not None:
        filters.append(visibility_filter)

    if filters:
        stmt = stmt.where(and_(*filters))
        count_stmt = count_stmt.where(and_(*filters))

    total = (await session.execute(count_stmt)).scalar_one()
    items = (
        await session.execute(stmt.order_by(VehicleAccessEvent.created_at.desc()).limit(limit).offset(offset))
    ).scalars().all()
    return AccessEventListResponse(items=items, meta=PaginationMeta(limit=limit, offset=offset, total=total))


@router.get("/{event_id}", response_model=AccessEventOut)
async def get_access_event(
    event_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    event = (
        await session.execute(
            select(VehicleAccessEvent)
            .join(ParkingLot, VehicleAccessEvent.parking_lot_id == ParkingLot.id)
            .where(VehicleAccessEvent.id == event_id)
        )
    ).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Событие доступа не найдено")

    visibility_filter = _build_visibility_filter(current_user)
    if visibility_filter is not None:
        probe = (
            await session.execute(
                select(VehicleAccessEvent.id)
                .join(ParkingLot, VehicleAccessEvent.parking_lot_id == ParkingLot.id)
                .where(VehicleAccessEvent.id == event_id)
                .where(visibility_filter)
            )
        ).scalar_one_or_none()
        if probe is None:
            raise HTTPException(status_code=403, detail="Недостаточно прав")

    return event
