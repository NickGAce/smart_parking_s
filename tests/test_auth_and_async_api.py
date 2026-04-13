import asyncio
import os
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
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
            admin = User(email="admin-auth@test.com", hashed_password=hash_password("secret123"), role=UserRole.admin)
            owner = User(email="owner-auth@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            guard = User(email="guard-auth@test.com", hashed_password=hash_password("secret123"), role=UserRole.guard)
            session.add_all([admin, owner, guard])
            await session.flush()

            lot = ParkingLot(
                name="Auth Lot",
                address="Addr",
                total_spots=5,
                guest_spot_percentage=20,
                owner_id=owner.id,
            )
            session.add(lot)
            await session.flush()

            session.add(
                ParkingSpot(
                    spot_number=1,
                    status=SpotStatus.available,
                    type="regular",
                    parking_lot_id=lot.id,
                    owner_id=owner.id,
                )
            )
            await session.commit()

    asyncio.run(init_db())

    async def override_get_session():
        async with session_local() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    return {
        "admin": create_access_token("1"),
        "owner": create_access_token("2"),
        "guard": create_access_token("3"),
    }


def test_auth_register_login_and_duplicate_email():
    _setup_state()
    with TestClient(app) as client:
        register = client.post(
            "/api/v1/auth/register",
            json={"email": "new-user@test.com", "password": "secret123"},
        )
        assert register.status_code == 201
        assert register.json()["role"] == UserRole.owner

        login = client.post(
            "/api/v1/auth/login",
            data={"username": "new-user@test.com", "password": "secret123"},
        )
        assert login.status_code == 200
        assert login.json()["token_type"] == "bearer"
        assert login.json()["access_token"]

        duplicate = client.post(
            "/api/v1/auth/register",
            json={"email": "new-user@test.com", "password": "secret123"},
        )
        assert duplicate.status_code == 409


def test_auth_login_rejects_wrong_password():
    _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "owner-auth@test.com", "password": "wrong-password"},
        )
        assert response.status_code == 401


def test_adjacent_bookings_do_not_conflict():
    tokens = _setup_state()
    now = datetime.utcnow().replace(microsecond=0)
    with TestClient(app) as client:
        first = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=10)).isoformat(),
                "end_time": (now + timedelta(minutes=40)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert first.status_code == 201

        adjacent = client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=40)).isoformat(),
                "end_time": (now + timedelta(minutes=60)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert adjacent.status_code == 201


def test_list_bookings_rejects_mixed_status_filters():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/bookings?status=confirmed&statuses=active",
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )
        assert response.status_code == 400


def test_check_out_is_forbidden_for_confirmed_booking():
    tokens = _setup_state()
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
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert create_response.status_code == 201
        booking_id = create_response.json()["id"]

        check_out_response = client.post(
            f"/api/v1/bookings/{booking_id}/check-out",
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert check_out_response.status_code == 409


@pytest.mark.asyncio
async def test_async_api_booking_flow_smoke():
    tokens = _setup_state()
    now = datetime.utcnow()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        create_response = await client.post(
            "/api/v1/bookings",
            json={
                "parking_spot_id": 1,
                "start_time": (now + timedelta(minutes=1)).isoformat(),
                "end_time": (now + timedelta(minutes=31)).isoformat(),
                "type": BookingType.guest,
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert create_response.status_code == 201
        booking_id = create_response.json()["id"]

        check_in = await client.post(
            f"/api/v1/bookings/{booking_id}/check-in",
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert check_in.status_code == 200
        assert check_in.json()["status"] == BookingStatus.active

        check_out = await client.post(
            f"/api/v1/bookings/{booking_id}/check-out",
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert check_out.status_code == 200
        assert check_out.json()["status"] == BookingStatus.completed
