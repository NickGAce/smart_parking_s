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
from app.services.analytics import (
    _adaptive_half_life_days,
    _calculate_forecast_error_metrics,
    _predict_bucket_value,
    _recency_weighted_activity_rate,
    _recency_weighted_mean,
    _same_hour_last_weeks_average,
    _spike_signal,
)


def _setup_state():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async def init_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            owner = User(email="owner-analytics@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            admin = User(email="admin-analytics@test.com", hashed_password=hash_password("secret123"), role=UserRole.admin)
            guard = User(email="guard-analytics@test.com", hashed_password=hash_password("secret123"), role=UserRole.guard)
            session.add_all([owner, admin, guard])
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
        "admin": create_access_token("2"),
        "guard": create_access_token("3"),
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


def test_forecast_quality_metrics_formula_for_fixed_dataset():
    metrics = _calculate_forecast_error_metrics(
        abs_errors=[10.0, 10.0, 10.0],
        squared_errors=[100.0, 100.0, 100.0],
        pct_errors=[10.0, 20.0, 25.0],
    )
    assert metrics.sample_size == 3
    assert metrics.mae == 10.0
    assert metrics.mape == 18.3333
    assert metrics.rmse == 10.0


def test_recency_weighted_mean_prioritizes_recent_values():
    reference = datetime(2026, 1, 8, 9, 0, 0)
    value = _recency_weighted_mean(
        items=[
            (datetime(2026, 1, 1, 9, 0, 0), 80.0),
            (datetime(2026, 1, 8, 8, 0, 0), 10.0),
        ],
        reference_time=reference,
        default=0.0,
        half_life_days=3.0,
    )
    assert value < 30.0


def test_predict_bucket_value_uses_same_hour_last_week_signal():
    history = [
        (datetime(2026, 1, 1, 9, 0, 0), 60.0),
        (datetime(2026, 1, 2, 9, 0, 0), 5.0),
        (datetime(2026, 1, 8, 9, 0, 0), 55.0),
        (datetime(2026, 1, 9, 9, 0, 0), 5.0),
    ]
    predicted, samples = _predict_bucket_value(datetime(2026, 1, 15, 9, 0, 0), history)
    assert samples == 2
    assert predicted > 10.0


def test_adaptive_half_life_grows_for_long_history():
    assert _adaptive_half_life_days(14) == 10.0
    assert _adaptive_half_life_days(120) == 36.0
    assert _adaptive_half_life_days(365) == 45.0


def test_same_hour_last_weeks_average_uses_broader_monthly_memory():
    history = [
        (datetime(2026, 1, 1, 9, 0, 0), 80.0),   # 8 weeks back
        (datetime(2026, 1, 8, 9, 0, 0), 60.0),   # 7 weeks back
        (datetime(2026, 2, 12, 9, 0, 0), 40.0),  # 2 weeks back
        (datetime(2026, 2, 19, 9, 0, 0), 20.0),  # 1 week back
    ]
    value = _same_hour_last_weeks_average(datetime(2026, 2, 26, 9, 0, 0), history)
    assert 20.0 < value < 50.0


def test_recency_weighted_activity_rate_for_sparse_series():
    reference = datetime(2026, 4, 10, 9, 0, 0)
    rate = _recency_weighted_activity_rate(
        items=[
            (datetime(2026, 4, 3, 9, 0, 0), 0.0),
            (datetime(2026, 4, 4, 9, 0, 0), 0.0),
            (datetime(2026, 4, 8, 9, 0, 0), 12.0),
            (datetime(2026, 4, 9, 9, 0, 0), 15.0),
        ],
        reference_time=reference,
        threshold=1.0,
        half_life_days=5.0,
    )
    assert 0.4 < rate < 0.8


def test_spike_signal_increases_when_recent_active_levels_present():
    reference = datetime(2026, 4, 10, 9, 0, 0)
    weak_signal = _spike_signal(
        bucket_start=reference,
        dow_hour_values=[(datetime(2026, 4, 3, 9, 0, 0), 0.0), (datetime(2026, 4, 9, 9, 0, 0), 0.0)],
        hour_values=[(datetime(2026, 4, 9, 8, 0, 0), 0.0)],
        default=2.0,
        half_life_days=7.0,
    )
    strong_signal = _spike_signal(
        bucket_start=reference,
        dow_hour_values=[(datetime(2026, 4, 3, 9, 0, 0), 0.0), (datetime(2026, 4, 9, 9, 0, 0), 14.0)],
        hour_values=[(datetime(2026, 4, 9, 8, 0, 0), 10.0), (datetime(2026, 4, 8, 9, 0, 0), 8.0)],
        default=2.0,
        half_life_days=7.0,
    )
    assert strong_signal > weak_signal


def test_forecast_quality_low_data_returns_low_confidence_and_explanation():
    tokens = _setup_state()

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/analytics/forecast-quality",
            params={
                "parking_lot_id": 1,
                "date_from": "2026-01-01T08:00:00",
                "date_to": "2026-01-01T10:00:00",
                "bucket": "hour",
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["confidence"] == "low"
        assert payload["sample_size"] == 2
        assert len(payload["comparison_series"]) == 2
        assert {"time_bucket", "actual_occupancy_percent", "predicted_occupancy_percent", "absolute_error"} <= set(
            payload["comparison_series"][0].keys()
        )
        assert "мало данных" in payload["explanation"].lower() or "низкая уверенность" in payload["explanation"].lower()


def test_forecast_quality_rbac_owner_admin_allowed_guard_forbidden():
    tokens = _setup_state()

    with TestClient(app) as client:
        owner_response = client.get(
            "/api/v1/analytics/forecast-quality",
            params={
                "parking_lot_id": 1,
                "date_from": "2026-01-01T00:00:00",
                "date_to": "2026-01-02T00:00:00",
                "bucket": "day",
            },
            headers={"Authorization": f"Bearer {tokens['owner']}"},
        )
        admin_response = client.get(
            "/api/v1/analytics/forecast-quality",
            params={
                "parking_lot_id": 1,
                "date_from": "2026-01-01T00:00:00",
                "date_to": "2026-01-02T00:00:00",
                "bucket": "day",
            },
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )
        guard_response = client.get(
            "/api/v1/analytics/forecast-quality",
            params={
                "parking_lot_id": 1,
                "date_from": "2026-01-01T00:00:00",
                "date_to": "2026-01-02T00:00:00",
                "bucket": "day",
            },
            headers={"Authorization": f"Bearer {tokens['guard']}"},
        )

        assert owner_response.status_code == 200
        assert admin_response.status_code == 200
        assert guard_response.status_code == 403
