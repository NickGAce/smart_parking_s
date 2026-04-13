import asyncio
import os
from datetime import datetime

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
            owner = User(email="owner-analytics@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            session.add(owner)
            await session.flush()

            lot = ParkingLot(name="Analytics Lot", address="Addr", total_spots=10, guest_spot_percentage=20, owner_id=owner.id)
            session.add(lot)
            await session.flush()

            zone_a = ParkingZone(parking_lot_id=lot.id, name="A")
            zone_b = ParkingZone(parking_lot_id=lot.id, name="B")
            session.add_all([zone_a, zone_b])
            await session.flush()

            spot_1 = ParkingSpot(spot_number=1, parking_lot_id=lot.id, zone_id=zone_a.id, type="regular", spot_type=SpotType.regular)
            spot_2 = ParkingSpot(spot_number=2, parking_lot_id=lot.id, zone_id=zone_a.id, type="ev", spot_type=SpotType.ev)
            spot_3 = ParkingSpot(spot_number=3, parking_lot_id=lot.id, zone_id=zone_b.id, type="guest", spot_type=SpotType.guest)
            session.add_all([spot_1, spot_2, spot_3])
            await session.flush()

            bookings = [
                Booking(
                    parking_spot_id=spot_1.id,
                    user_id=owner.id,
                    type=BookingType.guest,
                    status=BookingStatus.completed,
                    start_time=datetime(2026, 1, 1, 8, 0, 0),
                    end_time=datetime(2026, 1, 1, 10, 0, 0),
                ),
                Booking(
                    parking_spot_id=spot_2.id,
                    user_id=owner.id,
                    type=BookingType.guest,
                    status=BookingStatus.no_show,
                    start_time=datetime(2026, 1, 1, 9, 0, 0),
                    end_time=datetime(2026, 1, 1, 10, 0, 0),
                ),
                Booking(
                    parking_spot_id=spot_3.id,
                    user_id=owner.id,
                    type=BookingType.guest,
                    status=BookingStatus.cancelled,
                    start_time=datetime(2026, 1, 1, 11, 0, 0),
                    end_time=datetime(2026, 1, 1, 12, 0, 0),
                ),
            ]
            session.add_all(bookings)
            await session.commit()

    asyncio.run(init_db())

    async def override_get_session():
        async with session_local() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    return {
        "owner": create_access_token("1"),
    }


def test_analytics_summary_returns_main_kpis():
    tokens = _setup_state()

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/analytics/summary",
            params={
                "parking_lot_id": 1,
                "from": "2026-01-01T07:00:00",
                "to": "2026-01-01T13:00:00",
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["bookings_count"] == 3
        assert payload["average_booking_duration_minutes"] == 80.0
        assert payload["cancellation_rate"] == 0.3333
        assert payload["no_show_rate"] == 0.3333
        assert payload["occupancy_percent"] == 16.67


def test_analytics_occupancy_supports_zone_filter_and_peak_hours():
    tokens = _setup_state()

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/analytics/occupancy",
            params={
                "parking_lot_id": 1,
                "zone": "A",
                "from": "2026-01-01T07:00:00",
                "to": "2026-01-01T13:00:00",
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["filters"]["zone"] == "A"
        assert payload["occupancy_percent"] == 25.0
        assert payload["by_zone"] == [{"zone": "A", "occupancy_percent": 25.0}]
        assert payload["by_spot_type"][0]["spot_type"] in {"regular", "ev"}
        assert payload["peak_hours"][0] == {"hour": 8, "bookings": 1}


def test_occupancy_forecast_returns_hourly_buckets_for_target_date():
    tokens = _setup_state()

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/analytics/occupancy-forecast",
            params={
                "parking_lot_id": 1,
                "target_date": "2026-01-02",
                "history_days": 14,
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["target_from"] == "2026-01-02T00:00:00"
        assert payload["target_to"] == "2026-01-03T00:00:00"
        assert len(payload["forecast"]) == 24
        assert {"time_bucket", "predicted_occupancy_percent", "confidence", "comment", "samples"}.issubset(
            payload["forecast"][0].keys()
        )


def test_occupancy_forecast_supports_zone_filter():
    tokens = _setup_state()

    with TestClient(app) as client:
        response_a = client.get(
            "/api/v1/analytics/occupancy-forecast",
            params={
                "parking_lot_id": 1,
                "zone": "A",
                "target_date": "2026-01-02",
                "history_days": 14,
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        response_b = client.get(
            "/api/v1/analytics/occupancy-forecast",
            params={
                "parking_lot_id": 1,
                "zone": "B",
                "target_date": "2026-01-02",
                "history_days": 14,
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )

        assert response_a.status_code == 200
        assert response_b.status_code == 200

        forecast_a = response_a.json()["forecast"]
        forecast_b = response_b.json()["forecast"]

        zone_a_9am = next(item for item in forecast_a if item["time_bucket"].endswith("09:00:00"))
        zone_b_9am = next(item for item in forecast_b if item["time_bucket"].endswith("09:00:00"))
        assert zone_a_9am["predicted_occupancy_percent"] > zone_b_9am["predicted_occupancy_percent"]
