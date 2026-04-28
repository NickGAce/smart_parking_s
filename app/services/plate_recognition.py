from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol

from app.models.vehicle_access_event import RecognitionSource

_PLATE_PATTERN = re.compile(r"[A-Z0-9]{6,10}")


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
    cleaned = re.sub(r"[^A-Za-zА-Яа-я0-9]", "", plate_number or "")
    return cleaned.upper() or "UNKNOWN"


def extract_plate_candidate(*candidates: str | None) -> str | None:
    for candidate in candidates:
        if not candidate:
            continue
        normalized_candidate = normalize_plate_number(candidate)
        if normalized_candidate == "UNKNOWN":
            continue
        direct_match = _PLATE_PATTERN.search(normalized_candidate)
        if direct_match:
            return direct_match.group(0)
    return None


class MockPlateRecognitionService:
    async def recognize(self, *, image_token: str | None, plate_number_hint: str | None = None) -> PlateRecognitionResult:
        plate = extract_plate_candidate(plate_number_hint, image_token) or "UNKNOWN"
        confidence = 0.96 if plate != "UNKNOWN" else 0.52
        return PlateRecognitionResult(
            plate_number=plate,
            normalized_plate_number=plate,
            confidence=confidence,
            source=RecognitionSource.mock,
        )


plate_recognition_service: PlateRecognitionService = MockPlateRecognitionService()
