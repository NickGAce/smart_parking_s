import asyncio
import os
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret")

from app.db.base import Base
from app.models.booking import Booking, BookingStatus, BookingType
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.models.user import User, UserRole
from app.services.booking_lifecycle import run_booking_lifecycle_sync


def test_run_booking_lifecycle_sync_updates_statuses_and_spot():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        session_local = async_sessionmaker(engine, expire_on_commit=False)

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        now = datetime.utcnow().replace(microsecond=0)

        async with session_local() as session:
            user = User(email="sync-user@test.com", hashed_password="hash", role=UserRole.owner)
            lot = ParkingLot(name="Lot S", address="Addr", total_spots=5, guest_spot_percentage=20)
            session.add_all([user, lot])
            await session.flush()

            spot = ParkingSpot(
                spot_number=1,
                status=SpotStatus.available,
                type="regular",
                parking_lot_id=lot.id,
                owner_id=user.id,
            )
            session.add(spot)
            await session.flush()

            session.add_all(
                [
                    Booking(
                        start_time=now - timedelta(minutes=20),
                        end_time=now - timedelta(minutes=5),
                        type=BookingType.guest,
                        status=BookingStatus.active,
                        parking_spot_id=spot.id,
                        user_id=user.id,
                    ),
                    Booking(
                        start_time=now - timedelta(minutes=45),
                        end_time=now + timedelta(minutes=15),
                        type=BookingType.guest,
                        status=BookingStatus.confirmed,
                        parking_spot_id=spot.id,
                        user_id=user.id,
                    ),
                    Booking(
                        start_time=now - timedelta(minutes=10),
                        end_time=now + timedelta(minutes=50),
                        type=BookingType.guest,
                        status=BookingStatus.pending,
                        parking_spot_id=spot.id,
                        user_id=user.id,
                    ),
                ]
            )
            await session.commit()

        async with session_local() as session:
            async with session.begin():
                stats = await run_booking_lifecycle_sync(session, now=now)

            statuses = (await session.execute(select(Booking.status))).scalars().all()
            spot_status = (await session.execute(select(ParkingSpot.status))).scalar_one()

            assert stats.completed == 1
            assert stats.no_show == 1
            assert stats.expired == 1
            assert BookingStatus.completed in statuses
            assert BookingStatus.no_show in statuses
            assert BookingStatus.expired in statuses
            assert spot_status == SpotStatus.available

        await engine.dispose()

    asyncio.run(scenario())
