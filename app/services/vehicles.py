from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.services.plate_recognition import normalize_plate_number


async def ensure_vehicle_access(vehicle: Vehicle, current_user: User) -> None:
    if current_user.role == UserRole.admin:
        return
    if vehicle.user_id != current_user.id:
        raise PermissionError("Недостаточно прав")


async def find_primary_vehicle(session: AsyncSession, user_id: int) -> Vehicle | None:
    result = await session.execute(
        select(Vehicle)
        .where(Vehicle.user_id == user_id)
        .where(Vehicle.is_active.is_(True))
        .order_by(Vehicle.is_primary.desc(), Vehicle.id.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def normalize_vehicle_primary_flags(session: AsyncSession, user_id: int, vehicle_id: int) -> None:
    vehicles = (
        await session.execute(select(Vehicle).where(Vehicle.user_id == user_id).where(Vehicle.is_active.is_(True)))
    ).scalars().all()
    for vehicle in vehicles:
        vehicle.is_primary = vehicle.id == vehicle_id


async def apply_vehicle_plate(vehicle: Vehicle, plate_number: str) -> None:
    vehicle.plate_number = plate_number
    vehicle.normalized_plate_number = normalize_plate_number(plate_number)
