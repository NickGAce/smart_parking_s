from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.db.session import get_session
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit_log import AuditLogListResponse
from app.schemas.pagination import PaginationMeta

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    actor_user_id: int | None = None,
    action_type: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    from_time: datetime | None = Query(None, alias="from"),
    to_time: datetime | None = Query(None, alias="to"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    _admin: User = Depends(require_roles(UserRole.admin)),
):
    stmt = select(AuditLog)
    count_stmt = select(func.count(AuditLog.id))

    if actor_user_id is not None:
        stmt = stmt.where(AuditLog.actor_user_id == actor_user_id)
        count_stmt = count_stmt.where(AuditLog.actor_user_id == actor_user_id)
    if action_type:
        stmt = stmt.where(AuditLog.action_type == action_type)
        count_stmt = count_stmt.where(AuditLog.action_type == action_type)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
        count_stmt = count_stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
        count_stmt = count_stmt.where(AuditLog.entity_id == entity_id)
    if from_time is not None:
        stmt = stmt.where(AuditLog.timestamp >= from_time)
        count_stmt = count_stmt.where(AuditLog.timestamp >= from_time)
    if to_time is not None:
        stmt = stmt.where(AuditLog.timestamp <= to_time)
        count_stmt = count_stmt.where(AuditLog.timestamp <= to_time)

    total = (await session.execute(count_stmt)).scalar_one()
    result = await session.execute(stmt.order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset))

    items = result.scalars().all()
    return AuditLogListResponse(items=items, meta=PaginationMeta(limit=limit, offset=offset, total=total))
