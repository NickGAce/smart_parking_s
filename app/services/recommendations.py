from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking
from app.models.parking_spot import ParkingSpot, SpotStatus, SpotType
from app.models.parking_zone import AccessLevel
from app.models.user import UserRole
from app.schemas.recommendation import (
    RecommendationExplainFactor,
    RecommendationPreferences,
    RecommendationRequest,
    RecommendationResponse,
    RecommendedSpot,
)
from app.services.bookings import BOOKING_BLOCKING_STATUSES


ROLE_ACCESS = {
    AccessLevel.public: {UserRole.admin, UserRole.owner, UserRole.tenant, UserRole.guard, UserRole.uk},
    AccessLevel.employees: {UserRole.admin, UserRole.owner, UserRole.tenant, UserRole.guard},
    AccessLevel.permit_only: {UserRole.admin, UserRole.owner, UserRole.guard},
    AccessLevel.vip_only: {UserRole.admin, UserRole.owner},
}

SPOT_TYPE_ACCESS = {
    SpotType.vip: {UserRole.admin, UserRole.owner},
    SpotType.reserved: {UserRole.admin, UserRole.owner, UserRole.guard},
}


@dataclass
class SpotScoreContext:
    availability: float
    spot_type: float
    zone: float
    charger: float
    role: float
    conflict: float
    reasons: dict[str, str]


async def recommend_spots(
    session: AsyncSession,
    payload: RecommendationRequest,
    role: UserRole,
) -> RecommendationResponse:
    prefs = payload.preferences or RecommendationPreferences()
    filters = payload.filters
    weights = payload.weights

    spots_stmt = (
        select(ParkingSpot)
        .where(ParkingSpot.parking_lot_id == payload.parking_lot_id)
        .options(selectinload(ParkingSpot.zone))
    )

    if filters:
        if filters.spot_types:
            spots_stmt = spots_stmt.where(ParkingSpot.spot_type.in_(filters.spot_types))
        if filters.zone_ids:
            spots_stmt = spots_stmt.where(ParkingSpot.zone_id.in_(filters.zone_ids))
        if filters.vehicle_type:
            spots_stmt = spots_stmt.where(ParkingSpot.vehicle_type == filters.vehicle_type)
        if filters.size_category:
            spots_stmt = spots_stmt.where(ParkingSpot.size_category == filters.size_category)
        if filters.requires_charger is not None:
            spots_stmt = spots_stmt.where(ParkingSpot.has_charger == filters.requires_charger)

    spots = (await session.execute(spots_stmt)).scalars().all()
    if not spots:
        return RecommendationResponse(
            parking_lot_id=payload.parking_lot_id,
            from_time=payload.from_time,
            to_time=payload.to_time,
            requested_by_role=role.value,
            total_candidates=0,
            recommended_spots=[],
        )

    spot_ids = [spot.id for spot in spots]
    buffer_start = payload.from_time - timedelta(minutes=60)
    buffer_end = payload.to_time + timedelta(minutes=60)

    booking_stmt = (
        select(Booking)
        .where(Booking.parking_spot_id.in_(spot_ids))
        .where(Booking.status.in_(BOOKING_BLOCKING_STATUSES))
        .where(
            and_(
                Booking.end_time > buffer_start,
                Booking.start_time < buffer_end,
            )
        )
    )
    bookings = (await session.execute(booking_stmt)).scalars().all()

    overlap_counts: dict[int, int] = defaultdict(int)
    nearby_counts: dict[int, int] = defaultdict(int)
    for booking in bookings:
        overlaps_requested = booking.end_time > payload.from_time and booking.start_time < payload.to_time
        if overlaps_requested:
            overlap_counts[booking.parking_spot_id] += 1
        else:
            nearby_counts[booking.parking_spot_id] += 1

    ranked: list[RecommendedSpot] = []

    for spot in spots:
        if spot.status == SpotStatus.blocked:
            continue
        if overlap_counts.get(spot.id, 0) > 0:
            continue

        if not _is_spot_allowed_for_role(spot, role, prefs.needs_accessible_spot):
            continue

        score_ctx = _build_score_context(
            spot=spot,
            role=role,
            preferences=prefs,
            nearby_conflicts=nearby_counts.get(spot.id, 0),
        )

        total_score = (
            score_ctx.availability * weights.availability
            + score_ctx.spot_type * weights.spot_type
            + score_ctx.zone * weights.zone
            + score_ctx.charger * weights.charger
            + score_ctx.role * weights.role
            + score_ctx.conflict * weights.conflict
        )

        explainability = [
            RecommendationExplainFactor(
                factor="availability",
                value=score_ctx.availability,
                weight=weights.availability,
                contribution=round(score_ctx.availability * weights.availability, 4),
                reason=score_ctx.reasons["availability"],
            ),
            RecommendationExplainFactor(
                factor="spot_type",
                value=score_ctx.spot_type,
                weight=weights.spot_type,
                contribution=round(score_ctx.spot_type * weights.spot_type, 4),
                reason=score_ctx.reasons["spot_type"],
            ),
            RecommendationExplainFactor(
                factor="zone",
                value=score_ctx.zone,
                weight=weights.zone,
                contribution=round(score_ctx.zone * weights.zone, 4),
                reason=score_ctx.reasons["zone"],
            ),
            RecommendationExplainFactor(
                factor="charger",
                value=score_ctx.charger,
                weight=weights.charger,
                contribution=round(score_ctx.charger * weights.charger, 4),
                reason=score_ctx.reasons["charger"],
            ),
            RecommendationExplainFactor(
                factor="role",
                value=score_ctx.role,
                weight=weights.role,
                contribution=round(score_ctx.role * weights.role, 4),
                reason=score_ctx.reasons["role"],
            ),
            RecommendationExplainFactor(
                factor="conflict",
                value=score_ctx.conflict,
                weight=weights.conflict,
                contribution=round(score_ctx.conflict * weights.conflict, 4),
                reason=score_ctx.reasons["conflict"],
            ),
        ]

        ranked.append(
            RecommendedSpot(
                spot_id=spot.id,
                spot_number=spot.spot_number,
                parking_lot_id=spot.parking_lot_id,
                zone_id=spot.zone_id,
                zone_name=spot.zone.name if spot.zone else None,
                spot_type=spot.spot_type,
                has_charger=spot.has_charger,
                score=round(total_score, 4),
                explainability=explainability,
            )
        )

    ranked.sort(key=lambda item: (-item.score, item.spot_number))
    top = ranked[: prefs.max_results]

    return RecommendationResponse(
        parking_lot_id=payload.parking_lot_id,
        from_time=payload.from_time,
        to_time=payload.to_time,
        requested_by_role=role.value,
        total_candidates=len(ranked),
        recommended_spots=top,
    )


