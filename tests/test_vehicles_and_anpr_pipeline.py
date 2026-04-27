import asyncio
import os
from io import BytesIO
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
from app.models.booking import Booking, BookingStatus, BookingType
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle


def _setup_state():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async def init_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            owner = User(email="owner@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            guard = User(email="guard@test.com", hashed_password=hash_password("secret123"), role=UserRole.guard)
            tenant = User(email="tenant@test.com", hashed_password=hash_password("secret123"), role=UserRole.tenant)
            session.add_all([owner, guard, tenant])
            await session.flush()

            lot = ParkingLot(name="Lot A", address="Addr", total_spots=10, guest_spot_percentage=10, owner_id=owner.id)
            session.add(lot)
            await session.flush()

            spot = ParkingSpot(spot_number=1, status=SpotStatus.available, type="regular", parking_lot_id=lot.id, owner_id=owner.id)
            session.add(spot)
            await session.flush()

            primary_vehicle = Vehicle(
                user_id=tenant.id,
                plate_number="A111AA77",
                normalized_plate_number="A111AA77",
                is_primary=True,
                is_active=True,
            )
            second_vehicle = Vehicle(
                user_id=tenant.id,
                plate_number="B222BB77",
                normalized_plate_number="B222BB77",
                is_primary=False,
                is_active=True,
            )
            session.add_all([primary_vehicle, second_vehicle])
            await session.flush()

            booking = Booking(
                start_time=datetime.utcnow() - timedelta(minutes=10),
                end_time=datetime.utcnow() + timedelta(minutes=50),
                type=BookingType.guest,
                status=BookingStatus.confirmed,
                parking_spot_id=spot.id,
                user_id=tenant.id,
                vehicle_id=primary_vehicle.id,
                plate_number=primary_vehicle.plate_number,
            )
            session.add(booking)
            await session.commit()

    asyncio.run(init_db())

    async def override_get_session():
        async with session_local() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    tokens = {
        "owner": create_access_token("1"),
        "guard": create_access_token("2"),
        "tenant": create_access_token("3"),
    }
    return engine, tokens


def test_create_vehicle_and_multiple_vehicles_per_user():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/vehicles",
            json={"plate_number": "C333CC77", "vehicle_type": "car", "is_primary": False},
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
        )
        assert create_response.status_code == 201

        list_response = client.get("/api/v1/vehicles", headers={"Authorization": f"Bearer {tokens['tenant']}"})
        assert list_response.status_code == 200
        assert len(list_response.json()) >= 3


def test_booking_uses_primary_vehicle_fallback():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=10)).isoformat(),
                "end_time": (now + timedelta(minutes=40)).isoformat(),
                "type": "guest",
            },
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["vehicle_id"] is not None
        assert payload["plate_number"] == "A111AA77"


def test_image_recognition_flow_known_plate_auto_check_in():
    engine, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("A111AA77.png", BytesIO(b"mock-image"), "image/png")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        assert response.json()["decision"] == "allowed"
        assert response.json()["image_url"] is not None

    async def verify():
        session_local = async_sessionmaker(engine, expire_on_commit=False)
        async with session_local() as session:
            booking = (await session.execute(select(Booking).where(Booking.id == 1))).scalar_one()
            assert booking.status == BookingStatus.active

    asyncio.run(verify())


def test_video_recognition_flow_and_unknown_plate_review():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        known = client.post(
            "/api/v1/access-events/recognize/video",
            files={"file": ("A111AA77.mp4", BytesIO(b"mock-video"), "video/mp4")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert known.status_code == 201
        assert known.json()["video_url"] is not None

        unknown = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("UNKNOWN.png", BytesIO(b"mock-image"), "image/png")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert unknown.status_code == 201
        assert unknown.json()["decision"] == "review"
