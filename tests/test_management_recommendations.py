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
from app.models.audit_log import AuditLog
from app.models.booking import Booking, BookingStatus, BookingType
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotType
from app.models.parking_zone import ParkingZone
from app.models.user import User, UserRole


def _setup_state():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async def init_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            admin = User(email="admin-mr@test.com", hashed_password=hash_password("secret123"), role=UserRole.admin)
            owner = User(email="owner-mr@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            owner_2 = User(email="owner2-mr@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            tenant = User(email="tenant-mr@test.com", hashed_password=hash_password("secret123"), role=UserRole.tenant)
            session.add_all([admin, owner, owner_2, tenant])
            await session.flush()

            lot = ParkingLot(name="MR Lot", address="Addr", total_spots=20, guest_spot_percentage=40, owner_id=owner.id)
            other_lot = ParkingLot(name="Other Lot", address="Addr2", total_spots=5, guest_spot_percentage=20, owner_id=owner_2.id)
            session.add_all([lot, other_lot])
            await session.flush()

            zone_busy = ParkingZone(parking_lot_id=lot.id, name="Busy")
            zone_idle = ParkingZone(parking_lot_id=lot.id, name="Idle")
            session.add_all([zone_busy, zone_idle])
            await session.flush()

            busy_spots = [
                ParkingSpot(spot_number=index + 1, parking_lot_id=lot.id, zone_id=zone_busy.id, type="regular", spot_type=SpotType.regular)
                for index in range(16)
            ]
            idle_spots = [
                ParkingSpot(spot_number=100 + index + 1, parking_lot_id=lot.id, zone_id=zone_idle.id, type="guest", spot_type=SpotType.guest)
                for index in range(4)
            ]
            other_spot = ParkingSpot(spot_number=1, parking_lot_id=other_lot.id, type="regular", spot_type=SpotType.regular)
            session.add_all([*busy_spots, *idle_spots, other_spot])
            await session.flush()

            start_period = datetime(2026, 4, 1, 0, 0, 0)
            end_period = datetime(2026, 4, 8, 0, 0, 0)

            for day in range(7):
                day_start = start_period + timedelta(days=day, hours=8)
                for i in range(14):
                    spot = busy_spots[i]
                    session.add(
                        Booking(
                            parking_spot_id=spot.id,
                            user_id=owner.id,
                            type=BookingType.guest,
                            status=BookingStatus.completed,
                            start_time=day_start,
                            end_time=day_start + timedelta(hours=12),
                            created_at=day_start - timedelta(days=2),
                        )
                    )

                for i in range(3):
                    session.add(
                        Booking(
                            parking_spot_id=busy_spots[i].id,
                            user_id=owner.id,
                            type=BookingType.guest,
                            status=BookingStatus.no_show,
                            start_time=day_start + timedelta(hours=i),
                            end_time=day_start + timedelta(hours=i + 2),
                            created_at=day_start - timedelta(hours=2),
                        )
                    )

                for i in range(2):
                    session.add(
                        Booking(
                            parking_spot_id=busy_spots[i].id,
                            user_id=owner.id,
                            type=BookingType.guest,
                            status=BookingStatus.cancelled,
                            start_time=day_start + timedelta(hours=5 + i),
                            end_time=day_start + timedelta(hours=6 + i),
                            created_at=day_start - timedelta(hours=3),
                        )
                    )

            growth_start = datetime(2026, 4, 5, 8, 0, 0)
            for i in range(8):
                session.add(
                    Booking(
                        parking_spot_id=busy_spots[(i % 4)].id,
                        user_id=owner.id,
                        type=BookingType.guest,
                        status=BookingStatus.cancelled,
                        start_time=growth_start + timedelta(hours=i),
                        end_time=growth_start + timedelta(hours=i + 1),
                        created_at=growth_start + timedelta(hours=i - 1),
                    )
                )

            session.add(
                Booking(
                    parking_spot_id=idle_spots[0].id,
                    user_id=owner.id,
                    type=BookingType.guest,
                    status=BookingStatus.completed,
                    start_time=datetime(2026, 4, 2, 10, 0, 0),
                    end_time=datetime(2026, 4, 2, 11, 0, 0),
                )
            )

            for i in range(6):
                session.add(
                    AuditLog(
                        actor_user_id=owner.id,
                        action_type="anpr.unknown_plate_detected",
                        entity_type="parking_lot",
                        entity_id=str(lot.id),
                        source_metadata={"unknown_plate": True},
                        timestamp=datetime(2026, 4, 6, 12, i, 0),
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
        "owner2": create_access_token("3"),
        "tenant": create_access_token("4"),
    }


def _fetch_items(client: TestClient, token: str, parking_lot_id: int = 1, severity: str | None = None):
    params = {
        "parking_lot_id": parking_lot_id,
        "date_from": "2026-04-01T00:00:00",
        "date_to": "2026-04-08T00:00:00",
    }
    if severity:
        params["severity"] = severity
    response = client.get(
        "/api/v1/analytics/management-recommendations",
        params=params,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    return response.json()["items"]


def test_management_recommendations_contains_overload_no_show_and_cancellation():
    tokens = _setup_state()
    with TestClient(app) as client:
        types = {item["type"] for item in _fetch_items(client, tokens["admin"])}
        assert "overload" in types
        assert "no_show" in types
        assert "cancellation" in types


def test_management_recommendations_contains_underutilization_and_zone_imbalance():
    tokens = _setup_state()
    with TestClient(app) as client:
        types = {item["type"] for item in _fetch_items(client, tokens["admin"])}
        assert "underutilization" in types
        assert "zone_imbalance" in types


def test_management_recommendations_contains_rule_change_and_security():
    tokens = _setup_state()
    with TestClient(app) as client:
        items = _fetch_items(client, tokens["admin"])
        types = {item["type"] for item in items}
        assert "rule_change" in types
        assert "security" in types
        security_item = next(item for item in items if item["type"] == "security")
        assert "неизвестными номерами" in security_item["evidence"]


def test_management_recommendations_supports_severity_filter():
    tokens = _setup_state()
    with TestClient(app) as client:
        items = _fetch_items(client, tokens["admin"], severity="critical")
        assert items
        assert all(item["severity"] == "critical" for item in items)


def test_management_recommendations_owner_sees_only_own_parking():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/analytics/management-recommendations",
            params={
                "parking_lot_id": 2,
                "date_from": "2026-04-01T00:00:00",
                "date_to": "2026-04-08T00:00:00",
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        assert response.status_code == 200
        assert response.json()["items"] == []


def test_management_recommendations_denies_tenant():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/analytics/management-recommendations",
            params={
                "date_from": "2026-04-01T00:00:00",
                "date_to": "2026-04-08T00:00:00",
            },
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
        )
        assert response.status_code == 403


def test_management_recommendations_accepts_utc_z_datetimes():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/analytics/management-recommendations",
            params={
                "date_from": "2026-04-01T00:00:00.000Z",
                "date_to": "2026-04-08T00:00:00.000Z",
            },
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )
        assert response.status_code == 200
