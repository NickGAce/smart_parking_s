import asyncio
import os
import sys
from dataclasses import dataclass

from sqlalchemy import delete

# Добавляем корневую директорию проекта в sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Скрипт должен запускаться даже без заранее экспортированных переменных окружения.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./smart_parking.db")
os.environ.setdefault("JWT_SECRET", "local-dev-secret")

from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models.booking import Booking
from app.models.parking_lot import AccessMode, ParkingLot
from app.models.parking_spot import ParkingSpot, SizeCategory, SpotStatus, SpotType, VehicleType
from app.models.parking_zone import AccessLevel, ParkingZone, ZoneType
from app.models.user import UserRole


@dataclass(frozen=True)
class SpotSeed:
    spot_type: SpotType
    vehicle_type: VehicleType
    has_charger: bool
    size_category: SizeCategory
    zone_name: str
    status: SpotStatus = SpotStatus.available


SPOT_BLUEPRINTS: list[SpotSeed] = [
    SpotSeed(SpotType.regular, VehicleType.car, False, SizeCategory.medium, "General A"),
    SpotSeed(SpotType.regular, VehicleType.car, False, SizeCategory.medium, "General A"),
    SpotSeed(SpotType.regular, VehicleType.car, False, SizeCategory.medium, "General A"),
    SpotSeed(SpotType.regular, VehicleType.car, False, SizeCategory.medium, "General A"),
    SpotSeed(SpotType.regular, VehicleType.car, False, SizeCategory.medium, "General A"),
    SpotSeed(SpotType.regular, VehicleType.car, False, SizeCategory.medium, "General A"),
    SpotSeed(SpotType.regular, VehicleType.car, False, SizeCategory.medium, "General A"),
    SpotSeed(SpotType.regular, VehicleType.car, False, SizeCategory.large, "General B"),
    SpotSeed(SpotType.regular, VehicleType.car, False, SizeCategory.large, "General B"),
    SpotSeed(SpotType.regular, VehicleType.truck, False, SizeCategory.large, "General B"),
    SpotSeed(SpotType.regular, VehicleType.truck, False, SizeCategory.large, "General B"),
    SpotSeed(SpotType.guest, VehicleType.car, False, SizeCategory.medium, "Guest"),
    SpotSeed(SpotType.guest, VehicleType.car, False, SizeCategory.medium, "Guest"),
    SpotSeed(SpotType.guest, VehicleType.car, False, SizeCategory.medium, "Guest"),
    SpotSeed(SpotType.guest, VehicleType.car, False, SizeCategory.medium, "Guest"),
    SpotSeed(SpotType.disabled, VehicleType.car, False, SizeCategory.large, "Accessible"),
    SpotSeed(SpotType.disabled, VehicleType.car, False, SizeCategory.large, "Accessible"),
    SpotSeed(SpotType.ev, VehicleType.car, True, SizeCategory.medium, "EV"),
    SpotSeed(SpotType.ev, VehicleType.car, True, SizeCategory.medium, "EV"),
    SpotSeed(SpotType.ev, VehicleType.car, True, SizeCategory.large, "EV"),
    SpotSeed(SpotType.ev, VehicleType.car, True, SizeCategory.large, "EV"),
    SpotSeed(SpotType.vip, VehicleType.car, True, SizeCategory.large, "VIP"),
    SpotSeed(SpotType.vip, VehicleType.car, True, SizeCategory.large, "VIP"),
    SpotSeed(SpotType.reserved, VehicleType.bike, False, SizeCategory.small, "Service", SpotStatus.blocked),
    SpotSeed(SpotType.reserved, VehicleType.bike, False, SizeCategory.small, "Service", SpotStatus.blocked),
]


ZONE_DEFINITIONS = {
    "General A": {"zone_type": ZoneType.general, "access_level": AccessLevel.public},
    "General B": {"zone_type": ZoneType.general, "access_level": AccessLevel.public},
    "Guest": {"zone_type": ZoneType.general, "access_level": AccessLevel.public},
    "Accessible": {"zone_type": ZoneType.service, "access_level": AccessLevel.permit_only},
    "EV": {"zone_type": ZoneType.service, "access_level": AccessLevel.permit_only},
    "VIP": {"zone_type": ZoneType.premium, "access_level": AccessLevel.vip_only},
    "Service": {"zone_type": ZoneType.restricted, "access_level": AccessLevel.employees},
}




async def ensure_schema_exists() -> None:
    """Создаёт таблицы в локальной БД, если они ещё не созданы."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def reseed_parking_data() -> dict[str, int]:
    if len(SPOT_BLUEPRINTS) != 25:
        raise ValueError("SPOT_BLUEPRINTS must contain exactly 25 spots")

    await ensure_schema_exists()

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Порядок важен из-за внешних ключей
            await session.execute(delete(Booking))
            await session.execute(delete(ParkingSpot))
            await session.execute(delete(ParkingZone))
            await session.execute(delete(ParkingLot))

            parking_lot = ParkingLot(
                name="Demo Smart Parking",
                address="1 Enterprise Way, Innovation City",
                total_spots=25,
                guest_spot_percentage=16,
                owner_id=None,
                access_mode=AccessMode.mixed,
                allowed_user_roles=[UserRole.owner.value, UserRole.tenant.value, UserRole.guard.value],
                min_booking_minutes=30,
                max_booking_minutes=480,
                booking_step_minutes=30,
                max_advance_minutes=10080,
            )
            session.add(parking_lot)
            await session.flush()

            zone_ids: dict[str, int] = {}
            for zone_name, config in ZONE_DEFINITIONS.items():
                zone = ParkingZone(
                    parking_lot_id=parking_lot.id,
                    name=zone_name,
                    zone_type=config["zone_type"],
                    access_level=config["access_level"],
                )
                session.add(zone)
                await session.flush()
                zone_ids[zone_name] = zone.id

            for index, blueprint in enumerate(SPOT_BLUEPRINTS, start=1):
                session.add(
                    ParkingSpot(
                        spot_number=index,
                        status=blueprint.status,
                        type=blueprint.spot_type.value,
                        spot_type=blueprint.spot_type,
                        vehicle_type=blueprint.vehicle_type,
                        has_charger=blueprint.has_charger,
                        size_category=blueprint.size_category,
                        zone_id=zone_ids[blueprint.zone_name],
                        parking_lot_id=parking_lot.id,
                        owner_id=None,
                    )
                )

    return {
        "parking_lots": 1,
        "parking_spots": len(SPOT_BLUEPRINTS),
        "bookings": 0,
    }


async def main() -> None:
    result = await reseed_parking_data()
    print(
        "Parking data reseeded: "
        f"lots={result['parking_lots']}, spots={result['parking_spots']}, bookings={result['bookings']}"
    )


if __name__ == "__main__":
    asyncio.run(main())