def _is_spot_allowed_for_role(spot: ParkingSpot, role: UserRole, needs_accessible_spot: bool) -> bool:
    if needs_accessible_spot and spot.spot_type != SpotType.disabled:
        return False

    if spot.spot_type == SpotType.disabled and not needs_accessible_spot and role not in {UserRole.admin, UserRole.guard}:
        return False

    if spot.spot_type in SPOT_TYPE_ACCESS and role not in SPOT_TYPE_ACCESS[spot.spot_type]:
        return False

    if spot.zone and role not in ROLE_ACCESS.get(spot.zone.access_level, set()):
        return False

    return True


def _build_score_context(
    spot: ParkingSpot,
    role: UserRole,
    preferences: RecommendationPreferences,
    nearby_conflicts: int,
) -> SpotScoreContext:
    preferred_spot_types = set(preferences.preferred_spot_types or [])
    preferred_zone_ids = set(preferences.preferred_zone_ids or [])

    if preferred_spot_types:
        spot_type_score = 1.0 if spot.spot_type in preferred_spot_types else 0.2
        spot_reason = "Spot type matches user preference" if spot_type_score == 1.0 else "Spot type does not match preferences"
    else:
        spot_type_score = 0.7
        spot_reason = "No explicit spot type preference"

    if preferred_zone_ids:
        zone_score = 1.0 if spot.zone_id in preferred_zone_ids else 0.3
        zone_reason = "Spot is in preferred zone" if zone_score == 1.0 else "Spot zone is outside preferred set"
    else:
        zone_score = 0.7
        zone_reason = "No explicit zone preference"

    if preferences.prefer_charger:
        charger_score = 1.0 if spot.has_charger else 0.1
        charger_reason = "Charging point preference satisfied" if charger_score == 1.0 else "No charger, but candidate kept"
    else:
        charger_score = 1.0 if not spot.has_charger else 0.8
        charger_reason = "No charger preference; spot acceptable"

    conflict_score = 1 / (1 + nearby_conflicts)

    return SpotScoreContext(
        availability=1.0,
        spot_type=spot_type_score,
        zone=zone_score,
        charger=charger_score,
        role=1.0,
        conflict=conflict_score,
        reasons={
            "availability": "Spot is free in requested interval",
            "spot_type": spot_reason,
            "zone": zone_reason,
            "charger": charger_reason,
            "role": f"Role '{role.value}' is allowed for this spot",
            "conflict": "Lower risk of near-term conflicts" if nearby_conflicts == 0 else f"{nearby_conflicts} nearby bookings around interval",
        },
    )
