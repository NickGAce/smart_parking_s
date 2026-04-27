from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.vehicle_access_event import AccessDecision, AccessDirection, VehicleAccessEvent
from app.models.parking_lot import ParkingLot
from app.models.user import User, UserRole
from app.schemas.access_event import AccessEventListResponse, AccessEventManualIn, AccessEventOut, AccessEventRecognizeIn
from app.schemas.pagination import PaginationMeta
from app.services.access_events import process_manual_access_event, process_recognition_access_event
from app.services.audit import build_source_metadata

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


@router.post('/recognize', response_model=AccessEventOut, status_code=201)
async def recognize_access_event(
    payload: AccessEventRecognizeIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_operate(current_user):
        raise HTTPException(status_code=403, detail='Not enough permissions')

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


@router.post('/manual', response_model=AccessEventOut, status_code=201)
async def manual_access_event(
    payload: AccessEventManualIn,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not _can_operate(current_user):
        raise HTTPException(status_code=403, detail='Not enough permissions')

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


@router.get('', response_model=AccessEventListResponse)
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
        filters.append(VehicleAccessEvent.normalized_plate_number == plate_number.upper().replace(' ', '').replace('-', ''))
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


@router.get('/{event_id}', response_model=AccessEventOut)
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
        raise HTTPException(status_code=404, detail='Access event not found')

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
            raise HTTPException(status_code=403, detail='Not enough permissions')

    return event
