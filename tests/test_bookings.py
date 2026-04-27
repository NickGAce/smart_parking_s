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
from app.models.booking import Booking
from app.models.booking import BookingStatus, BookingType
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.models.user import User, UserRole
from app.services.bookings import sync_booking_statuses


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
            guard = User(email="guard@test.com", hashed_password=hash_password("secret123"), role=UserRole.guard)
            session.add_all([admin, user, another, guard])
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
        "guard": create_access_token("4"),
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
        assert response.json()["status"] == BookingStatus.confirmed


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
        assert response.json()["items"] == []


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
        assert len(response.json()["items"]) == 1


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
            f"/api/v1/parking_spots?from={(now + timedelta(minutes=5)).isoformat()}&to={(now + timedelta(minutes=6)).isoformat()}",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert response.status_code == 200
        assert response.json()["items"][0]["effective_status"] == SpotStatus.booked


def test_past_booking_is_expired_immediately_and_stays_expired():
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
        assert create_response.json()["status"] == BookingStatus.expired

        list_response = client.get(
            "/api/v1/bookings?mine=true",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert list_response.status_code == 200
        assert list_response.json()["items"][0]["status"] == BookingStatus.expired


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


def test_create_booking_stores_same_local_time_as_request():
    engine, tokens = _setup_state()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": "2026-03-13T18:00:00",
                "end_time": "2026-03-13T19:00:00",
                "type": BookingType.guest,
            },
            headers={
                "Authorization": f"Bearer {tokens['user']}",
                "X-Timezone": "Europe/Moscow",
            },
        )
        assert create_response.status_code == 201
        booking_id = create_response.json()["id"]

    async def fetch_booking():
        session_local = async_sessionmaker(engine, expire_on_commit=False)
        async with session_local() as session:
            result = await session.execute(select(Booking).where(Booking.id == booking_id))
            return result.scalar_one()

    booking = asyncio.run(fetch_booking())
    assert booking.start_time == datetime(2026, 3, 13, 18, 0, 0)
    assert booking.end_time == datetime(2026, 3, 13, 19, 0, 0)


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

        spot_after_create = client.get("/api/v1/parking_spots/1", headers={"Authorization": f"Bearer {tokens['user']}"})
        assert spot_after_create.status_code == 200
        assert spot_after_create.json()["status"] == SpotStatus.booked

        # Simulate device time inside booking interval.
        spot_during_booking = client.get(
            "/api/v1/parking_spots/1",
            headers={
                "Authorization": f"Bearer {tokens['user']}",
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

        spot_after_cancel = client.get("/api/v1/parking_spots/1", headers={"Authorization": f"Bearer {tokens['user']}"})
        assert spot_after_cancel.status_code == 200
        assert spot_after_cancel.json()["status"] == SpotStatus.available


def test_device_time_header_does_not_affect_default_effective_status_window():
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

        now_response = client.get("/api/v1/parking_spots/1", headers={"Authorization": f"Bearer {tokens['user']}"})
        assert now_response.status_code == 200
        assert now_response.json()["effective_status"] == SpotStatus.available

        future_response = client.get(
            "/api/v1/parking_spots/1",
            headers={
                "Authorization": f"Bearer {tokens['user']}",
                "X-Device-Time": (now + timedelta(hours=2, minutes=10)).isoformat(),
                "X-Timezone": "UTC",
            },
        )
        assert future_response.status_code == 200
        assert future_response.json()["effective_status"] == SpotStatus.available


def test_get_booking_syncs_status_with_server_time():
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
        assert get_response.json()["status"] == BookingStatus.expired


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
        assert get_response.json()["status"] == BookingStatus.confirmed


def test_check_in_and_check_out_by_booking_owner():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=1)).isoformat(),
                "end_time": (now + timedelta(minutes=45)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        booking_id = create_response.json()["id"]

        check_in_response = client.post(
            f"/api/v1/bookings/{booking_id}/check-in",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert check_in_response.status_code == 200
        assert check_in_response.json()["status"] == BookingStatus.active

        check_out_response = client.post(
            f"/api/v1/bookings/{booking_id}/check-out",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert check_out_response.status_code == 200
        assert check_out_response.json()["status"] == BookingStatus.completed


def test_check_in_allowed_for_guard_and_forbidden_for_other_user():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=5)).isoformat(),
                "end_time": (now + timedelta(minutes=30)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        booking_id = create_response.json()["id"]

        forbidden_response = client.post(
            f"/api/v1/bookings/{booking_id}/check-in",
            headers={"Authorization": f"Bearer {tokens['another']}"},
        )
        assert forbidden_response.status_code == 403

        guard_response = client.post(
            f"/api/v1/bookings/{booking_id}/check-in",
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert guard_response.status_code == 200
        assert guard_response.json()["status"] == BookingStatus.active


def test_manual_no_show_requires_grace_window_end():
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
        booking_id = create_response.json()["id"]

        early_no_show = client.post(
            f"/api/v1/bookings/{booking_id}/mark-no-show",
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert early_no_show.status_code == 409


def test_sync_sets_no_show_after_grace_window():
    engine, _ = _setup_state()
    now = datetime.utcnow()

    async def create_confirmed_and_sync():
        session_local = async_sessionmaker(engine, expire_on_commit=False)
        async with session_local() as session:
            booking = Booking(
                start_time=now - timedelta(minutes=31),
                end_time=now + timedelta(minutes=10),
                type=BookingType.guest,
                parking_spot_id=1,
                user_id=2,
                status=BookingStatus.confirmed,
            )
            session.add(booking)
            await session.flush()
            booking_id = booking.id
            await sync_booking_statuses(session, now=now)
            await session.commit()

        async with session_local() as session:
            result = await session.execute(select(Booking).where(Booking.id == booking_id))
            return result.scalar_one()

    booking = asyncio.run(create_confirmed_and_sync())
    assert booking.status == BookingStatus.no_show


def test_create_booking_ignores_device_time_for_status_and_spot_state():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now - timedelta(hours=2)).isoformat(),
                "end_time": (now - timedelta(hours=1)).isoformat(),
                "type": BookingType.guest,
            },
            headers={
                "Authorization": f"Bearer {tokens['user']}",
                "X-Device-Time": (now + timedelta(days=7)).isoformat(),
                "X-Timezone": "UTC",
            },
        )
        assert response.status_code == 201
        assert response.json()["status"] == BookingStatus.expired

        spot_response = client.get(
            "/api/v1/parking_spots/1",
            headers={
                "Authorization": f"Bearer {tokens['user']}",
                "X-Device-Time": (now + timedelta(days=7)).isoformat(),
                "X-Timezone": "UTC",
            },
        )
        assert spot_response.status_code == 200
        assert spot_response.json()["status"] == SpotStatus.available




def test_future_device_time_header_does_not_force_completion_on_create():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=5)).isoformat(),
                "end_time": (now + timedelta(minutes=30)).isoformat(),
                "type": BookingType.guest,
            },
            headers={
                "Authorization": f"Bearer {tokens['user']}",
                "X-Device-Time": (now + timedelta(days=1)).isoformat(),
                "X-Timezone": "UTC",
            },
        )
        assert response.status_code == 201
        assert response.json()["status"] == BookingStatus.confirmed

