from datetime import datetime

from pydantic import BaseModel

from app.schemas.pagination import PaginationMeta


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: int | None
    action_type: str
    entity_type: str
    entity_id: str | None
    old_values: dict | None = None
    new_values: dict | None = None
    source_metadata: dict | None = None
    timestamp: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    items: list[AuditLogOut]
    meta: PaginationMeta
