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

            target_minutes = int(len(spot_ids) * window_minutes * target_occupancy * daily_factor)
            day_spots = spot_ids.copy()
            rng.shuffle(day_spots)
            spot_index = 0
            booked_minutes = 0

            while booked_minutes < target_minutes:
                spot_id = day_spots[spot_index % len(day_spots)]
                spot_index += 1

                duration = rng.choice([60, 90, 120, 150, 180])
                latest_start_offset = max(0, window_minutes - duration)
                start_offset = rng.randint(0, latest_start_offset)

                start = day_start + timedelta(minutes=start_offset)
                end = min(start + timedelta(minutes=duration), day_end)
                actual_duration = int((end - start).total_seconds() // 60)
                if actual_duration <= 0:
                    continue

                status = BookingStatus.completed if end < now else BookingStatus.confirmed
                user_id = user_ids[(spot_index + day_cursor.day) % len(user_ids)]
                session.add(
                    Booking(
                        start_time=start,
                        end_time=end,
                        created_at=start - timedelta(hours=rng.randint(2, 24)),
                        type=BookingType.guest,
                        status=status,
                        parking_spot_id=spot_id,
                        user_id=user_id,
                    )
                )
                created += 1
                booked_minutes += actual_duration

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