def test_create_booking_in_past_is_expired_immediately():
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
        assert response.json()["status"] == BookingStatus.expired


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
        assert response.json()["status"] == BookingStatus.expired


def test_utc_z_input_without_header_uses_default_timezone_local_time():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": "2026-03-17T14:17:48.465Z",
                "end_time": "2026-03-17T15:17:48.465Z",
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )

        assert response.status_code == 201
        # Without X-Timezone, `Z` input is interpreted as local default timezone (Europe/Moscow).
        assert response.json()["start_time"].startswith("2026-03-17T14:17:48.465")
        assert response.json()["start_time"].endswith("+03:00")


def test_invalid_default_timezone_falls_back_to_moscow_for_z_input():
    _, tokens = _setup_state()
    from app.core.config import settings

    original_tz = settings.default_timezone
    settings.default_timezone = "Invalid/Timezone"
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/bookings",
                json={
                    "parking_spot_id": 1,
                    "start_time": "2026-03-17T14:35:20.283Z",
                    "end_time": "2026-03-17T15:35:20.283Z",
                    "type": BookingType.guest,
                },
                headers={"Authorization": f"Bearer {tokens['user']}"},
            )

            assert response.status_code == 201
            assert response.json()["start_time"].endswith("+03:00")
    finally:
        settings.default_timezone = original_tz


def test_naive_datetime_without_header_uses_default_timezone():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": "2026-03-13T10:00:00",
                "end_time": "2026-03-13T11:00:00",
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )

        assert create_response.status_code == 201
        # Without X-Timezone, API falls back to default timezone (Europe/Moscow).
        assert create_response.json()["start_time"].startswith("2026-03-13T10:00:00+03:00")


