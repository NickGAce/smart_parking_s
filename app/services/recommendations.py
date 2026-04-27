from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking
from app.models.parking_spot import ParkingSpot, SpotStatus, SpotType
from app.models.parking_zone import AccessLevel
from app.models.user import UserRole
from app.schemas.recommendation import (
    DecisionConstraint,
    DecisionFactor,
    DecisionReport,
    RejectedCandidate,
    RecommendationExplainFactor,
    RecommendationFilters,
    RecommendationPreferences,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationWeights,
    RecommendedSpot,
    SelectedCandidate,
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


@dataclass
class ScoredCandidate:
    recommended: RecommendedSpot
    factors: list[DecisionFactor]
    constraints: list[DecisionConstraint]


async def recommend_spots(
    session: AsyncSession,
    payload: RecommendationRequest,
    role: UserRole | str,
) -> RecommendationResponse:
    normalized_role = _normalize_role(role)
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
            requested_by_role=normalized_role.value,
            total_candidates=0,
            recommended_spots=[],
            ranked_candidates=[],
            rejected_candidates=[],
            decision_report=None,
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

    ranked: list[ScoredCandidate] = []
    rejected: list[RejectedCandidate] = []

    for spot in spots:
        if spot.status == SpotStatus.blocked:
            rejected.append(
                RejectedCandidate(
                    spot_id=spot.id,
                    reason="Место заблокировано",
                    constraint="spot_status_available",
                )
            )
            continue
        if overlap_counts.get(spot.id, 0) > 0:
            rejected.append(
                RejectedCandidate(
                    spot_id=spot.id,
                    reason="Место пересекается с активным бронированием",
                    constraint="interval_conflict",
                )
            )
            continue

        if not _is_spot_allowed_for_role(spot, normalized_role, prefs.needs_accessible_spot):
            rejected.append(
                RejectedCandidate(
                    spot_id=spot.id,
                    reason="Место недоступно для роли пользователя или требования доступности",
                    constraint="role_access",
                )
            )
            continue

        score_ctx = _build_score_context(
            spot=spot,
            role=normalized_role,
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

        recommended_spot = RecommendedSpot(
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
        factors = [
            DecisionFactor(
                name=item.factor,
                weight=item.weight,
                raw_value=item.value,
                contribution=item.contribution,
                explanation=item.reason,
            )
            for item in explainability
        ]
        constraints = [
            DecisionConstraint(name="spot_status_available", passed=True, explanation="Статус места: доступно"),
            DecisionConstraint(name="interval_conflict", passed=True, explanation="Нет пересечения с блокирующими бронированиями"),
            DecisionConstraint(
                name="role_access",
                passed=True,
                explanation=f"Роль '{normalized_role.value}' имеет доступ к этому месту",
            )
        ]
        ranked.append(ScoredCandidate(recommended=recommended_spot, factors=factors, constraints=constraints))

    ranked.sort(key=lambda item: (-item.recommended.score, item.recommended.spot_number))
    top = ranked[: prefs.max_results]
    decision_report = _build_decision_report(top, rejected)

    return RecommendationResponse(
        parking_lot_id=payload.parking_lot_id,
        from_time=payload.from_time,
        to_time=payload.to_time,
        requested_by_role=normalized_role.value,
        total_candidates=len(ranked),
        recommended_spots=[item.recommended for item in top],
        ranked_candidates=[item.recommended for item in ranked],
        rejected_candidates=rejected,
        decision_report=decision_report,
    )




async def pick_best_spot_for_booking(
    session: AsyncSession,
    *,
    parking_lot_id: int,
    from_time,
    to_time,
    role: UserRole | str,
    filters: RecommendationFilters | None = None,
    preferences: RecommendationPreferences | None = None,
    weights: RecommendationWeights | None = None,
) -> tuple[RecommendedSpot | None, DecisionReport | None]:
    request = RecommendationRequest(
        parking_lot_id=parking_lot_id,
        from_time=from_time,
        to_time=to_time,
        filters=filters,
        preferences=preferences,
        weights=weights or RecommendationWeights(),
    )

    response = await recommend_spots(session=session, payload=request, role=role)
    if not response.recommended_spots:
        return None, None

    return response.recommended_spots[0], response.decision_report


def _normalize_role(role: UserRole | str) -> UserRole:
    if isinstance(role, UserRole):
        return role
    return UserRole(role)


def _build_decision_report(ranked: list[ScoredCandidate], rejected: list[RejectedCandidate]) -> DecisionReport | None:
    if not ranked:
        return None

    best = ranked[0]
    second_score = ranked[1].recommended.score if len(ranked) > 1 else 0.0
    confidence = _calculate_confidence(best.recommended.score, second_score)

    return DecisionReport(
        selected_spot_id=best.recommended.spot_id,
        selected_spot_label=f"Место №{best.recommended.spot_number}",
        final_score=best.recommended.score,
        confidence=confidence,
        factors=best.factors,
        hard_constraints_passed=best.constraints,
        rejected_candidates=rejected,
        generated_at=datetime.utcnow(),
        selected_candidate=SelectedCandidate(
            spot_id=best.recommended.spot_id,
            spot_number=best.recommended.spot_number,
            spot_label=f"Место №{best.recommended.spot_number}",
            final_score=best.recommended.score,
        ),
    )


def _calculate_confidence(top_score: float, second_score: float) -> float:
    if top_score <= 0:
        return 0.0
    return round(min(1.0, max(0.0, (top_score - second_score) / max(top_score, 0.0001))), 4)



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
        spot_reason = "Тип места соответствует предпочтениям пользователя" if spot_type_score == 1.0 else "Тип места не соответствует предпочтениям"
    else:
        spot_type_score = 0.7
        spot_reason = "Явное предпочтение по типу места не задано"

    if preferred_zone_ids:
        zone_score = 1.0 if spot.zone_id in preferred_zone_ids else 0.3
        zone_reason = "Место находится в предпочтительной зоне" if zone_score == 1.0 else "Зона места вне предпочтительного набора"
    else:
        zone_score = 0.7
        zone_reason = "Явное предпочтение по зоне не задано"

    if preferences.prefer_charger:
        charger_score = 1.0 if spot.has_charger else 0.1
        charger_reason = "Предпочтение по зарядке удовлетворено" if charger_score == 1.0 else "Зарядки нет, но кандидат оставлен"
    else:
        charger_score = 1.0 if not spot.has_charger else 0.8
        charger_reason = "Предпочтение по зарядке не задано; место допустимо"

    conflict_score = 1 / (1 + nearby_conflicts)

    return SpotScoreContext(
        availability=1.0,
        spot_type=spot_type_score,
        zone=zone_score,
        charger=charger_score,
        role=1.0,
        conflict=conflict_score,
        reasons={
            "availability": "Место свободно в выбранном интервале",
            "spot_type": spot_reason,
            "zone": zone_reason,
            "charger": charger_reason,
            "role": f"Роль '{role.value}' имеет доступ к этому месту",
            "conflict": "Низкий риск ближайших конфликтов" if nearby_conflicts == 0 else f"{nearby_conflicts} соседних бронирований рядом с интервалом",
        },
    )
