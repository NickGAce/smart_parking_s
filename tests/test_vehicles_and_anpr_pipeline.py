import asyncio
import os
from datetime import datetime, timedelta
from io import BytesIO

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
from app.models.vehicle_access_event import ProcessingStatus
from app.services.plate_recognition import normalize_plate_number
from app.services.plate_recognition_pipeline import plate_recognition_pipeline


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

            booking_entry = Booking(
                start_time=datetime.utcnow() - timedelta(minutes=10),
                end_time=datetime.utcnow() + timedelta(minutes=50),
                type=BookingType.guest,
                status=BookingStatus.confirmed,
                parking_spot_id=spot.id,
                user_id=tenant.id,
                vehicle_id=primary_vehicle.id,
                plate_number=primary_vehicle.plate_number,
            )
            booking_exit = Booking(
                start_time=datetime.utcnow() - timedelta(minutes=20),
                end_time=datetime.utcnow() + timedelta(minutes=15),
                type=BookingType.guest,
                status=BookingStatus.active,
                parking_spot_id=spot.id,
                user_id=tenant.id,
                vehicle_id=second_vehicle.id,
                plate_number=second_vehicle.plate_number,
            )
            session.add_all([booking_entry, booking_exit])
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


def test_image_recognition_with_plate_in_filename_and_auto_check_in():
    engine, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("car_A111AA77.png", BytesIO(b"mock-image"), "image/png")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["decision"] == "allowed"
        assert payload["vehicle_id"] is not None

    async def verify():
        session_local = async_sessionmaker(engine, expire_on_commit=False)
        async with session_local() as session:
            booking = (await session.execute(select(Booking).where(Booking.plate_number == "A111AA77"))).scalar_one()
            assert booking.status == BookingStatus.active

    asyncio.run(verify())


def test_image_recognition_with_plate_hint():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("unknown.png", BytesIO(b"mock-image"), "image/png")},
            data={"parking_lot_id": "1", "direction": "entry", "plate_hint": "a-111-aa-77"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        assert response.json()["normalized_plate_number"] == "A111AA77"


def test_image_unknown_plate_goes_to_review():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("no_plate.png", BytesIO(b"mock-image"), "image/png")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["decision"] == "review"
        assert payload["reason"] == "plate_not_recognized"


def test_known_plate_exit_auto_checkout_completed():
    engine, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("B222BB77.png", BytesIO(b"mock-image"), "image/png")},
            data={"parking_lot_id": "1", "direction": "exit"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        assert response.json()["decision"] == "allowed"

    async def verify():
        session_local = async_sessionmaker(engine, expire_on_commit=False)
        async with session_local() as session:
            booking = (await session.execute(select(Booking).where(Booking.plate_number == "B222BB77"))).scalar_one()
            assert booking.status == BookingStatus.completed

    asyncio.run(verify())


def test_invalid_image_file_returns_readable_error():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("bad.txt", BytesIO(b"not-image"), "text/plain")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 400
        assert "Неподдерживаемый формат" in response.json()["detail"]


def test_video_recognition_with_hint_works():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/video",
            files={"file": ("camera_feed.mp4", BytesIO(b"mock-video"), "video/mp4")},
            data={"parking_lot_id": "1", "direction": "entry", "plate_hint": "A111AA77"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        assert response.json()["normalized_plate_number"] == "A111AA77"


def test_provider_failure_marks_event_failed_review(monkeypatch):
    _, tokens = _setup_state()

    provider = plate_recognition_pipeline.providers[0]

    async def broken_provider(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(provider, "recognize", broken_provider)

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("unknown_plate.png", BytesIO(b"mock-image"), "image/png")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["decision"] == "review"
        assert payload["processing_status"] == ProcessingStatus.failed.value
        assert payload["reason"] == "provider_error"


def test_normalization_is_consistent():
    assert normalize_plate_number("A123BC77") == "A123BC77"
    assert normalize_plate_number("A 123 BC 77") == "A123BC77"
    assert normalize_plate_number("a-123-bc-77") == "A123BC77"
