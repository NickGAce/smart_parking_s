import asyncio
import os
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret")

from app.api.deps import get_session
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.main import app
from app.models.booking import Booking, BookingType
from app.models.notification import NotificationType
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.models.user import User, UserRole


def _setup_state():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async def init_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            user = User(email="user@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            session.add(user)
            await session.flush()

            lot = ParkingLot(name="Lot A", address="Addr", total_spots=10, guest_spot_percentage=10)
            session.add(lot)
            await session.flush()

            spot = ParkingSpot(
                spot_number=1,
                status=SpotStatus.available,
                type="regular",
                parking_lot_id=lot.id,
                owner_id=user.id,
            )
            session.add(spot)
            await session.commit()

    asyncio.run(init_db())

    async def override_get_session():
        async with session_local() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    tokens = {"user": create_access_token("1")}
    return engine, tokens


def test_notifications_created_and_read_flow():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=10)).isoformat(),
                "end_time": (now + timedelta(minutes=40)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert create_response.status_code == 201

        list_response = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {tokens['user']}"})
        assert list_response.status_code == 200
        types = [item["type"] for item in list_response.json()["items"]]
        assert NotificationType.booking_created in types
        assert NotificationType.booking_confirmed in types

        unread_id = list_response.json()["items"][0]["id"]
        read_response = client.patch(
            f"/api/v1/notifications/{unread_id}/read",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert read_response.status_code == 200
        assert read_response.json()["status"] == "read"
        assert read_response.json()["read_at"] is not None


def test_booking_cancelled_creates_notification():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=30)).isoformat(),
                "end_time": (now + timedelta(minutes=60)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        booking_id = create_response.json()["id"]

        delete_response = client.delete(
            f"/api/v1/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert delete_response.status_code == 204

        list_response = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {tokens['user']}"})
        assert list_response.status_code == 200
        types = [item["type"] for item in list_response.json()["items"]]
        assert NotificationType.booking_cancelled in types


def test_no_show_notification_created_by_lifecycle_sync():
    engine, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=90)).isoformat(),
                "end_time": (now + timedelta(minutes=120)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        booking_id = create_response.json()["id"]

    async def make_overdue_confirmed():
        session_local = async_sessionmaker(engine, expire_on_commit=False)
        async with session_local() as session:
            booking = (await session.execute(select(Booking).where(Booking.id == booking_id))).scalar_one()
            booking.start_time = datetime.utcnow() - timedelta(minutes=90)
            booking.end_time = datetime.utcnow() + timedelta(minutes=30)
            await session.commit()

    asyncio.run(make_overdue_confirmed())

    with TestClient(app) as client:
        sync_trigger = client.get("/api/v1/bookings?mine=true", headers={"Authorization": f"Bearer {tokens['user']}"})
        assert sync_trigger.status_code == 200

        list_response = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {tokens['user']}"})
        types = [item["type"] for item in list_response.json()["items"]]
        assert NotificationType.booking_no_show in types
