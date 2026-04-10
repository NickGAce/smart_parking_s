from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


SeverityLevel = Literal["low", "medium", "high"]


class RelatedEntity(BaseModel):
    entity_type: Literal["user", "parking_lot", "parking_spot"]
    entity_id: int
    label: str | None = None


class AnomalyItem(BaseModel):
    anomaly_type: str
    severity: SeverityLevel
    reason: str
    related_entity: RelatedEntity
    metrics: dict[str, float | int | str] = Field(default_factory=dict)


class AnomalyResponse(BaseModel):
    period_from: datetime
    period_to: datetime
    applied_filters: dict[str, int | str | None]
    rules: list[str]
    items: list[AnomalyItem]
