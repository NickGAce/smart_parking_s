import asyncio
import os
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret")

from app.db.base import Base
from app.models.booking import Booking, BookingType
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus, SpotType
from app.models.parking_zone import ParkingZone
from app.models.user import User, UserRole
from scripts.create_test_data import reseed_parking_data


def test_reseed_parking_data_replaces_lot_spots_and_clears_bookings(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async def run_test():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            user = User(email="seed-user@test.com", hashed_password="hash", role=UserRole.owner.value)
            session.add(user)
            await session.flush()

            old_lot = ParkingLot(name="Old Lot", address="Old addr", total_spots=2, guest_spot_percentage=50)
            session.add(old_lot)
            await session.flush()

            old_spot = ParkingSpot(
                spot_number=1,
                status=SpotStatus.available,
                type=SpotType.regular.value,
                spot_type=SpotType.regular,
                parking_lot_id=old_lot.id,
                owner_id=user.id,
            )
            session.add(old_spot)
            await session.flush()

            session.add(
                Booking(
                    start_time=datetime(2026, 4, 8, 10, 0, 0),
                    end_time=datetime(2026, 4, 8, 11, 0, 0),
                    type=BookingType.guest,
                    parking_spot_id=old_spot.id,
                    user_id=user.id,
                )
            )
            await session.commit()

        monkeypatch.setattr("scripts.create_test_data.AsyncSessionLocal", session_local)

        result = await reseed_parking_data()
        assert result == {"parking_lots": 1, "parking_spots": 25, "bookings": 0}

        async with session_local() as verify_session:
            lots_count = (await verify_session.execute(select(func.count(ParkingLot.id)))).scalar_one()
            spots_count = (await verify_session.execute(select(func.count(ParkingSpot.id)))).scalar_one()
            bookings_count = (await verify_session.execute(select(func.count(Booking.id)))).scalar_one()
            zones_count = (await verify_session.execute(select(func.count(ParkingZone.id)))).scalar_one()

            assert lots_count == 1
            assert spots_count == 25
            assert bookings_count == 0
            assert zones_count == 7

            lot = (await verify_session.execute(select(ParkingLot))).scalar_one()
            assert lot.total_spots == 25

            spot_types = (await verify_session.execute(select(ParkingSpot.spot_type).distinct())).scalars().all()
            assert set(spot_types) == {
                SpotType.regular,
                SpotType.guest,
                SpotType.disabled,
                SpotType.ev,
                SpotType.vip,
                SpotType.reserved,
            }

            blocked_spots = (
                await verify_session.execute(
                    select(func.count(ParkingSpot.id)).where(ParkingSpot.status == SpotStatus.blocked)
                )
            ).scalar_one()
            assert blocked_spots == 2

    asyncio.run(run_test())
