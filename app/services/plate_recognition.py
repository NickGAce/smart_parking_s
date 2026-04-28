from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Protocol

from app.models.vehicle_access_event import RecognitionSource

CYR_TO_LAT = {
    "А": "A",
    "В": "B",
    "Е": "E",
    "К": "K",
    "М": "M",
    "Н": "H",
    "О": "O",
    "Р": "P",
    "С": "C",
    "Т": "T",
    "У": "Y",
    "Х": "X",
}

LAT_TO_CYR = {value: key for key, value in CYR_TO_LAT.items()}
PLATE_CHAR_FILTER = re.compile(r"[^A-ZА-Я0-9-\s]")


@dataclass(slots=True)
class PlateRecognitionResult:
    plate_number: str
    normalized_plate_number: str
    confidence: float | None
    source: RecognitionSource
    raw_text: str | None = None
    candidate_plates: list[str] = field(default_factory=list)
    selected_plate: str | None = None
    normalized_plate: str | None = None
    provider: str | None = None
    preprocessing_steps: list[str] = field(default_factory=list)
    reason: str | None = None


class PlateRecognitionService(Protocol):
    async def recognize(self, *, image_token: str | None, plate_number_hint: str | None = None) -> PlateRecognitionResult:
        ...



def _normalize_common(text: str) -> str:
    cleaned = PLATE_CHAR_FILTER.sub("", text.upper())
    return re.sub(r"[\s-]+", "", cleaned)


def normalize_plate_number(plate_number: str) -> str:
    raw = _normalize_common(plate_number)
    converted = "".join(CYR_TO_LAT.get(ch, ch) for ch in raw)
    return converted or "UNKNOWN"


def normalize_plate_candidate(candidate: str, *, target_script: str = "latin") -> str:
    normalized = _normalize_common(candidate)
    if target_script == "cyrillic":
        return "".join(LAT_TO_CYR.get(ch, ch) for ch in normalized)
    return "".join(CYR_TO_LAT.get(ch, ch) for ch in normalized)


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
            raw_text=raw_plate,
            candidate_plates=[normalized] if normalized != "UNKNOWN" else [],
            selected_plate=raw_plate,
            normalized_plate=normalized,
            provider="mock-token",
            preprocessing_steps=[],
            reason="Mock recognition by token/hint",
        )


plate_recognition_service: PlateRecognitionService = MockPlateRecognitionService()
