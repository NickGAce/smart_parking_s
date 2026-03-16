import asyncio
import os
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret")

from app.api.deps import get_session
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.main import app
from app.models.booking import BookingStatus, BookingType
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
            admin = User(email="admin@test.com", hashed_password=hash_password("secret123"), role=UserRole.admin)
            user = User(email="user@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            another = User(email="another@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            session.add_all([admin, user, another])
            await session.flush()

            lot = ParkingLot(name="Lot A", address="Addr", total_spots=10, guest_spot_percentage=10)
            session.add(lot)
            await session.flush()

            spot = ParkingSpot(
                spot_number=1,
                status=SpotStatus.available,
                type="regular",
                parking_lot_id=lot.id,
                owner_id=another.id,
            )
            session.add(spot)
            await session.commit()

    asyncio.run(init_db())

    async def override_get_session():
        async with session_local() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    tokens = {
        "admin": create_access_token("1"),
        "user": create_access_token("2"),
        "another": create_access_token("3"),
    }
    return engine, tokens


def test_create_booking_success():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        payload = {
            "parking_spot_id": 1,
            "start_time": (now + timedelta(minutes=10)).isoformat(),
            "end_time": (now + timedelta(minutes=40)).isoformat(),
            "type": BookingType.guest,
        }
        response = client.post("/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {tokens['user']}"})
        assert response.status_code == 201
        assert response.json()["status"] == BookingStatus.active


def test_cannot_create_overlapping_booking():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        first = {
            "parking_spot_id": 1,
            "start_time": (now + timedelta(minutes=10)).isoformat(),
            "end_time": (now + timedelta(minutes=40)).isoformat(),
            "type": BookingType.guest,
        }
        second = {
            "parking_spot_id": 1,
            "start_time": (now + timedelta(minutes=20)).isoformat(),
            "end_time": (now + timedelta(minutes=50)).isoformat(),
            "type": BookingType.guest,
        }
        client.post("/api/v1/bookings", json=first, headers={"Authorization": f"Bearer {tokens['user']}"})
        response = client.post("/api/v1/bookings", json=second, headers={"Authorization": f"Bearer {tokens['another']}"})
        assert response.status_code == 409


def test_user_does_not_see_others_bookings():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        payload = {
            "parking_spot_id": 1,
            "start_time": (now + timedelta(minutes=10)).isoformat(),
            "end_time": (now + timedelta(minutes=40)).isoformat(),
            "type": BookingType.guest,
        }
        client.post("/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {tokens['another']}"})
        response = client.get("/api/v1/bookings", headers={"Authorization": f"Bearer {tokens['user']}"})
        assert response.status_code == 200
        assert response.json() == []


def test_admin_sees_all_bookings():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        payload = {
            "parking_spot_id": 1,
            "start_time": (now + timedelta(minutes=10)).isoformat(),
            "end_time": (now + timedelta(minutes=40)).isoformat(),
            "type": BookingType.guest,
        }
        client.post("/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {tokens['user']}"})
        response = client.get("/api/v1/bookings", headers={"Authorization": f"Bearer {tokens['admin']}"})
        assert response.status_code == 200
        assert len(response.json()) == 1


def test_effective_status_booked_when_active_booking():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        payload = {
            "parking_spot_id": 1,
            "start_time": (now + timedelta(minutes=1)).isoformat(),
            "end_time": (now + timedelta(minutes=30)).isoformat(),
            "type": BookingType.guest,
        }
        client.post("/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {tokens['user']}"})
        response = client.get(
            f"/api/v1/parking_spots?from={(now + timedelta(minutes=5)).isoformat()}&to={(now + timedelta(minutes=6)).isoformat()}"
        )
        assert response.status_code == 200
        assert response.json()[0]["effective_status"] == SpotStatus.booked


