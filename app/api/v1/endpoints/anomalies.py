from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models.user import User, UserRole
from app.schemas.anomaly import AnomalyResponse
from app.services.anomaly_detection import AnomalyDetectionService, list_anomaly_rules
from app.services.bookings import normalize_client_datetime, server_now_utc_naive

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/anomalies", response_model=AnomalyResponse)
async def get_anomalies(
    from_time: datetime | None = Query(None, alias="from"),
    to_time: datetime | None = Query(None, alias="to"),
    parking_lot_id: int | None = None,
    user_id: int | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.admin, UserRole.owner, UserRole.guard]:
        if user_id is not None and user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        user_id = current_user.id

    now = server_now_utc_naive()
    period_to = normalize_client_datetime(to_time, None) if to_time is not None else now
    period_from = normalize_client_datetime(from_time, None) if from_time is not None else period_to - timedelta(days=30)

    if period_from >= period_to:
        raise HTTPException(status_code=400, detail="'from' must be earlier than 'to'")

    service = AnomalyDetectionService(session)
    items = await service.detect(
        period_from=period_from,
        period_to=period_to,
        parking_lot_id=parking_lot_id,
        user_id=user_id,
    )

    return AnomalyResponse(
        period_from=period_from,
        period_to=period_to,
        applied_filters={
            "parking_lot_id": parking_lot_id,
            "user_id": user_id,
            "requested_by_role": current_user.role,
        },
        rules=list_anomaly_rules(),
        items=items,
    )
