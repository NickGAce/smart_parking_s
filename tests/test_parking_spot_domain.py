import asyncio
import os

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret")

from app.api.deps import get_session
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.main import app
from app.models.parking_lot import ParkingLot
from app.models.user import User, UserRole


def _setup_state():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async def init_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            owner = User(email="owner-domain@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            session.add(owner)
            await session.flush()

            lot = ParkingLot(
                name="Domain Lot",
                address="Addr",
                total_spots=30,
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
        "owner": create_access_token("1"),
    }


def test_create_spot_with_extended_fields_and_zone_auto_create():
    tokens = _setup_state()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/parking_spots",
            json={
                "spot_number": 11,
                "parking_lot_id": 1,
                "spot_type": "ev",
                "vehicle_type": "car",
                "zone_name": "A1",
                "has_charger": True,
                "size_category": "large",
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )

        assert response.status_code == 201
        payload = response.json()
        assert payload["spot_type"] == "ev"
        assert payload["type"] == "ev"
        assert payload["vehicle_type"] == "car"
        assert payload["zone_name"] == "A1"
        assert payload["zone_id"] is not None
        assert payload["has_charger"] is True
        assert payload["size_category"] == "large"


def test_list_spots_filters_by_new_domain_fields():
    tokens = _setup_state()

    with TestClient(app) as client:
        first = client.post(
            "/api/v1/parking_spots",
            json={
                "spot_number": 1,
                "parking_lot_id": 1,
                "spot_type": "vip",
                "vehicle_type": "car",
                "zone_name": "VIP",
                "has_charger": False,
                "size_category": "large",
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        second = client.post(
            "/api/v1/parking_spots",
            json={
                "spot_number": 2,
                "parking_lot_id": 1,
                "spot_type": "guest",
                "vehicle_type": "bike",
                "zone_name": "Guest",
                "has_charger": False,
                "size_category": "small",
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert first.status_code == 201
        assert second.status_code == 201

        response = client.get(
            "/api/v1/parking_spots?spot_type=vip&vehicle_type=car&size_category=large&zone_name=VIP",
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["meta"]["total"] == 1
        assert payload["items"][0]["spot_number"] == 1


def test_backward_compatibility_type_field_still_supported():
    tokens = _setup_state()

    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/parking_spots",
            json={
                "spot_number": 6,
                "parking_lot_id": 1,
                "type": "guest",
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert create_response.status_code == 201
        assert create_response.json()["spot_type"] == "guest"

        spot_id = create_response.json()["id"]
        patch_response = client.patch(
            f"/api/v1/parking_spots/{spot_id}",
            json={"type": "vip"},
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert patch_response.status_code == 200
        assert patch_response.json()["spot_type"] == "vip"
        assert patch_response.json()["type"] == "vip"