def test_sync_booking_statuses_does_not_commit_inside_service():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.utcnow()

    async def scenario():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            owner = User(email="owner_sync@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            session.add(owner)
            await session.flush()

            lot = ParkingLot(name="Lot Sync", address="Addr", total_spots=10, guest_spot_percentage=10, owner_id=owner.id)
            session.add(lot)
            await session.flush()

            spot = ParkingSpot(
                spot_number=100,
                status=SpotStatus.available,
                type="regular",
                parking_lot_id=lot.id,
                owner_id=owner.id,
            )
            session.add(spot)
            await session.flush()

            booking = Booking(
                start_time=now - timedelta(hours=2),
                end_time=now - timedelta(hours=1),
                type=BookingType.guest,
                parking_spot_id=spot.id,
                user_id=owner.id,
                status=BookingStatus.active,
            )
            session.add(booking)
            await session.commit()
            booking_id = booking.id

        async with session_local() as session:
            try:
                async with session.begin():
                    await sync_booking_statuses(session, now=now)
                    raise RuntimeError("force rollback")
            except RuntimeError:
                pass

        async with session_local() as session:
            reloaded = await session.get(Booking, booking_id)
            assert reloaded is not None
            assert reloaded.status == BookingStatus.active

        await engine.dispose()

    asyncio.run(scenario())


def test_invalid_terminal_transition_is_rejected():
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
        booking_id = create_response.json()["id"]

        cancel_response = client.delete(
            f"/api/v1/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert cancel_response.status_code == 204

        update_response = client.patch(
            f"/api/v1/bookings/{booking_id}",
            json={"status": BookingStatus.confirmed},
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )
        assert update_response.status_code == 409


def test_list_bookings_supports_statuses_filter():
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
        booking_id = create_response.json()["id"]

        client.delete(
            f"/api/v1/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )

        response = client.get(
            "/api/v1/bookings?statuses=cancelled&statuses=confirmed",
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )
        assert response.status_code == 200
        assert len(response.json()["items"]) == 1
        assert response.json()["items"][0]["status"] == BookingStatus.cancelled

def test_create_booking_auto_assign_success():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        payload = {
            "auto_assign": True,
            "parking_lot_id": 1,
            "start_time": (now + timedelta(minutes=10)).isoformat(),
            "end_time": (now + timedelta(minutes=40)).isoformat(),
            "recommendation_preferences": {
                "max_results": 5,
            },
        }
        response = client.post("/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {tokens['user']}"})
        assert response.status_code == 201
        body = response.json()
        assert body["parking_spot_id"] == 1
        assert body["assignment_mode"] == "auto"
        assert "Автоматически назначено место" in body["assignment_explanation"]
        assert body["decision_report"]["selected_spot_id"] == 1
        assert body["assignment_metadata"]["selected_spot_id"] == 1


def test_create_booking_rejects_mixed_manual_and_auto_assign_payload():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        payload = {
            "parking_spot_id": 1,
            "auto_assign": True,
            "parking_lot_id": 1,
            "start_time": (now + timedelta(minutes=10)).isoformat(),
            "end_time": (now + timedelta(minutes=40)).isoformat(),
        }
        response = client.post("/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {tokens['user']}"})
        assert response.status_code == 422


def test_create_booking_auto_assign_returns_409_when_no_candidates():
    _, tokens = _setup_state()
    now = datetime.utcnow()
    with TestClient(app) as client:
        manual_payload = {
            "parking_spot_id": 1,
            "start_time": (now + timedelta(minutes=10)).isoformat(),
            "end_time": (now + timedelta(minutes=40)).isoformat(),
            "type": BookingType.guest,
        }
        manual_create = client.post(
            "/api/v1/bookings",
            json=manual_payload,
            headers={"Authorization": f"Bearer {tokens['another']}"},
        )
        assert manual_create.status_code == 201

        auto_payload = {
            "auto_assign": True,
            "parking_lot_id": 1,
            "start_time": (now + timedelta(minutes=15)).isoformat(),
            "end_time": (now + timedelta(minutes=35)).isoformat(),
            "recommendation_filters": {
                "spot_types": ["regular"],
            },
        }
        auto_response = client.post(
            "/api/v1/bookings",
            json=auto_payload,
            headers={"Authorization": f"Bearer {tokens['user']}"},
        )
        assert auto_response.status_code == 409
        assert "No suitable parking spot" in auto_response.json()["detail"]
