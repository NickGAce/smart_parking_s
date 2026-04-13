from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.db.session import get_session
from app.models.parking_lot import ParkingLot
from app.models.user import User, UserRole
from app.schemas.parking_lot import (
    ParkingLotCreate,
    ParkingLotOut,
    ParkingLotRulesOut,
    ParkingLotRulesUpdate,
    ParkingLotUpdate,
)
from app.schemas.pagination import PaginationMeta, ParkingLotListResponse
from app.services.parking_rules import get_parking_lot_with_rules, replace_rules
from app.services.audit import build_source_metadata, log_audit_event

router = APIRouter(prefix="/parking", tags=["parking"])


async def _get_parking_lot_or_404(session: AsyncSession, parking_lot_id: int) -> ParkingLot:
    res = await session.execute(select(ParkingLot).where(ParkingLot.id == parking_lot_id))
    parking_lot = res.scalar_one_or_none()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="ParkingLot not found")
    return parking_lot


def _is_admin(user: User) -> bool:
    return user.role == UserRole.admin


def _can_access_parking_lot(user: User, parking_lot: ParkingLot) -> bool:
    return _is_admin(user) or parking_lot.owner_id == user.id


@router.post("", response_model=ParkingLotOut, status_code=201)
async def create_parking_lot(
    payload: ParkingLotCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_lot = ParkingLot(
        name=payload.name,
        address=payload.address,
        total_spots=payload.total_spots,
        guest_spot_percentage=payload.guest_spot_percentage,
        owner_id=current_user.id if current_user.role == UserRole.owner else None,
        access_mode=payload.access_mode,
        allowed_user_roles=[role.value for role in payload.allowed_user_roles],
        min_booking_minutes=payload.min_booking_minutes,
        max_booking_minutes=payload.max_booking_minutes,
        booking_step_minutes=payload.booking_step_minutes,
        max_advance_minutes=payload.max_advance_minutes,
    )
    session.add(parking_lot)
    await session.flush()
    await log_audit_event(
        session,
        action_type="parking_lot.create",
        entity_type="parking_lot",
        entity_id=parking_lot.id,
        actor_user=current_user,
        new_values=payload.model_dump(mode="json"),
        source_metadata=build_source_metadata(request),
    )
    await session.commit()
    await session.refresh(parking_lot)
    return parking_lot


@router.get("", response_model=ParkingLotListResponse)
async def list_parking_lots(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("id"),
    sort_order: str = Query("asc"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(ParkingLot)
    count_stmt = select(func.count(ParkingLot.id))

    if current_user.role == UserRole.owner:
        stmt = stmt.where(ParkingLot.owner_id == current_user.id)
        count_stmt = count_stmt.where(ParkingLot.owner_id == current_user.id)

    sortable_fields = {
        "id": ParkingLot.id,
        "name": ParkingLot.name,
        "total_spots": ParkingLot.total_spots,
    }
    sort_column = sortable_fields.get(sort_by, ParkingLot.id)
    order_clause = sort_column.desc() if sort_order.lower() == "desc" else sort_column.asc()

    total = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(order_clause).limit(limit).offset(offset)

    res = await session.execute(stmt)
    items = res.scalars().all()
    return ParkingLotListResponse(items=items, meta=PaginationMeta(limit=limit, offset=offset, total=total))


@router.get("/{parking_lot_id}", response_model=ParkingLotOut)
async def get_parking_lot(
    parking_lot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    parking_lot = await _get_parking_lot_or_404(session, parking_lot_id)

    if current_user.role == UserRole.owner and not _can_access_parking_lot(current_user, parking_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return parking_lot


@router.patch("/{parking_lot_id}", response_model=ParkingLotOut)
async def update_parking_lot(
    parking_lot_id: int,
    payload: ParkingLotUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_lot = await _get_parking_lot_or_404(session, parking_lot_id)

    if not _can_access_parking_lot(current_user, parking_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    data = payload.model_dump(exclude_unset=True)
    old_values = {field: getattr(parking_lot, field) for field in data.keys()}
    if "allowed_user_roles" in data and data["allowed_user_roles"] is not None:
        data["allowed_user_roles"] = [role.value for role in data["allowed_user_roles"]]
    for field, value in data.items():
        setattr(parking_lot, field, value)
    await log_audit_event(
        session,
        action_type="parking_lot.update",
        entity_type="parking_lot",
        entity_id=parking_lot.id,
        actor_user=current_user,
        old_values=old_values,
        new_values=data,
        source_metadata=build_source_metadata(request),
    )

    await session.commit()
    await session.refresh(parking_lot)
    return parking_lot


@router.get("/{parking_lot_id}/rules", response_model=ParkingLotRulesOut)
async def get_parking_lot_rules(
    parking_lot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    parking_lot = await get_parking_lot_with_rules(session, parking_lot_id)
    if parking_lot is None:
        raise HTTPException(status_code=404, detail="ParkingLot not found")
    if current_user.role == UserRole.owner and not _can_access_parking_lot(current_user, parking_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return ParkingLotRulesOut(
        parking_lot_id=parking_lot.id,
        access_mode=parking_lot.access_mode,
        allowed_user_roles=parking_lot.allowed_user_roles,
        min_booking_minutes=parking_lot.min_booking_minutes,
        max_booking_minutes=parking_lot.max_booking_minutes,
        booking_step_minutes=parking_lot.booking_step_minutes,
        max_advance_minutes=parking_lot.max_advance_minutes,
        working_hours=parking_lot.working_hours,
        exceptions=parking_lot.schedule_exceptions,
    )


@router.put("/{parking_lot_id}/rules", response_model=ParkingLotRulesOut)
async def update_parking_lot_rules(
    parking_lot_id: int,
    payload: ParkingLotRulesUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_lot = await get_parking_lot_with_rules(session, parking_lot_id)
    if parking_lot is None:
        raise HTTPException(status_code=404, detail="ParkingLot not found")
    if not _can_access_parking_lot(current_user, parking_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    replace_rules(
        parking_lot=parking_lot,
        access_mode=payload.access_mode,
        allowed_user_roles=payload.allowed_user_roles,
        min_booking_minutes=payload.min_booking_minutes,
        max_booking_minutes=payload.max_booking_minutes,
        booking_step_minutes=payload.booking_step_minutes,
        max_advance_minutes=payload.max_advance_minutes,
        working_hours=payload.working_hours,
        exceptions=payload.exceptions,
    )
    await session.commit()
    await session.refresh(parking_lot)
    parking_lot = await get_parking_lot_with_rules(session, parking_lot_id)
    return ParkingLotRulesOut(
        parking_lot_id=parking_lot.id,
        access_mode=parking_lot.access_mode,
        allowed_user_roles=parking_lot.allowed_user_roles,
        min_booking_minutes=parking_lot.min_booking_minutes,
        max_booking_minutes=parking_lot.max_booking_minutes,
        booking_step_minutes=parking_lot.booking_step_minutes,
        max_advance_minutes=parking_lot.max_advance_minutes,
        working_hours=parking_lot.working_hours,
        exceptions=parking_lot.schedule_exceptions,
    )


@router.delete("/{parking_lot_id}", status_code=204)
async def delete_parking_lot(
    parking_lot_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_lot = await _get_parking_lot_or_404(session, parking_lot_id)

    if not _can_access_parking_lot(current_user, parking_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    old_values = {
        "name": parking_lot.name,
        "address": parking_lot.address,
        "total_spots": parking_lot.total_spots,
    }
    await log_audit_event(
        session,
        action_type="parking_lot.delete",
        entity_type="parking_lot",
        entity_id=parking_lot.id,
        actor_user=current_user,
        old_values=old_values,
        source_metadata=build_source_metadata(request),
    )
    await session.delete(parking_lot)
    await session.commit()
