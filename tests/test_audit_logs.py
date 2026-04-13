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
from app.models.audit_log import AuditLog
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
            admin = User(email="admin@test.com", hashed_password=hash_password("secret123"), role=UserRole.admin)
            owner = User(email="owner@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            session.add_all([admin, owner])
            await session.flush()

            lot = ParkingLot(name="Lot A", address="Addr", total_spots=10, guest_spot_percentage=10)
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
        "engine": engine,
        "admin": create_access_token("1"),
        "owner": create_access_token("2"),
    }


def test_booking_create_produces_audit_log_and_admin_can_view_logs():
    state = _setup_state()
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
            headers={"Authorization": f"Bearer {state['owner']}"},
        )
        assert create_response.status_code == 201

        logs_response = client.get(
            "/api/v1/audit-logs?action_type=booking.create",
            headers={"Authorization": f"Bearer {state['admin']}"},
        )
        assert logs_response.status_code == 200
        payload = logs_response.json()
        assert payload["meta"]["total"] >= 1
        assert any(item["action_type"] == "booking.create" for item in payload["items"])


def test_non_admin_cannot_view_audit_logs():
    state = _setup_state()

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/audit-logs",
            headers={"Authorization": f"Bearer {state['owner']}"},
        )
        assert response.status_code == 403


def test_admin_user_update_role_produces_audit_log_record():
    state = _setup_state()

    with TestClient(app) as client:
        create_user_response = client.post(
            "/api/v1/admin/users",
            json={"email": "user3@test.com", "password": "secret123", "role": UserRole.owner},
            headers={"Authorization": f"Bearer {state['admin']}"},
        )
        assert create_user_response.status_code == 200
        user_id = create_user_response.json()["id"]

        update_role_response = client.patch(
            f"/api/v1/admin/users/{user_id}",
            json={"role": UserRole.tenant},
            headers={"Authorization": f"Bearer {state['admin']}"},
        )
        assert update_role_response.status_code == 200

    async def fetch_logs():
        session_local = async_sessionmaker(state["engine"], expire_on_commit=False)
        async with session_local() as session:
            result = await session.execute(
                select(AuditLog).where(AuditLog.action_type == "admin.user.update_role")
            )
            return result.scalars().all()

    logs = asyncio.run(fetch_logs())
    assert len(logs) == 1
    assert logs[0].new_values["role"] == UserRole.tenant
