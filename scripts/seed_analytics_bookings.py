import argparse
import asyncio
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from pydantic_core import ValidationError
from sqlalchemy import select

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.booking import Booking, BookingStatus, BookingType
from app.models.parking_spot import ParkingSpot
from app.models.user import User

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_project_env_file() -> None:
    env_path = PROJECT_ROOT / '.env'
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding='utf-8').splitlines():
        raw = line.strip()
        if not raw or raw.startswith('#') or '=' not in raw:
            continue
        key, value = raw.split('=', 1)
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
        raise RuntimeError(
            'Settings are not configured. Provide DATABASE_URL and JWT_SECRET via .env.'
        ) from exc

    AsyncSessionLocal = session_local
    return AsyncSessionLocal


def choose_status(start: datetime, now: datetime, rng: random.Random) -> BookingStatus:
    if start > now + timedelta(minutes=90):
        return BookingStatus.confirmed
    if start > now - timedelta(minutes=30):
        return BookingStatus.active

    roll = rng.random()
    if roll < 0.62:
        return BookingStatus.completed
    if roll < 0.78:
        return BookingStatus.no_show
    if roll < 0.93:
        return BookingStatus.cancelled
    return BookingStatus.expired


async def seed_bookings(days_back: int, bookings_per_day: int, random_seed: int) -> int:
    session_factory = init_session_factory()
    rng = random.Random(random_seed)
    now = datetime.utcnow().replace(second=0, microsecond=0)

    async with session_factory() as session:
        user_ids = list((await session.execute(select(User.id).order_by(User.id.asc()))).scalars().all())
        spot_ids = list((await session.execute(select(ParkingSpot.id).order_by(ParkingSpot.id.asc()))).scalars().all())

        if not user_ids:
            raise RuntimeError('No users found. Create at least one user before seeding bookings.')
        if not spot_ids:
            raise RuntimeError('No parking spots found. Seed parking spots first (scripts/create_test_data.py).')

        created = 0
        for day_offset in range(days_back):
            day = (now - timedelta(days=day_offset)).date()

            for slot in range(bookings_per_day):
                hour = 7 + (slot % 12)
                minute = (slot * 5) % 60
                start = datetime(day.year, day.month, day.day, hour, minute)
                duration = rng.choice([30, 60, 90, 120])
                end = start + timedelta(minutes=duration)

                spot_id = spot_ids[(day_offset * bookings_per_day + slot) % len(spot_ids)]
                user_id = user_ids[(day_offset + slot) % len(user_ids)]
                status = choose_status(start, now, rng)

                session.add(
                    Booking(
                        start_time=start,
                        end_time=end,
                        created_at=max(start - timedelta(hours=rng.randint(2, 30)), now - timedelta(days=40)),
                        type=BookingType.guest,
                        status=status,
                        parking_spot_id=spot_id,
                        user_id=user_id,
                    )
                )
                created += 1

        await session.commit()

    return created


async def main() -> None:
    parser = argparse.ArgumentParser(description='Seed bookings for analytics/dashboard verification.')
    parser.add_argument('--days-back', type=int, default=14, help='How many days назад заполнить бронирования.')
    parser.add_argument('--per-day', type=int, default=10, help='Сколько бронирований создавать на каждый день.')
    parser.add_argument('--seed', type=int, default=20260419, help='Random seed for deterministic output.')
    args = parser.parse_args()

    created = await seed_bookings(days_back=args.days_back, bookings_per_day=args.per_day, random_seed=args.seed)
    print(f'Seed completed: created {created} bookings for last {args.days_back} days.')


if __name__ == '__main__':
    asyncio.run(main())
