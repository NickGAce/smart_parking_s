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
from app.models.parking_spot import ParkingSpot, SpotStatus, SpotType
from app.models.parking_zone import AccessLevel, ParkingZone, ZoneType
from app.models.user import User, UserRole


def _setup_state():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async def init_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            owner = User(email="owner_r@test.com", hashed_password=hash_password("secret123"), role=UserRole.owner)
            tenant = User(email="tenant_r@test.com", hashed_password=hash_password("secret123"), role=UserRole.tenant)
            session.add_all([owner, tenant])
            await session.flush()

            lot = ParkingLot(
                name="Rec Lot",
                address="Addr",
                total_spots=20,
                guest_spot_percentage=10,
                owner_id=owner.id,
            )
            session.add(lot)
            await session.flush()

            public_zone = ParkingZone(
                parking_lot_id=lot.id,
                name="Public A",
                zone_type=ZoneType.general,
                access_level=AccessLevel.public,
            )
            vip_zone = ParkingZone(
                parking_lot_id=lot.id,
                name="VIP",
                zone_type=ZoneType.premium,
                access_level=AccessLevel.vip_only,
            )
            session.add_all([public_zone, vip_zone])
            await session.flush()

            spot1 = ParkingSpot(
                spot_number=1,
                status=SpotStatus.available,
                type="regular",
                spot_type=SpotType.regular,
                has_charger=False,
                parking_lot_id=lot.id,
                zone_id=public_zone.id,
            )
            spot2 = ParkingSpot(
                spot_number=2,
                status=SpotStatus.available,
                type="ev",
                spot_type=SpotType.ev,
                has_charger=True,
                parking_lot_id=lot.id,
                zone_id=public_zone.id,
            )
            spot3 = ParkingSpot(
                spot_number=3,
                status=SpotStatus.available,
                type="vip",
                spot_type=SpotType.vip,
                has_charger=True,
                parking_lot_id=lot.id,
                zone_id=vip_zone.id,
            )
            blocked_spot = ParkingSpot(
                spot_number=4,
                status=SpotStatus.blocked,
                type="regular",
                spot_type=SpotType.regular,
                has_charger=False,
                parking_lot_id=lot.id,
                zone_id=public_zone.id,
            )
            session.add_all([spot1, spot2, spot3, blocked_spot])
            await session.flush()

            session.add(
                Booking(
                    parking_spot_id=spot1.id,
                    user_id=tenant.id,
                    start_time=datetime(2026, 4, 7, 9, 0, 0),
                    end_time=datetime(2026, 4, 7, 10, 0, 0),
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

    tokens = {
        "tenant": create_access_token("2"),
    }
    return tokens


def test_recommendation_respects_preferences_and_explainability():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/recommendations/spots",
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
            json={
                "parking_lot_id": 1,
                "from": "2026-04-07T08:00:00",
                "to": "2026-04-07T08:30:00",
                "preferences": {
                    "preferred_spot_types": ["ev"],
                    "prefer_charger": True,
                    "max_results": 3,
                },
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["total_candidates"] == 2
        assert payload["recommended_spots"][0]["spot_number"] == 2
        assert payload["recommended_spots"][0]["score"] > payload["recommended_spots"][1]["score"]
        assert all(item["spot_number"] != 3 for item in payload["recommended_spots"])
        assert len(payload["recommended_spots"][0]["explainability"]) == 6


def test_recommendation_excludes_overlapped_spots():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/recommendations/spots",
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
            json={
                "parking_lot_id": 1,
                "from": "2026-04-07T09:10:00",
                "to": "2026-04-07T09:20:00",
                "preferences": {
                    "max_results": 5,
                },
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert all(item["spot_number"] != 1 for item in payload["recommended_spots"])
        assert payload["recommended_spots"][0]["spot_number"] == 2


def test_decision_report_contains_selected_candidate_and_confidence():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/recommendations/decision-report",
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
            json={
                "parking_lot_id": 1,
                "from": "2026-04-07T08:00:00",
                "to": "2026-04-07T08:30:00",
                "preferences": {"preferred_spot_types": ["ev"], "prefer_charger": True},
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["selected_spot_id"] == 2
        assert body["selected_candidate"]["spot_id"] == 2
        spots_response = client.post(
            "/api/v1/recommendations/spots",
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
            json={
                "parking_lot_id": 1,
                "from": "2026-04-07T08:00:00",
                "to": "2026-04-07T08:30:00",
                "preferences": {"preferred_spot_types": ["ev"], "prefer_charger": True},
            },
        )
        ranked = spots_response.json()["ranked_candidates"]
        expected_confidence = round((ranked[0]["score"] - ranked[1]["score"]) / ranked[0]["score"], 4)
        assert body["confidence"] == expected_confidence


def test_recommendation_returns_rejected_candidates_for_blocked_and_conflicting_spots():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/recommendations/spots",
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
            json={
                "parking_lot_id": 1,
                "from": "2026-04-07T09:10:00",
                "to": "2026-04-07T09:20:00",
                "preferences": {"max_results": 5},
            },
        )
        assert response.status_code == 200
        rejected = response.json()["rejected_candidates"]
        assert any(item["spot_id"] == 1 and item["constraint"] == "interval_conflict" for item in rejected)
        assert any(item["spot_id"] == 4 and item["constraint"] == "spot_status_available" for item in rejected)


def test_prefer_charger_prioritizes_charger_when_available():
    tokens = _setup_state()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/recommendations/spots",
            headers={"Authorization": f"Bearer {tokens['tenant']}"},
            json={
                "parking_lot_id": 1,
                "from": "2026-04-07T08:00:00",
                "to": "2026-04-07T08:30:00",
                "preferences": {"prefer_charger": True, "max_results": 5},
                "weights": {"charger": 0.7, "availability": 0.1, "spot_type": 0.05, "zone": 0.05, "role": 0.05, "conflict": 0.05},
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["recommended_spots"][0]["has_charger"] is True
        assert any(item["constraint"] == "charger_preference" for item in payload["rejected_candidates"])
