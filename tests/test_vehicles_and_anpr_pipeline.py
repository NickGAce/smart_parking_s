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
from app.services.anpr.providers.runoi_provider import RunoiANPRProvider
from app.services.plate_recognition import normalize_plate_number


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


def test_runoi_provider_unavailable_fallback_chain():
    _, tokens = _setup_state()
    provider = RunoiANPRProvider()
    provider._initialized = True
    provider._init_error = "provider_unavailable: missing libs"
    from app.services.plate_recognition_pipeline import plate_recognition_pipeline

    plate_recognition_pipeline.runoi_provider = provider

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("A111AA77.png", BytesIO(b"mock-image"), "image/png")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["diagnostics"]["provider"] == "filename_fallback"
        assert "provider_unavailable" in (payload["diagnostics"]["reason"] or "")


def test_plate_normalization_russian_letters():
    assert normalize_plate_number("А123ВС-77") == "A123BC77"


def test_image_endpoint_uses_provider_chain():
    _, tokens = _setup_state()
    from app.services.anpr.providers.base import PlateRecognitionResult
    from app.services.plate_recognition_pipeline import plate_recognition_pipeline

    class StubRunoiProvider:
        async def recognize_from_image(self, file_path: str, *, plate_hint: str | None = None):
            return PlateRecognitionResult(
                plate_number="A111AA77",
                normalized_plate_number="A111AA77",
                confidence=0.95,
                raw_text="A111AA77",
                candidate_plates=["A111AA77"],
                provider="runoi_yolo_crnn",
            )

        async def recognize_from_video(self, file_path: str, *, plate_hint: str | None = None):
            return PlateRecognitionResult(
                plate_number="A111AA77",
                normalized_plate_number="A111AA77",
                confidence=0.95,
                raw_text="A111AA77",
                candidate_plates=["A111AA77"],
                provider="runoi_yolo_crnn",
                frame_timestamp=2.5,
            )

    plate_recognition_pipeline.runoi_provider = StubRunoiProvider()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("test.png", BytesIO(b"mock-image"), "image/png")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        assert response.json()["diagnostics"]["provider"] == "runoi_yolo_crnn"


def test_low_confidence_is_review():
    _, tokens = _setup_state()
    from app.services.anpr.providers.base import PlateRecognitionResult
    from app.services.plate_recognition_pipeline import plate_recognition_pipeline

    class LowConfidenceProvider:
        async def recognize_from_image(self, file_path: str, *, plate_hint: str | None = None):
            return PlateRecognitionResult(
                plate_number="A111AA77",
                normalized_plate_number="A111AA77",
                confidence=0.1,
                provider="runoi_yolo_crnn",
            )

        async def recognize_from_video(self, file_path: str, *, plate_hint: str | None = None):
            return await self.recognize_from_image(file_path, plate_hint=plate_hint)

    plate_recognition_pipeline.runoi_provider = LowConfidenceProvider()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/image",
            files={"file": ("test.png", BytesIO(b"mock-image"), "image/png")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        assert response.json()["decision"] == "review"
        assert response.json()["reason"] == "low_confidence"


def test_video_endpoint_returns_frame_timestamp():
    _, tokens = _setup_state()
    from app.services.anpr.providers.base import PlateRecognitionResult
    from app.services.plate_recognition_pipeline import plate_recognition_pipeline

    class StableVideoProvider:
        async def recognize_from_image(self, file_path: str, *, plate_hint: str | None = None):
            return PlateRecognitionResult(
                plate_number="A111AA77",
                normalized_plate_number="A111AA77",
                confidence=0.9,
                provider="runoi_yolo_crnn",
            )

        async def recognize_from_video(self, file_path: str, *, plate_hint: str | None = None):
            return PlateRecognitionResult(
                plate_number="A111AA77",
                normalized_plate_number="A111AA77",
                confidence=0.91,
                provider="runoi_yolo_crnn",
                frame_timestamp=4.0,
                candidate_plates=["A111AA77", "A111AA77", "A111AA77", "A111AB77"],
            )

    plate_recognition_pipeline.runoi_provider = StableVideoProvider()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/recognize/video",
            files={"file": ("test.mp4", BytesIO(b"mock-video"), "video/mp4")},
            data={"parking_lot_id": "1", "direction": "entry"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        assert response.json()["frame_timestamp"] == 4.0


def test_app_works_without_torch_ultralytics():
    provider = RunoiANPRProvider()
    result = asyncio.run(provider.recognize_from_image("/tmp/not-found.png"))
    assert result.error is not None
    assert "provider_unavailable" in result.error
