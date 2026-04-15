from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.db.session import get_session
from app.models.booking import Booking, BookingStatus
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SizeCategory, SpotStatus, SpotType, VehicleType
from app.models.parking_zone import AccessLevel, ParkingZone, ZoneType
from app.models.user import User, UserRole
from app.schemas.pagination import PaginationMeta, ParkingSpotListResponse
from app.schemas.parking_spot import ParkingSpotCreate, ParkingSpotOut, ParkingSpotUpdate
from app.services.bookings import (
    BOOKING_BLOCKING_STATUSES,
    normalize_client_datetime,
    server_now_utc_naive,
    sync_booking_statuses,
    sync_parking_spot_statuses,
    to_db_datetime as _to_db_datetime,
)
from app.services.audit import build_source_metadata, log_audit_event

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
        .where(Booking.status.in_(BOOKING_BLOCKING_STATUSES))
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
        spot_type=spot.spot_type,
        type=spot.type,
        vehicle_type=spot.vehicle_type,
        has_charger=spot.has_charger,
        size_category=spot.size_category,
        zone_id=spot.zone_id,
        zone_name=spot.zone.name if spot.zone else None,
        parking_lot_id=spot.parking_lot_id,
    )


async def _get_spot_or_404(session: AsyncSession, parking_spot_id: int) -> ParkingSpot:
    res = await session.execute(select(ParkingSpot).options(selectinload(ParkingSpot.zone)).where(ParkingSpot.id == parking_spot_id))
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


async def _resolve_zone(
    session: AsyncSession,
    parking_lot_id: int,
    zone_id: int | None,
    zone_name: str | None,
) -> int | None:
    if zone_id is None and not zone_name:
        return None

    if zone_id is not None:
        zone_res = await session.execute(select(ParkingZone).where(ParkingZone.id == zone_id))
        zone = zone_res.scalar_one_or_none()
        if zone is None:
            raise HTTPException(status_code=404, detail="ParkingZone not found")
        if zone.parking_lot_id != parking_lot_id:
            raise HTTPException(status_code=400, detail="Zone must belong to the same parking lot")
        return zone.id

    existing_zone_res = await session.execute(
        select(ParkingZone).where(
            ParkingZone.parking_lot_id == parking_lot_id,
            ParkingZone.name == zone_name,
        )
    )
    existing_zone = existing_zone_res.scalar_one_or_none()
    if existing_zone:
        return existing_zone.id

    new_zone = ParkingZone(
        parking_lot_id=parking_lot_id,
        name=zone_name,
        zone_type=ZoneType.general,
        access_level=AccessLevel.public,
    )
    session.add(new_zone)
    await session.flush()
    return new_zone.id


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
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_lot = await _get_lot_or_404(session, payload.parking_lot_id)

    if _is_owner(current_user) and not _can_owner_manage_lot(current_user, parking_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    zone_id = await _resolve_zone(session, payload.parking_lot_id, payload.zone_id, payload.zone_name)

    parking_spot = ParkingSpot(
        spot_number=payload.spot_number,
        status=SpotStatus.available,
        type=payload.spot_type.value,
        spot_type=payload.spot_type,
        vehicle_type=payload.vehicle_type,
        zone_id=zone_id,
        has_charger=payload.has_charger,
        size_category=payload.size_category,
        parking_lot_id=payload.parking_lot_id,
        owner_id=current_user.id if _is_owner(current_user) else None,
    )

    session.add(parking_spot)
    try:
        await session.flush()
        await log_audit_event(
            session,
            action_type="parking_spot.create",
            entity_type="parking_spot",
            entity_id=parking_spot.id,
            actor_user=current_user,
            new_values=payload.model_dump(mode="json"),
            source_metadata=build_source_metadata(request),
        )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Parking spot with this number already exists in the parking lot",
        )
    await session.refresh(parking_spot)

    now = _to_db_datetime(datetime.now(timezone.utc))
    return await _to_spot_out(session, parking_spot, now, now)


