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
from app.models.user import User, UserRole


def _setup_state():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async def init_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            admin = User(email="admin-pagination@test.com", hashed_password=hash_password("secret123"), role=UserRole.admin)
            owner = User(email="owner-pagination@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            session.add_all([admin, owner])
            await session.flush()

            lot = ParkingLot(
                name="Pagination Lot",
                address="Addr",
                total_spots=20,
                guest_spot_percentage=20,
                owner_id=owner.id,
            )
            session.add(lot)
            await session.commit()

    asyncio.run(init_db())

    async def override_get_session():
        async with session_local() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    return {
        "admin": create_access_token("1"),
        "owner": create_access_token("2"),
    }


def test_unique_spot_number_per_lot_constraint_is_enforced():
    tokens = _setup_state()

    with TestClient(app) as client:
        first = client.post(
            "/api/v1/parking_spots",
            json={"spot_number": 10, "parking_lot_id": 1, "type": "regular"},
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert first.status_code == 201

        duplicate = client.post(
            "/api/v1/parking_spots",
            json={"spot_number": 10, "parking_lot_id": 1, "type": "regular"},
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert duplicate.status_code == 409


def test_parking_spots_list_supports_limit_offset_and_sorting():
    tokens = _setup_state()

    with TestClient(app) as client:
        for spot_number in [3, 1, 2]:
            response = client.post(
                "/api/v1/parking_spots",
                json={"spot_number": spot_number, "parking_lot_id": 1, "type": "regular"},
                headers={"Authorization": f"Bearer {tokens['owner']}"},
            )
            assert response.status_code == 201

        list_response = client.get(
            "/api/v1/parking_spots?limit=2&offset=1&sort_by=spot_number&sort_order=asc",
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )

        assert list_response.status_code == 200
        payload = list_response.json()
        assert payload["meta"] == {"limit": 2, "offset": 1, "total": 3}
        assert [item["spot_number"] for item in payload["items"]] == [2, 3]


def test_bookings_list_supports_limit_offset_and_sorting():
    tokens = _setup_state()
    now = datetime.utcnow()

    with TestClient(app) as client:
        spot_response = client.post(
            "/api/v1/parking_spots",
            json={"spot_number": 1, "parking_lot_id": 1, "type": "regular"},
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert spot_response.status_code == 201

        for idx in range(3):
            response = client.post(
                "/api/v1/bookings",
                json={
                    "parking_spot_id": 1,
                    "start_time": (now + timedelta(hours=idx * 2 + 1)).isoformat(),
                    "end_time": (now + timedelta(hours=idx * 2 + 2)).isoformat(),
                    "type": BookingType.guest,
                },
                headers={"Authorization": f"Bearer {tokens['owner']}"},
            )
            assert response.status_code == 201

        list_response = client.get(
            "/api/v1/bookings?limit=2&offset=1&sort_by=start_time&sort_order=asc",
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )

        assert list_response.status_code == 200
        payload = list_response.json()
        assert payload["meta"] == {"limit": 2, "offset": 1, "total": 3}
        assert len(payload["items"]) == 2
        assert payload["items"][0]["start_time"] < payload["items"][1]["start_time"]


def test_parking_lots_list_supports_limit_offset_and_sorting():
    tokens = _setup_state()

    with TestClient(app) as client:
        for lot_name in ["Lot C", "Lot A", "Lot B"]:
            response = client.post(
                "/api/v1/parking",
                json={
                    "name": lot_name,
                    "address": f"Address {lot_name}",
                    "total_spots": 15,
                    "guest_spot_percentage": 25,
                },
                headers={"Authorization": f"Bearer {tokens['admin']}"},
            )
            assert response.status_code == 201

        list_response = client.get(
            "/api/v1/parking?limit=2&offset=1&sort_by=name&sort_order=asc",
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )

        assert list_response.status_code == 200
        payload = list_response.json()
        assert payload["meta"] == {"limit": 2, "offset": 1, "total": 4}
        assert [item["name"] for item in payload["items"]] == ["Lot B", "Lot C"]
