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
            admin = User(email="admin_a@test.com", hashed_password=hash_password("secret123"), role=UserRole.admin)
            target = User(email="target@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            tenant = User(email="tenant_a@test.com", hashed_password=hash_password("secret123"), role=UserRole.tenant)
            session.add_all([admin, target, tenant])
            await session.flush()

            lot = ParkingLot(name="Anomaly Lot", address="Addr", total_spots=4, guest_spot_percentage=10, owner_id=target.id)
            session.add(lot)
            await session.flush()

            spots = [
                ParkingSpot(spot_number=1, status=SpotStatus.available, type="regular", parking_lot_id=lot.id),
                ParkingSpot(spot_number=2, status=SpotStatus.blocked, type="regular", parking_lot_id=lot.id),
                ParkingSpot(spot_number=3, status=SpotStatus.blocked, type="regular", parking_lot_id=lot.id),
                ParkingSpot(spot_number=4, status=SpotStatus.blocked, type="regular", parking_lot_id=lot.id),
            ]
            session.add_all(spots)
            await session.flush()

            base = datetime(2026, 4, 10, 12, 0, 0)
            for i in range(3):
                session.add(
                    Booking(
                        parking_spot_id=spots[0].id,
                        user_id=target.id,
                        start_time=base + timedelta(minutes=i * 5),
                        end_time=base + timedelta(minutes=i * 5 + 45),
                        created_at=base - timedelta(minutes=20),
                        status=BookingStatus.cancelled,
                        type=BookingType.guest,
                    )
                )
            for i in range(2):
                session.add(
                    Booking(
                        parking_spot_id=spots[0].id,
                        user_id=target.id,
                        start_time=base + timedelta(hours=i + 1),
                        end_time=base + timedelta(hours=i + 2),
                        created_at=base + timedelta(minutes=10),
                        status=BookingStatus.no_show,
                        type=BookingType.guest,
                    )
                )

            baseline_day = datetime(2026, 4, 5, 8, 0, 0)
            for d in range(7):
                session.add(
                    Booking(
                        parking_spot_id=spots[0].id,
                        user_id=tenant.id,
                        start_time=baseline_day + timedelta(days=d),
                        end_time=baseline_day + timedelta(days=d, hours=1),
                        created_at=baseline_day + timedelta(days=d, hours=-5),
                        status=BookingStatus.confirmed,
                        type=BookingType.guest,
                    )
                )

            spike_start = datetime(2026, 4, 10, 0, 0, 0)
            for i in range(12):
                session.add(
                    Booking(
                        parking_spot_id=spots[0].id,
                        user_id=tenant.id,
                        start_time=spike_start + timedelta(minutes=15 * i),
                        end_time=spike_start + timedelta(minutes=15 * i + 50),
                        created_at=spike_start + timedelta(minutes=15 * i - 30),
                        status=BookingStatus.confirmed,
                        type=BookingType.guest,
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
        "target": create_access_token("2"),
        "tenant": create_access_token("3"),
    }


def test_anomalies_endpoint_returns_explainable_items():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/analytics/anomalies?from=2026-04-01T00:00:00&to=2026-04-10T23:59:00&user_id=2&parking_lot_id=1",
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )
        assert response.status_code == 200
        payload = response.json()
        anomaly_types = {item["anomaly_type"] for item in payload["items"]}

        assert "user.frequent_cancellations" in anomaly_types
        assert "user.frequent_no_show" in anomaly_types
        assert "user.last_minute_pattern" in anomaly_types
        assert "parking.occupancy_spike" in anomaly_types
        assert "parking.high_conflict_risk" in anomaly_types
        assert "parking.frequent_spot_blocking" in anomaly_types
        assert payload["items"][0]["reason"]
        assert payload["items"][0]["related_entity"]["entity_id"]


def test_anomalies_endpoint_scopes_regular_user_to_self():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/analytics/anomalies?user_id=2",
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
        )
        assert response.status_code == 403


def test_anomalies_endpoint_has_default_period_and_rules_list():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/analytics/anomalies",
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["period_from"]
        assert payload["period_to"]
        assert len(payload["rules"]) >= 6