def test_active_booking_auto_completes_on_list():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        payload = {
            "parking_spot_id": 1,
            "start_time": (now - timedelta(minutes=30)).isoformat(),
            "end_time": (now - timedelta(minutes=1)).isoformat(),
            "type": BookingType.guest,
        }
        create_response = client.post(
            "/api/v1/bookings",
            json=payload,
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert create_response.status_code == 201
        assert create_response.json()["status"] == BookingStatus.active

        list_response = client.get(
            "/api/v1/bookings?mine=true",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert list_response.status_code == 200
        assert list_response.json()[0]["status"] == BookingStatus.completed


def test_patch_booking_type_changes():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        payload = {
            "parking_spot_id": 1,
            "start_time": (now + timedelta(minutes=10)).isoformat(),
            "end_time": (now + timedelta(minutes=40)).isoformat(),
            "type": BookingType.guest,
        }
        create_response = client.post(
            "/api/v1/bookings",
            json=payload,
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        booking_id = create_response.json()["id"]

        patch_response = client.patch(
            f"/api/v1/bookings/{booking_id}",
            json={"type": BookingType.rental},
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert patch_response.status_code == 200
        assert patch_response.json()["type"] == BookingType.rental


def test_create_booking_respects_browser_timezone_header():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": "2026-03-13T12:00:00",
                "end_time": "2026-03-13T13:00:00",
                "type": BookingType.guest,
            },
            headers={
                "Authorization": f"Bearer {tokens['user']}",
                "X-Timezone": "Europe/Moscow",
            },
        )
        assert create_response.status_code == 201
        # API returns time in client timezone when X-Timezone is passed
        assert create_response.json()["start_time"].startswith("2026-03-13T12:00:00")


def test_parking_spot_status_changes_on_booking_create_and_cancel():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=10)).isoformat(),
                "end_time": (now + timedelta(minutes=30)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert create_response.status_code == 201
        booking_id = create_response.json()["id"]

        spot_after_create = client.get("/api/v1/parking_spots/1")
        assert spot_after_create.status_code == 200
        assert spot_after_create.json()["status"] == SpotStatus.available

        # Simulate device time inside booking interval.
        spot_during_booking = client.get(
            "/api/v1/parking_spots/1",
            headers={
                "X-Device-Time": (now + timedelta(minutes=15)).isoformat(),
                "X-Timezone": "UTC",
            },
        )
        assert spot_during_booking.status_code == 200
        assert spot_during_booking.json()["status"] == SpotStatus.booked

        cancel_response = client.delete(
            f"/api/v1/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert cancel_response.status_code == 204

        spot_after_cancel = client.get("/api/v1/parking_spots/1")
        assert spot_after_cancel.status_code == 200
        assert spot_after_cancel.json()["status"] == SpotStatus.available


def test_device_time_header_affects_default_effective_status_window():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(hours=2)).isoformat(),
                "end_time": (now + timedelta(hours=3)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert create_response.status_code == 201

        now_response = client.get("/api/v1/parking_spots/1")
        assert now_response.status_code == 200
        assert now_response.json()["effective_status"] == SpotStatus.available

        future_response = client.get(
            "/api/v1/parking_spots/1",
            headers={
                "X-Device-Time": (now + timedelta(hours=2, minutes=10)).isoformat(),
                "X-Timezone": "UTC",
            },
        )
        assert future_response.status_code == 200
        assert future_response.json()["effective_status"] == SpotStatus.booked


def test_get_booking_syncs_status_with_device_time():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now - timedelta(hours=1)).isoformat(),
                "end_time": (now - timedelta(minutes=10)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        booking_id = create_response.json()["id"]

        get_response = client.get(
            f"/api/v1/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert get_response.status_code == 200
        assert get_response.json()["status"] == BookingStatus.completed


def test_device_time_header_does_not_force_premature_completion():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now - timedelta(minutes=5)).isoformat(),
                "end_time": (now + timedelta(minutes=55)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        booking_id = create_response.json()["id"]

        # Even with a client-provided future device time, lifecycle status
        # must be based on server time and stay active.
        get_response = client.get(
            f"/api/v1/bookings/{booking_id}",
            headers={
                "Authorization": f"Bearer {tokens['user']}",
                "X-Device-Time": (now + timedelta(hours=5)).isoformat(),
                "X-Timezone": "UTC",
            },
        )
        assert get_response.status_code == 200
        assert get_response.json()["status"] == BookingStatus.active


def test_create_booking_in_past_is_completed_immediately():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now - timedelta(minutes=5)).isoformat(),
                "end_time": (now - timedelta(minutes=1)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert response.status_code == 201
        assert response.json()["status"] == BookingStatus.completed


def test_utc_z_input_is_interpreted_as_local_when_timezone_header_present():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(hours=1)).isoformat() + "Z",
                "end_time": (now + timedelta(hours=2)).isoformat() + "Z",
                "type": BookingType.guest,
            },
            headers={
                "Authorization": f"Bearer {tokens['user']}",
                "X-Timezone": "Europe/Moscow",
            },
        )
        assert response.status_code == 201
        # Compatibility: values with `Z` + timezone header are treated as local wall-clock time.
        # For UTC+3 this shifts stored UTC by -3h, so end_time can already be in the past.
        assert response.json()["status"] == BookingStatus.completed