@router.get("", response_model=ParkingSpotListResponse)
async def list_parking_spots(
    request: Request,
    from_time: datetime | None = Query(None, alias="from"),
    to_time: datetime | None = Query(None, alias="to"),
    spot_type: SpotType | None = None,
    vehicle_type: VehicleType | None = None,
    size_category: SizeCategory | None = None,
    has_charger: bool | None = None,
    zone_id: int | None = None,
    zone_name: str | None = None,
    parking_lot_id: int | None = None,
    status: SpotStatus | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_by: Literal["id", "spot_number", "status", "spot_type", "vehicle_type", "size_category"] = Query("id"),
    sort_order: Literal["asc", "desc"] = Query("asc"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    client_timezone = request.headers.get("X-Timezone")
    server_now = server_now_utc_naive()

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
        from_time = server_now
        to_time = from_time

    stmt = select(ParkingSpot).options(selectinload(ParkingSpot.zone)).outerjoin(ParkingZone, ParkingZone.id == ParkingSpot.zone_id)
    count_stmt = select(func.count(ParkingSpot.id)).outerjoin(ParkingZone, ParkingZone.id == ParkingSpot.zone_id)
    if _is_owner(current_user):
        stmt = stmt.join(ParkingLot, ParkingLot.id == ParkingSpot.parking_lot_id).where(
            ParkingLot.owner_id == current_user.id
        )
        count_stmt = count_stmt.join(ParkingLot, ParkingLot.id == ParkingSpot.parking_lot_id).where(
            ParkingLot.owner_id == current_user.id
        )

    if spot_type is not None:
        stmt = stmt.where(ParkingSpot.spot_type == spot_type)
        count_stmt = count_stmt.where(ParkingSpot.spot_type == spot_type)
    if vehicle_type is not None:
        stmt = stmt.where(ParkingSpot.vehicle_type == vehicle_type)
        count_stmt = count_stmt.where(ParkingSpot.vehicle_type == vehicle_type)
    if size_category is not None:
        stmt = stmt.where(ParkingSpot.size_category == size_category)
        count_stmt = count_stmt.where(ParkingSpot.size_category == size_category)
    if has_charger is not None:
        stmt = stmt.where(ParkingSpot.has_charger == has_charger)
        count_stmt = count_stmt.where(ParkingSpot.has_charger == has_charger)
    if zone_id is not None:
        stmt = stmt.where(ParkingSpot.zone_id == zone_id)
        count_stmt = count_stmt.where(ParkingSpot.zone_id == zone_id)
    if zone_name:
        stmt = stmt.where(ParkingZone.name == zone_name)
        count_stmt = count_stmt.where(ParkingZone.name == zone_name)
    if parking_lot_id is not None:
        stmt = stmt.where(ParkingSpot.parking_lot_id == parking_lot_id)
        count_stmt = count_stmt.where(ParkingSpot.parking_lot_id == parking_lot_id)
    if status is not None:
        stmt = stmt.where(ParkingSpot.status == status)
        count_stmt = count_stmt.where(ParkingSpot.status == status)

    sortable_fields = {
        "id": ParkingSpot.id,
        "spot_number": ParkingSpot.spot_number,
        "status": ParkingSpot.status,
        "spot_type": ParkingSpot.spot_type,
        "vehicle_type": ParkingSpot.vehicle_type,
        "size_category": ParkingSpot.size_category,
    }
    order_clause = sortable_fields[sort_by].desc() if sort_order == "desc" else sortable_fields[sort_by].asc()
    total = (await session.execute(count_stmt)).scalar_one()

    res = await session.execute(stmt.order_by(order_clause).limit(limit).offset(offset))
    spots = res.scalars().all()
    items = [await _to_spot_out(session, spot, from_time, to_time) for spot in spots]
    return ParkingSpotListResponse(items=items, meta=PaginationMeta(limit=limit, offset=offset, total=total))


@router.get("/{parking_spot_id}", response_model=ParkingSpotOut)
async def get_parking_spot(
    parking_spot_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    server_now = server_now_utc_naive()

    await sync_booking_statuses(session)
    await sync_parking_spot_statuses(session, spot_ids=[parking_spot_id])
    await session.commit()

    parking_spot = await _get_spot_or_404(session, parking_spot_id)

    if _is_owner(current_user):
        lot = await _get_lot_or_404(session, parking_spot.parking_lot_id)
        if not _can_owner_manage_spot(current_user, parking_spot, lot):
            raise HTTPException(status_code=403, detail="Not enough permissions")

    return await _to_spot_out(session, parking_spot, server_now, server_now)


@router.patch("/{parking_spot_id}", response_model=ParkingSpotOut)
async def update_parking_spot(
    parking_spot_id: int,
    payload: ParkingSpotUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_spot = await _get_spot_or_404(session, parking_spot_id)
    current_lot = await _get_lot_or_404(session, parking_spot.parking_lot_id)

    if _is_owner(current_user) and not _can_owner_manage_spot(current_user, parking_spot, current_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    data = payload.model_dump(exclude_unset=True)

    target_parking_lot_id = data.get("parking_lot_id", parking_spot.parking_lot_id)
    if target_parking_lot_id != parking_spot.parking_lot_id:
        target_lot = await _get_lot_or_404(session, target_parking_lot_id)
        if _is_owner(current_user) and not _can_owner_manage_lot(current_user, target_lot):
            raise HTTPException(status_code=403, detail="Not enough permissions")

    if _is_owner(current_user):
        data.pop("owner_id", None)

    zone_id_from_payload = data.pop("zone_id", None) if "zone_id" in payload.model_fields_set else None
    zone_name_from_payload = data.pop("zone_name", None) if "zone_name" in payload.model_fields_set else None
    if "zone_id" in payload.model_fields_set or "zone_name" in payload.model_fields_set:
        data["zone_id"] = await _resolve_zone(
            session,
            target_parking_lot_id,
            zone_id_from_payload,
            zone_name_from_payload,
        )

    if "spot_type" in data:
        data["type"] = data["spot_type"].value
    elif "type" in payload.model_fields_set and payload.spot_type is not None:
        data["spot_type"] = payload.spot_type
        data["type"] = payload.spot_type.value
    else:
        data.pop("type", None)

    old_values = {k: getattr(parking_spot, k) for k in data.keys()}
    for field, value in data.items():
        setattr(parking_spot, field, value)
    await log_audit_event(
        session,
        action_type="parking_spot.update_status" if "status" in data else "parking_spot.update",
        entity_type="parking_spot",
        entity_id=parking_spot.id,
        actor_user=current_user,
        old_values=old_values,
        new_values=data,
        source_metadata=build_source_metadata(request),
    )

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Parking spot with this number already exists in the parking lot",
        )
    await session.refresh(parking_spot)
    now = _to_db_datetime(datetime.now(timezone.utc))
    return await _to_spot_out(session, parking_spot, now, now)


@router.delete("/{parking_spot_id}", status_code=204)
async def delete_parking_spot(
    parking_spot_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_spot = await _get_spot_or_404(session, parking_spot_id)

    if _is_owner(current_user):
        lot = await _get_lot_or_404(session, parking_spot.parking_lot_id)
        if not _can_owner_manage_spot(current_user, parking_spot, lot):
            raise HTTPException(status_code=403, detail="Not enough permissions")

    await log_audit_event(
        session,
        action_type="parking_spot.delete",
        entity_type="parking_spot",
        entity_id=parking_spot.id,
        actor_user=current_user,
        old_values={
            "spot_number": parking_spot.spot_number,
            "status": parking_spot.status.value if hasattr(parking_spot.status, "value") else str(parking_spot.status),
            "parking_lot_id": parking_spot.parking_lot_id,
        },
        source_metadata=build_source_metadata(request),
    )
    await session.delete(parking_spot)
    await session.commit()
