from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.user import User
from app.schemas.recommendation import DecisionReport, RecommendationRequest, RecommendationResponse
from app.services.bookings import normalize_client_datetime
from app.services.recommendations import recommend_spots

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("/spots", response_model=RecommendationResponse)
async def recommend_parking_spots(
    payload: RecommendationRequest,
    include_decision_report: bool = Query(True),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    role = payload.user_context.role if payload.user_context and payload.user_context.role else current_user.role
    payload.from_time = normalize_client_datetime(payload.from_time, None)
    payload.to_time = normalize_client_datetime(payload.to_time, None)
    response = await recommend_spots(session=session, payload=payload, role=role)
    if not include_decision_report:
        response.decision_report = None
    return response


@router.post("/decision-report", response_model=DecisionReport)
async def recommendation_decision_report(
    payload: RecommendationRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    role = payload.user_context.role if payload.user_context and payload.user_context.role else current_user.role
    payload.from_time = normalize_client_datetime(payload.from_time, None)
    payload.to_time = normalize_client_datetime(payload.to_time, None)
    response = await recommend_spots(session=session, payload=payload, role=role)
    if response.decision_report is None:
        raise HTTPException(status_code=404, detail="Для заданных ограничений отчёт решения недоступен")
    return response.decision_report
