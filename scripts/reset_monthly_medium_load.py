import argparse
import asyncio
import os
import random
import sys
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any

from pydantic_core import ValidationError
from sqlalchemy import delete, select

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.booking import Booking, BookingStatus, BookingType
from app.models.notification import Notification
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot
from app.models.user import User
from app.models.vehicle_access_event import VehicleAccessEvent

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_project_env_file() -> None:
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_project_env_file()
AsyncSessionLocal: Any = None


def init_session_factory() -> Any:
    global AsyncSessionLocal
    if AsyncSessionLocal is not None:
        return AsyncSessionLocal

    try:
        from app.db.session import AsyncSessionLocal as session_local
    except ValidationError as exc:
        raise RuntimeError("Settings are not configured. Provide DATABASE_URL and JWT_SECRET via .env.") from exc

    AsyncSessionLocal = session_local
    return AsyncSessionLocal


async def reset_monthly_medium_load(parking_lot_id: int, target_occupancy: float, random_seed: int) -> tuple[int, int, int, int]:
    session_factory = init_session_factory()
    rng = random.Random(random_seed)
    now = datetime.now(timezone.utc).replace(tzinfo=None, second=0, microsecond=0)
    start_date = (now - timedelta(days=30)).date()

    async with session_factory() as session:
        lot = await session.get(ParkingLot, parking_lot_id)
        if lot is None:
            raise RuntimeError(f"Parking lot with id={parking_lot_id} not found.")

        deleted_notifications = (
            await session.execute(delete(Notification).where(Notification.booking_id.is_not(None)))
        ).rowcount or 0
        deleted_access_events = (
            await session.execute(delete(VehicleAccessEvent).where(VehicleAccessEvent.booking_id.is_not(None)))
        ).rowcount or 0
        deleted_count = (await session.execute(delete(Booking))).rowcount or 0

        spot_ids = list(
            (await session.execute(select(ParkingSpot.id).where(ParkingSpot.parking_lot_id == parking_lot_id).order_by(ParkingSpot.id.asc())))
            .scalars()
            .all()
        )
        user_ids = list((await session.execute(select(User.id).order_by(User.id.asc()))).scalars().all())

        if not spot_ids:
            raise RuntimeError(f"No parking spots found for parking_lot_id={parking_lot_id}.")
        if not user_ids:
            raise RuntimeError("No users found. Create at least one user before seeding bookings.")

        created = 0
        day_cursor = datetime.combine(start_date, time.min)
        end_time = now
        while day_cursor < end_time:
            is_weekend = day_cursor.weekday() >= 5
            day_factor = 0.85 if is_weekend else 1.0
            start_hour = 9 if is_weekend else 8
            end_hour = 18 if is_weekend else 20

            for hour in range(start_hour, end_hour):
                slot_start = day_cursor + timedelta(hours=hour)
                slot_end = min(slot_start + timedelta(hours=1), end_time)
                if slot_end <= slot_start:
                    continue

                diurnal = 0.95 if 11 <= hour <= 16 else 0.75
                base_ratio = max(0.05, min(0.95, target_occupancy * day_factor * diurnal))
                active_spots = max(1, min(len(spot_ids), int(round(len(spot_ids) * base_ratio))))

                selected_spots = spot_ids.copy()
                rng.shuffle(selected_spots)
                selected_spots = selected_spots[:active_spots]

                for idx, spot_id in enumerate(selected_spots):
                    user_id = user_ids[(idx + hour + day_cursor.day) % len(user_ids)]
                    created_at = slot_start - timedelta(hours=rng.randint(2, 24))
                    session.add(
                        Booking(
                            start_time=slot_start,
                            end_time=slot_end,
                            created_at=created_at,
                            type=BookingType.guest,
                            status=BookingStatus.completed,
                            parking_spot_id=spot_id,
                            user_id=user_id,
                        )
                    )
                    created += 1

            day_cursor += timedelta(days=1)

        await session.commit()

    return deleted_notifications, deleted_access_events, deleted_count, created


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Удаляет все бронирования и создает новые за последние 30 дней с умеренной загрузкой."
    )
    parser.add_argument("--parking-lot-id", type=int, default=3, help="ID парковки (по умолчанию: 3)")
    parser.add_argument(
        "--target-occupancy",
        type=float,
        default=0.55,
        help="Целевая средняя загрузка (0..1), по умолчанию 0.55",
    )
    parser.add_argument("--seed", type=int, default=20260504, help="Random seed for deterministic output.")
    args = parser.parse_args()

    if not (0 < args.target_occupancy <= 1):
        raise RuntimeError("--target-occupancy must be in (0, 1].")

    deleted_notifications, deleted_access_events, deleted_bookings, created = await reset_monthly_medium_load(
        parking_lot_id=args.parking_lot_id,
        target_occupancy=args.target_occupancy,
        random_seed=args.seed,
    )
    print(
        f"Done: deleted {deleted_bookings} bookings, {deleted_notifications} linked notifications, "
        f"and {deleted_access_events} linked access events; created {created} new bookings "
        f"for lot_id={args.parking_lot_id} across the last 30 days with target occupancy {args.target_occupancy:.0%}."
    )


if __name__ == "__main__":
    asyncio.run(main())
