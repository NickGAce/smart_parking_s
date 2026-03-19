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
            other_owner = User(email="owner2@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            tenant = User(email="tenant@test.com", hashed_password=hash_password("secret123"), role=UserRole.tenant)
            guard = User(email="guard@test.com", hashed_password=hash_password("secret123"), role=UserRole.guard)
            session.add_all([admin, owner, other_owner, tenant, guard])
            await session.flush()

            owner_lot = ParkingLot(
                name="Owner Lot",
                address="Addr 1",
                total_spots=10,
                guest_spot_percentage=10,
                owner_id=owner.id,
            )
            other_lot = ParkingLot(
                name="Other Lot",
                address="Addr 2",
                total_spots=8,
                guest_spot_percentage=20,
                owner_id=other_owner.id,
            )
            session.add_all([owner_lot, other_lot])
            await session.flush()

            session.add_all(
                [
                    ParkingSpot(
                        spot_number=1,
                        status=SpotStatus.available,
                        type="regular",
                        parking_lot_id=owner_lot.id,
                        owner_id=owner.id,
                    ),
                    ParkingSpot(
                        spot_number=2,
                        status=SpotStatus.available,
                        type="regular",
                        parking_lot_id=other_lot.id,
                        owner_id=other_owner.id,
                    ),
                ]
            )
            await session.commit()

    asyncio.run(init_db())

    async def override_get_session():
        async with session_local() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    tokens = {
        "admin": create_access_token("1"),
        "owner": create_access_token("2"),
        "other_owner": create_access_token("3"),
        "tenant": create_access_token("4"),
        "guard": create_access_token("5"),
    }
    return tokens


def test_parking_and_spot_requires_auth():
    _setup_state()
    with TestClient(app) as client:
        parking_response = client.get("/api/v1/parking")
        spots_response = client.get("/api/v1/parking_spots")

        assert parking_response.status_code == 401
        assert spots_response.status_code == 401


def test_tenant_and_guard_read_only_access():
    tokens = _setup_state()
    with TestClient(app) as client:
        tenant_list = client.get("/api/v1/parking", headers={"Authorization": f"Bearer {tokens['tenant']}"})
        guard_list = client.get("/api/v1/parking_spots", headers={"Authorization": f"Bearer {tokens['guard']}"})

        tenant_create = client.post(
            "/api/v1/parking",
            json={"name": "New Lot", "address": "Addr", "total_spots": 10, "guest_spot_percentage": 15},
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
        )
        guard_update = client.patch(
            "/api/v1/parking_spots/1",
            json={"type": "vip"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )

        assert tenant_list.status_code == 200
        assert guard_list.status_code == 200
        assert "items" in tenant_list.json()
        assert "items" in guard_list.json()
        assert tenant_create.status_code == 403
        assert guard_update.status_code == 403


def test_owner_has_access_only_to_own_parking_entities():
    tokens = _setup_state()
    with TestClient(app) as client:
        owner_lots = client.get("/api/v1/parking", headers={"Authorization": f"Bearer {tokens['owner']}"})
        owner_spots = client.get("/api/v1/parking_spots", headers={"Authorization": f"Bearer {tokens['owner']}"})
        forbidden_lot = client.patch(
            "/api/v1/parking/2",
            json={"name": "Hacked"},
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )

        assert owner_lots.status_code == 200
        assert len(owner_lots.json()["items"]) == 1
        assert owner_lots.json()["items"][0]["id"] == 1

        assert owner_spots.status_code == 200
        assert len(owner_spots.json()["items"]) == 1
        assert owner_spots.json()["items"][0]["parking_lot_id"] == 1
        assert forbidden_lot.status_code == 403


def test_admin_has_full_access():
    tokens = _setup_state()
    with TestClient(app) as client:
        delete_lot = client.delete("/api/v1/parking/2", headers={"Authorization": f"Bearer {tokens['admin']}"})
        delete_spot = client.delete("/api/v1/parking_spots/2", headers={"Authorization": f"Bearer {tokens['admin']}"})

        assert delete_lot.status_code == 204
        assert delete_spot.status_code in (204, 404)
