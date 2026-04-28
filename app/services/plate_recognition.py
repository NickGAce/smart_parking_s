from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol

from app.models.vehicle_access_event import RecognitionSource

# Разрешенные символы для российских номеров (ГОСТ): АВЕКМНОРСТУХ.
# Нормализуем в латинский канонический набор, чтобы хранение/поиск были единообразными.
CYRILLIC_TO_LATIN = {
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

RUS_PLATE_PATTERN = re.compile(r"[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2,3}")

ALLOWED_PLATE_LETTERS = set("ABEKMHOPCTYX")
DIGIT_CONFUSIONS = {"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "B": "8", "T": "7"}
LETTER_CONFUSIONS = {"0": "O", "8": "B", "7": "T"}


@dataclass(slots=True)
class PlateRecognitionResult:
    plate_number: str
    normalized_plate_number: str
    confidence: float | None
    source: RecognitionSource


class PlateRecognitionService(Protocol):
    async def recognize(self, *, image_token: str | None, plate_number_hint: str | None = None) -> PlateRecognitionResult:
        ...


def _to_latin_plate_alphabet(text: str) -> str:
    converted: list[str] = []
    for char in text.upper():
        converted.append(CYRILLIC_TO_LATIN.get(char, char))
    return "".join(converted)


def normalize_plate_number(plate_number: str) -> str:
    cleaned = re.sub(r"[^A-Za-zА-Яа-я0-9]", "", plate_number or "")
    latin = _to_latin_plate_alphabet(cleaned)
    return latin or "UNKNOWN"


def _coerce_plate_by_position(raw: str) -> str | None:
    # Russian format: L D D D L L D D [D]
    if len(raw) not in {8, 9}:
        return None

    chars = list(raw)
    letter_positions = {0, 4, 5}

    for idx, char in enumerate(chars):
        if idx in letter_positions:
            if char not in ALLOWED_PLATE_LETTERS:
                chars[idx] = LETTER_CONFUSIONS.get(char, char)
            if chars[idx] not in ALLOWED_PLATE_LETTERS:
                return None
        else:
            if not chars[idx].isdigit():
                chars[idx] = DIGIT_CONFUSIONS.get(chars[idx], chars[idx])
            if not chars[idx].isdigit():
                return None

    candidate = "".join(chars)
    return candidate if RUS_PLATE_PATTERN.fullmatch(candidate) else None


def extract_plate_candidate(*candidates: str | None) -> str | None:
    for candidate in candidates:
        if not candidate:
            continue
        normalized_candidate = normalize_plate_number(candidate)
        if normalized_candidate == "UNKNOWN":
            continue

        # direct match
        match = RUS_PLATE_PATTERN.search(normalized_candidate)
        if match:
            return match.group(0)

        # heuristic match with OCR confusions (O/0, B/8, etc.)
        for size in (9, 8):
            for idx in range(0, len(normalized_candidate) - size + 1):
                window = normalized_candidate[idx: idx + size]
                fixed = _coerce_plate_by_position(window)
                if fixed:
                    return fixed

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
