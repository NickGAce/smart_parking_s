from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.models.vehicle_access_event import RecognitionSource


@dataclass(slots=True)
class PlateRecognitionResult:
    plate_number: str
    normalized_plate_number: str
    confidence: float | None
    source: RecognitionSource


class PlateRecognitionService(Protocol):
    async def recognize(self, *, image_token: str | None, plate_number_hint: str | None = None) -> PlateRecognitionResult:
        ...



def normalize_plate_number(plate_number: str) -> str:
    return plate_number.upper().replace(" ", "").replace("-", "")


class MockPlateRecognitionService:
    async def recognize(self, *, image_token: str | None, plate_number_hint: str | None = None) -> PlateRecognitionResult:
        raw_plate = (plate_number_hint or image_token or "UNKNOWN").strip() or "UNKNOWN"
        normalized = normalize_plate_number(raw_plate)

        confidence = 0.96
        if "LOW" in normalized or normalized == "UNKNOWN":
            confidence = 0.52

        return PlateRecognitionResult(
            plate_number=raw_plate,
            normalized_plate_number=normalized,
            confidence=confidence,
            source=RecognitionSource.mock,
        )


plate_recognition_service: PlateRecognitionService = MockPlateRecognitionService()
