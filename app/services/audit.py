from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User


async def log_audit_event(
    session: AsyncSession,
    *,
    action_type: str,
    entity_type: str,
    entity_id: int | str | None,
    actor_user: User | None = None,
    old_values: dict | None = None,
    new_values: dict | None = None,
    source_metadata: dict | None = None,
) -> None:
    def _to_jsonable(value):
        if value is None:
            return None
        if isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, dict):
            return {str(k): _to_jsonable(v) for k, v in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [_to_jsonable(v) for v in value]
        return str(value)

    log = AuditLog(
        actor_user_id=actor_user.id if actor_user else None,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        old_values=_to_jsonable(old_values),
        new_values=_to_jsonable(new_values),
        source_metadata=_to_jsonable(source_metadata),
    )
    session.add(log)


def build_source_metadata(request: Request | None) -> dict | None:
    if request is None:
        return None

    return {
        "path": request.url.path,
        "method": request.method,
        "ip": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "x_timezone": request.headers.get("X-Timezone"),
        "x_device_time": request.headers.get("X-Device-Time"),
    }
