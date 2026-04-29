from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.models.vehicle_access_event import RecognitionSource


@dataclass(slots=True)
class PlateRecognitionResult:
    plate_number: str
    normalized_plate_number: str
    confidence: float | None
    raw_text: str | None = None
    candidate_plates: list[str] = field(default_factory=list)
    provider: str = "fallback"
    source: RecognitionSource = RecognitionSource.mock
    bounding_box: dict[str, int] | None = None
    frame_timestamp: float | None = None
    preprocessing_steps: list[str] = field(default_factory=list)
    error: str | None = None


class ANPRProvider(Protocol):
    async def recognize_from_image(self, file_path: str, *, plate_hint: str | None = None) -> PlateRecognitionResult:
        ...

    async def recognize_from_video(self, file_path: str, *, plate_hint: str | None = None) -> PlateRecognitionResult:
        ...
