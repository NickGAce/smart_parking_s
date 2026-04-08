from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.user import User
from app.schemas.recommendation import RecommendationRequest, RecommendationResponse
from app.services.bookings import normalize_client_datetime
from app.services.recommendations import recommend_spots

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("/spots", response_model=RecommendationResponse)
async def recommend_parking_spots(
    payload: RecommendationRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    role = payload.user_context.role if payload.user_context and payload.user_context.role else current_user.role
    payload.from_time = normalize_client_datetime(payload.from_time, None)
    payload.to_time = normalize_client_datetime(payload.to_time, None)
    return await recommend_spots(session=session, payload=payload, role=role)
