from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleOut, VehicleUpdate
from app.services.audit import build_source_metadata, log_audit_event
from app.services.plate_recognition import normalize_plate_number
from app.services.vehicles import ensure_vehicle_access, normalize_vehicle_primary_flags

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _is_admin(user: User) -> bool:
    return user.role == UserRole.admin


@router.post("", response_model=VehicleOut, status_code=201)
async def create_vehicle(
    payload: VehicleCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    vehicle = Vehicle(
        user_id=current_user.id,
        plate_number=payload.plate_number,
        normalized_plate_number=normalize_plate_number(payload.plate_number),
        vehicle_type=payload.vehicle_type,
        brand=payload.brand,
        model=payload.model,
        color=payload.color,
        is_primary=payload.is_primary,
        is_active=payload.is_active,
    )
    session.add(vehicle)
    await session.flush()

    if payload.is_primary:
        await normalize_vehicle_primary_flags(session, current_user.id, vehicle.id)

    await log_audit_event(
        session,
        action_type="vehicle.create",
        entity_type="vehicle",
        entity_id=vehicle.id,
        actor_user=current_user,
        new_values={"plate_number": vehicle.plate_number, "vehicle_type": vehicle.vehicle_type.value},
        source_metadata=build_source_metadata(request),
    )
    await session.commit()
    await session.refresh(vehicle)
    return vehicle


@router.get("", response_model=list[VehicleOut])
async def list_vehicles(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Vehicle)
    if not _is_admin(current_user):
        stmt = stmt.where(Vehicle.user_id == current_user.id)
    vehicles = (await session.execute(stmt.order_by(Vehicle.is_primary.desc(), Vehicle.id.asc()))).scalars().all()
    return vehicles


@router.patch("/{vehicle_id}", response_model=VehicleOut)
async def update_vehicle(
    vehicle_id: int,
    payload: VehicleUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    vehicle = (await session.execute(select(Vehicle).where(Vehicle.id == vehicle_id))).scalar_one_or_none()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    try:
        await ensure_vehicle_access(vehicle, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    old_values = {
        "plate_number": vehicle.plate_number,
        "vehicle_type": vehicle.vehicle_type.value,
        "is_primary": vehicle.is_primary,
        "is_active": vehicle.is_active,
    }

    data = payload.model_dump(exclude_unset=True)
    if "plate_number" in data:
        vehicle.plate_number = data["plate_number"]
        vehicle.normalized_plate_number = normalize_plate_number(data["plate_number"])
    for field in ["vehicle_type", "brand", "model", "color", "is_primary", "is_active"]:
        if field in data:
            setattr(vehicle, field, data[field])

    if vehicle.is_primary:
        await normalize_vehicle_primary_flags(session, vehicle.user_id, vehicle.id)

    await log_audit_event(
        session,
        action_type="vehicle.update",
        entity_type="vehicle",
        entity_id=vehicle.id,
        actor_user=current_user,
        old_values=old_values,
        new_values={
            "plate_number": vehicle.plate_number,
            "vehicle_type": vehicle.vehicle_type.value,
            "is_primary": vehicle.is_primary,
            "is_active": vehicle.is_active,
        },
        source_metadata=build_source_metadata(request),
    )

    await session.commit()
    await session.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=204)
async def delete_vehicle(
    vehicle_id: int,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    vehicle = (await session.execute(select(Vehicle).where(Vehicle.id == vehicle_id))).scalar_one_or_none()
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    try:
        await ensure_vehicle_access(vehicle, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    await log_audit_event(
        session,
        action_type="vehicle.delete",
        entity_type="vehicle",
        entity_id=vehicle.id,
        actor_user=current_user,
        old_values={"plate_number": vehicle.plate_number},
        source_metadata=build_source_metadata(request),
    )
    await session.delete(vehicle)
    await session.commit()
