import argparse
import asyncio
import os
import random
import sys
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any

from pydantic_core import ValidationError
from sqlalchemy import select

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.booking import Booking, BookingStatus, BookingType
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot
from app.models.user import User

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


def start_of_week(day: datetime) -> datetime:
    return datetime.combine((day - timedelta(days=day.weekday())).date(), time.min)


async def seed_medium_weekly_load(parking_lot_id: int, target_occupancy: float, random_seed: int) -> int:
    session_factory = init_session_factory()
    rng = random.Random(random_seed)
    now = datetime.now(timezone.utc).replace(tzinfo=None, second=0, microsecond=0)
    current_week_start = start_of_week(now)
    previous_week_start = current_week_start - timedelta(days=7)

    async with session_factory() as session:
        lot = await session.get(ParkingLot, parking_lot_id)
        if lot is None:
            raise RuntimeError(f"Parking lot with id={parking_lot_id} not found.")

        spot_ids = list(
            (
                await session.execute(
                    select(ParkingSpot.id).where(ParkingSpot.parking_lot_id == parking_lot_id).order_by(ParkingSpot.id.asc())
                )
            )
            .scalars()
            .all()
        )
        user_ids = list((await session.execute(select(User.id).order_by(User.id.asc()))).scalars().all())

        if not spot_ids:
            raise RuntimeError(f"No parking spots found for parking_lot_id={parking_lot_id}.")
        if not user_ids:
            raise RuntimeError("No users found. Create at least one user before seeding bookings.")

        day_cursor = previous_week_start
        created = 0
        while day_cursor < current_week_start + timedelta(days=7):
            is_weekend = day_cursor.weekday() >= 5
            daily_factor = 0.8 if is_weekend else 1.0
            # В будни: 08:00-20:00 (12ч), выходные: 09:00-18:00 (9ч).
            start_hour = 9 if is_weekend else 8
            end_hour = 18 if is_weekend else 20
            day_start = day_cursor + timedelta(hours=start_hour)
            day_end = day_cursor + timedelta(hours=end_hour)
            window_minutes = int((day_end - day_start).total_seconds() // 60)
            hour_slots = max(window_minutes // 60, 1)

            target_minutes = int(len(spot_ids) * window_minutes * target_occupancy * daily_factor)
            day_spots = spot_ids.copy()
            rng.shuffle(day_spots)
            baseline_active = max(1, int(len(spot_ids) * target_occupancy * daily_factor))
            booked_minutes = 0

            for hour_slot in range(hour_slots):
                slot_start = day_start + timedelta(hours=hour_slot)
                slot_end = min(slot_start + timedelta(hours=1), day_end)
                slot_minutes = int((slot_end - slot_start).total_seconds() // 60)
                if slot_minutes <= 0:
                    continue

                # Гладкий профиль для прогнозирования: без резких случайных всплесков.
                slot_active = min(
                    len(spot_ids),
                    max(1, baseline_active + rng.randint(-1, 1)),
                )
                slot_spots = day_spots.copy()
                rng.shuffle(slot_spots)
                selected_spots = slot_spots[:slot_active]

                for local_idx, spot_id in enumerate(selected_spots):
                    status = BookingStatus.completed if slot_end < now else BookingStatus.confirmed
                    user_id = user_ids[(local_idx + hour_slot + day_cursor.day) % len(user_ids)]
                    session.add(
                        Booking(
                            start_time=slot_start,
                            end_time=slot_end,
                            created_at=slot_start - timedelta(hours=rng.randint(2, 24)),
                            type=BookingType.guest,
                            status=status,
                            parking_spot_id=spot_id,
                            user_id=user_id,
                        )
                    )
                    created += 1
                    booked_minutes += slot_minutes

                if booked_minutes >= target_minutes:
                    break

            day_cursor += timedelta(days=1)

        await session.commit()

    return created


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Создает бронирования за прошлую и текущую недели с умеренной загрузкой парковки."
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

    created = await seed_medium_weekly_load(
        parking_lot_id=args.parking_lot_id,
        target_occupancy=args.target_occupancy,
        random_seed=args.seed,
    )
    print(
        f"Done: created {created} bookings for lot_id={args.parking_lot_id} "
        f"across previous and current weeks with target occupancy {args.target_occupancy:.0%}."
    )


if __name__ == "__main__":
    asyncio.run(main())
