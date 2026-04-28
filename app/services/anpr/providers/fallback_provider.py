from __future__ import annotations

import re
from pathlib import Path

from app.services.anpr.providers.base import PlateRecognitionResult
from app.services.plate_recognition import normalize_plate_number

PLATE_PATTERN = re.compile(r"([A-Za-zА-Яа-я0-9]{5,10})")


class FilenameFallbackANPRProvider:
    provider_name = "filename_fallback"

    async def recognize_from_image(self, file_path: str, *, plate_hint: str | None = None) -> PlateRecognitionResult:
        return self._recognize(file_path, plate_hint=plate_hint)

    async def recognize_from_video(self, file_path: str, *, plate_hint: str | None = None) -> PlateRecognitionResult:
        return self._recognize(file_path, plate_hint=plate_hint, is_video=True)

    def _recognize(self, file_path: str, *, plate_hint: str | None = None, is_video: bool = False) -> PlateRecognitionResult:
        candidate = plate_hint or Path(file_path).name
        match = PLATE_PATTERN.search(candidate)
        raw_plate = (match.group(1) if match else "UNKNOWN").upper()
        normalized = normalize_plate_number(raw_plate)
        confidence = 0.55 if normalized != "UNKNOWN" else 0.35
        return PlateRecognitionResult(
            plate_number=raw_plate,
            normalized_plate_number=normalized,
            confidence=confidence,
            raw_text=raw_plate,
            candidate_plates=[raw_plate] if normalized != "UNKNOWN" else [],
            provider=self.provider_name,
            preprocessing_steps=["filename_plate_hint_fallback", "demo_only_not_full_ocr"],
            frame_timestamp=1.0 if is_video else None,
            error="fallback_provider_used",
        )
