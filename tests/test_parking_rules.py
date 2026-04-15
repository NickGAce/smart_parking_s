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
from app.models.booking import BookingType
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
            owner = User(email="rules-owner@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            tenant = User(email="rules-tenant@test.com", hashed_password=hash_password("secret123"), role=UserRole.tenant)
            guard = User(email="rules-guard@test.com", hashed_password=hash_password("secret123"), role=UserRole.guard)
            session.add_all([owner, tenant, guard])
            await session.flush()

            lot = ParkingLot(name="Rules Lot", address="Addr", total_spots=20, owner_id=owner.id)
            session.add(lot)
            await session.flush()

            spot = ParkingSpot(
                spot_number=1,
                status=SpotStatus.available,
                type="regular",
                parking_lot_id=lot.id,
                owner_id=owner.id,
            )
            session.add(spot)
            await session.commit()

    asyncio.run(init_db())

    async def override_get_session():
        async with session_local() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    return {
        "owner": create_access_token("1"),
        "tenant": create_access_token("2"),
        "guard": create_access_token("3"),
    }


def test_update_and_get_rules_successfully():
    tokens = _setup_state()

    with TestClient(app) as client:
        update_response = client.put(
            "/api/v1/parking/1/rules",
            json={
                "access_mode": "mixed",
                "allowed_user_roles": ["owner", "guard"],
                "min_booking_minutes": 30,
                "max_booking_minutes": 180,
                "booking_step_minutes": 30,
                "max_advance_minutes": 1440,
                "working_hours": [
                    {"day_of_week": 0, "open_time": "09:00:00", "close_time": "18:00:00", "is_closed": False}
                ],
                "exceptions": [
                    {"date": "2030-01-01", "is_closed": True}
                ],
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert update_response.status_code == 200

        get_response = client.get(
            "/api/v1/parking/1/rules",
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert get_response.status_code == 200
        payload = get_response.json()
        assert payload["allowed_user_roles"] == ["owner", "guard"]
        assert payload["working_hours"][0]["day_of_week"] == 0


def test_booking_validation_rejects_forbidden_role_and_wrong_duration():
    tokens = _setup_state()
    with TestClient(app) as client:
        rules_response = client.put(
            "/api/v1/parking/1/rules",
            json={
                "access_mode": "employees_only",
                "allowed_user_roles": ["owner", "guard"],
                "min_booking_minutes": 60,
                "max_booking_minutes": 180,
                "booking_step_minutes": 30,
                "max_advance_minutes": 10080,
                "working_hours": [
                    {
                        "day_of_week": (datetime.utcnow() + timedelta(days=1)).weekday(),
                        "open_time": "08:00:00",
                        "close_time": "20:00:00",
                        "is_closed": False,
                    }
                ],
                "exceptions": [],
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert rules_response.status_code == 200

        start = datetime.utcnow() + timedelta(days=1)
        start = start.replace(hour=9, minute=0, second=0, microsecond=0)

        tenant_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(minutes=60)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
        )
        assert tenant_response.status_code == 403
        assert "employees" in tenant_response.json()["detail"]

        guard_response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(minutes=45)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert guard_response.status_code == 400
        assert "minimum" in guard_response.json()["detail"]


def test_booking_validation_rejects_outside_working_hours():
    tokens = _setup_state()
    with TestClient(app) as client:
        day = (datetime.utcnow() + timedelta(days=2)).weekday()
        rules_response = client.put(
            "/api/v1/parking/1/rules",
            json={
                "access_mode": "mixed",
                "allowed_user_roles": [],
                "min_booking_minutes": 30,
                "max_booking_minutes": 240,
                "booking_step_minutes": 30,
                "max_advance_minutes": 10080,
                "working_hours": [
                    {"day_of_week": day, "open_time": "10:00:00", "close_time": "18:00:00", "is_closed": False}
                ],
                "exceptions": [],
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert rules_response.status_code == 200

        start = datetime.utcnow() + timedelta(days=2)
        start = start.replace(hour=9, minute=0, second=0, microsecond=0)

        response = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(minutes=60)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert response.status_code == 400
        assert "working hours" in response.json()["detail"]


def test_update_rules_rejects_duplicate_working_days():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.put(
            "/api/v1/parking/1/rules",
            json={
                "access_mode": "mixed",
                "allowed_user_roles": [],
                "min_booking_minutes": 30,
                "max_booking_minutes": 240,
                "booking_step_minutes": 30,
                "max_advance_minutes": 10080,
                "working_hours": [
                    {"day_of_week": 0, "open_time": "09:00:00", "close_time": "18:00:00", "is_closed": False},
                    {"day_of_week": 0, "open_time": "10:00:00", "close_time": "17:00:00", "is_closed": False},
                ],
                "exceptions": [],
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert response.status_code == 422
        assert "duplicate day_of_week" in response.text


def test_update_rules_rejects_duplicate_exception_dates():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.put(
            "/api/v1/parking/1/rules",
            json={
                "access_mode": "mixed",
                "allowed_user_roles": [],
                "min_booking_minutes": 30,
                "max_booking_minutes": 240,
                "booking_step_minutes": 30,
                "max_advance_minutes": 10080,
                "working_hours": [],
                "exceptions": [
                    {"date": "2030-01-01", "is_closed": True},
                    {"date": "2030-01-01", "is_closed": False, "open_time": "09:00:00", "close_time": "12:00:00"},
                ],
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert response.status_code == 422
        assert "duplicate date" in response.text
