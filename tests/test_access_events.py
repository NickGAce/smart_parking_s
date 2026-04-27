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
from app.models.booking import Booking, BookingStatus, BookingType
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
            guard = User(email="guard@test.com", hashed_password=hash_password("secret123"), role=UserRole.guard)
            tenant = User(email="tenant@test.com", hashed_password=hash_password("secret123"), role=UserRole.tenant)
            stranger = User(email="stranger@test.com", hashed_password=hash_password("secret123"), role=UserRole.tenant)
            session.add_all([admin, owner, guard, tenant, stranger])
            await session.flush()

            lot = ParkingLot(name="Lot A", address="Addr", total_spots=10, guest_spot_percentage=10, owner_id=owner.id)
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
            await session.flush()

            now = datetime.utcnow()
            booking_confirmed = Booking(
                start_time=now - timedelta(minutes=5),
                end_time=now + timedelta(minutes=55),
                type=BookingType.guest,
                status=BookingStatus.confirmed,
                parking_spot_id=spot.id,
                user_id=tenant.id,
                plate_number="A123BC77",
            )
            booking_active = Booking(
                start_time=now - timedelta(minutes=30),
                end_time=now + timedelta(minutes=30),
                type=BookingType.guest,
                status=BookingStatus.active,
                parking_spot_id=spot.id,
                user_id=tenant.id,
                plate_number="B456CD77",
            )
            session.add_all([booking_confirmed, booking_active])
            await session.commit()

    asyncio.run(init_db())

    async def override_get_session():
        async with session_local() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    tokens = {
        "admin": create_access_token("1"),
        "owner": create_access_token("2"),
        "guard": create_access_token("3"),
        "tenant": create_access_token("4"),
        "stranger": create_access_token("5"),
    }
    return engine, tokens


def test_successful_entry_by_known_plate():
    engine, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/manual",
            json={"parking_lot_id": 1, "direction": "entry", "plate_number": "A123BC 77"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        assert response.json()["decision"] == "allowed"

    async def verify():
        session_local = async_sessionmaker(engine, expire_on_commit=False)
        async with session_local() as session:
            booking = (await session.execute(select(Booking).where(Booking.plate_number == "A123BC77"))).scalar_one()
            assert booking.status == BookingStatus.active

    asyncio.run(verify())


def test_unknown_plate_creates_review_event():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/manual",
            json={"parking_lot_id": 1, "direction": "entry", "plate_number": "ZZZ999"},
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert response.status_code == 201
        payload = response.json()
        assert payload["decision"] == "review"
        assert payload["booking_id"] is None


def test_exit_completes_active_booking():
    engine, tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/access-events/manual",
            json={"parking_lot_id": 1, "direction": "exit", "plate_number": "B456CD77"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert response.status_code == 201
        assert response.json()["decision"] == "allowed"

    async def verify():
        session_local = async_sessionmaker(engine, expire_on_commit=False)
        async with session_local() as session:
            booking = (await session.execute(select(Booking).where(Booking.plate_number == "B456CD77"))).scalar_one()
            assert booking.status == BookingStatus.completed

    asyncio.run(verify())


def test_access_events_rbac_visibility():
    _, tokens = _setup_state()
    with TestClient(app) as client:
        seed = client.post(
            "/api/v1/access-events/manual",
            json={"parking_lot_id": 1, "direction": "entry", "plate_number": "A123BC77"},
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )
        assert seed.status_code == 201

        admin_list = client.get("/api/v1/access-events", headers={"Authorization": f"Bearer {tokens['admin']}"})
        owner_list = client.get("/api/v1/access-events", headers={"Authorization": f"Bearer {tokens['owner']}"})
        guard_list = client.get("/api/v1/access-events", headers={"Authorization": f"Bearer {tokens['guard']}"})
        tenant_list = client.get("/api/v1/access-events", headers={"Authorization": f"Bearer {tokens['tenant']}"})
        stranger_list = client.get("/api/v1/access-events", headers={"Authorization": f"Bearer {tokens['stranger']}"})

        assert admin_list.status_code == 200 and admin_list.json()["meta"]["total"] >= 1
        assert owner_list.status_code == 200 and owner_list.json()["meta"]["total"] >= 1
        assert guard_list.status_code == 200 and guard_list.json()["meta"]["total"] >= 1
        assert tenant_list.status_code == 200 and tenant_list.json()["meta"]["total"] >= 1
        assert stranger_list.status_code == 200 and stranger_list.json()["meta"]["total"] == 0
