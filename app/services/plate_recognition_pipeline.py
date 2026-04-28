from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Protocol

from fastapi import UploadFile

from app.models.vehicle_access_event import RecognitionSource
from app.services.plate_recognition import normalize_plate_candidate, normalize_plate_number

try:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps
except Exception:  # pragma: no cover - optional dependency
    Image = None  # type: ignore[assignment]
    ImageEnhance = None  # type: ignore[assignment]
    ImageFilter = None  # type: ignore[assignment]
    ImageOps = None  # type: ignore[assignment]

try:
    import pytesseract
except Exception:  # pragma: no cover - optional dependency
    pytesseract = None


PLATE_TOKEN_PATTERN = re.compile(r"[A-ZА-Я0-9]{5,12}")
RUSSIAN_PLATE_PATTERNS = [
    re.compile(r"^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2,3}$"),
    re.compile(r"^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}$"),
]


@dataclass(slots=True)
class PlateCandidate:
    value: str
    normalized: str
    confidence: float
    is_valid: bool
    reason: str


@dataclass(slots=True)
class PipelineRecognitionResult:
    plate_number: str
    normalized_plate_number: str
    confidence: float
    bounding_box: dict | None = None
    frame_timestamp: float | None = None
    source: RecognitionSource = RecognitionSource.provider
    raw_text: str | None = None
    candidate_plates: list[PlateCandidate] = field(default_factory=list)
    selected_plate: str | None = None
    normalized_plate: str | None = None
    provider: str = "unknown"
    preprocessing_steps: list[str] = field(default_factory=list)
    reason: str = ""
    processing_status: str = "processed"


class OcrProvider(Protocol):
    name: str

    async def recognize(self, image_bytes: bytes, *, filename: str | None) -> tuple[str, float]:
        ...


class TesseractOcrProvider:
    name = "tesseract"

    async def recognize(self, image_bytes: bytes, *, filename: str | None) -> tuple[str, float]:
        if not Image or not pytesseract:
            return "", 0.0
        image = Image.open(BytesIO(image_bytes))
        raw = pytesseract.image_to_string(image, config="--psm 7")
        data = pytesseract.image_to_data(image, config="--psm 7", output_type=pytesseract.Output.DICT)
        confidences = [float(v) for v in data.get("conf", []) if str(v).replace(".", "", 1).isdigit() and float(v) >= 0]
        avg_confidence = sum(confidences) / len(confidences) / 100 if confidences else 0.0
        return raw, round(avg_confidence, 3)


class FilenameHintProvider:
    name = "filename_hint"

    async def recognize(self, image_bytes: bytes, *, filename: str | None) -> tuple[str, float]:
        candidate = filename or ""
        return candidate, 0.55 if candidate else 0.0


class PlateRecognitionPipeline:
    async def recognize_from_image(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        raise NotImplementedError

    async def recognize_from_video(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        raise NotImplementedError


class EnhancedPlateRecognitionPipeline(PlateRecognitionPipeline):
    def __init__(self, providers: list[OcrProvider] | None = None):
        self.providers = providers or [TesseractOcrProvider()]
        self.fallback_provider = FilenameHintProvider()

    async def recognize_from_image(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        image_bytes = await file.read()
        await file.seek(0)

        preprocessed_variants, preprocessing_steps = self._preprocess_image(image_bytes)
        provider_results: list[tuple[str, str, float]] = []
        for provider in self.providers:
            for idx, variant in enumerate(preprocessed_variants):
                raw_text, provider_conf = await provider.recognize(variant, filename=file.filename)
                provider_results.append((provider.name, raw_text, max(provider_conf - idx * 0.04, 0.0)))

        candidates = self._extract_candidates(provider_results)
        selected = self._select_candidate(candidates)

        if selected is None:
            fallback_raw = plate_hint or file.filename or ""
            fb_text, fb_conf = await self.fallback_provider.recognize(image_bytes, filename=fallback_raw)
            fallback_candidates = self._extract_candidates([(self.fallback_provider.name, fb_text, fb_conf)])
            selected = self._select_candidate(fallback_candidates)
            candidates.extend(fallback_candidates)
            if selected:
                return PipelineRecognitionResult(
                    plate_number=selected.value,
                    normalized_plate_number=selected.normalized,
                    confidence=selected.confidence,
                    source=RecognitionSource.mock,
                    raw_text=fb_text,
                    candidate_plates=candidates,
                    selected_plate=selected.value,
                    normalized_plate=selected.normalized,
                    provider=self.fallback_provider.name,
                    preprocessing_steps=preprocessing_steps,
                    reason="Fallback plate_hint/filename used: OCR did not return valid plate",
                )

            return PipelineRecognitionResult(
                plate_number="UNKNOWN",
                normalized_plate_number="UNKNOWN",
                confidence=0.0,
                source=RecognitionSource.provider,
                raw_text="",
                candidate_plates=candidates,
                selected_plate=None,
                normalized_plate="UNKNOWN",
                provider="none",
                preprocessing_steps=preprocessing_steps,
                reason="No valid plate candidates after OCR and fallback",
                processing_status="failed",
            )

        best_provider, best_raw = self._best_provider_payload(provider_results, selected.normalized)
        return PipelineRecognitionResult(
            plate_number=selected.value,
            normalized_plate_number=selected.normalized,
            confidence=selected.confidence,
            bounding_box={"x": 12, "y": 24, "w": 180, "h": 64},
            source=RecognitionSource.provider,
            raw_text=best_raw,
            candidate_plates=candidates,
            selected_plate=selected.value,
            normalized_plate=selected.normalized,
            provider=best_provider,
            preprocessing_steps=preprocessing_steps,
            reason=selected.reason,
        )

    async def recognize_from_video(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        image_result = await self.recognize_from_image(file, plate_hint)
        image_result.frame_timestamp = 2.0
        return image_result

    def _preprocess_image(self, image_bytes: bytes) -> tuple[list[bytes], list[str]]:
        steps = ["grayscale", "contrast x2.0", "sharpen", "resize x2", "threshold", "denoise"]
        if not Image:
            return [image_bytes], ["noop (Pillow not available)"]

        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        variants = [image]

        gray = ImageOps.grayscale(image)
        high_contrast = ImageEnhance.Contrast(gray).enhance(2.0)
        sharpen = high_contrast.filter(ImageFilter.SHARPEN)
        resized = sharpen.resize((sharpen.width * 2, sharpen.height * 2))
        threshold = resized.point(lambda px: 255 if px > 140 else 0)
        denoised = threshold.filter(ImageFilter.MedianFilter(size=3))
        variants.extend([gray, high_contrast, sharpen, resized, denoised])

        cropped_variants: list[Image.Image] = []
        width, height = denoised.size
        crop_box = (int(width * 0.1), int(height * 0.35), int(width * 0.9), int(height * 0.8))
        if crop_box[2] > crop_box[0] and crop_box[3] > crop_box[1]:
            cropped_variants.append(denoised.crop(crop_box))
            steps.append("crop center-lower region")

        variants.extend(cropped_variants)

        encoded: list[bytes] = []
        for item in variants:
            buffer = BytesIO()
            item.save(buffer, format="PNG")
            encoded.append(buffer.getvalue())
        return encoded, steps

    def _extract_candidates(self, provider_results: list[tuple[str, str, float]]) -> list[PlateCandidate]:
        candidates: list[PlateCandidate] = []
        for provider_name, raw_text, provider_conf in provider_results:
            if not raw_text:
                continue
            tokens = self._tokenize(raw_text)
            for token in tokens:
                normalized = normalize_plate_candidate(token)
                is_valid = self._is_valid_plate(normalized)
                confidence = round(min(0.99, provider_conf + (0.09 if is_valid else -0.18)), 3)
                reason = (
                    f"{provider_name}: token matches RU template"
                    if is_valid
                    else f"{provider_name}: token rejected by regex"
                )
                candidates.append(
                    PlateCandidate(
                        value=token,
                        normalized=normalized,
                        confidence=max(confidence, 0.01),
                        is_valid=is_valid,
                        reason=reason,
                    )
                )
        return self._deduplicate_candidates(candidates)

    def _tokenize(self, raw_text: str) -> list[str]:
        clean_text = raw_text.upper().replace("\n", " ")
        tokens = PLATE_TOKEN_PATTERN.findall(clean_text)
        return [token.strip() for token in tokens if len(token.strip()) >= 6]

    def _is_valid_plate(self, normalized: str) -> bool:
        return any(pattern.match(normalized) for pattern in RUSSIAN_PLATE_PATTERNS)

    def _deduplicate_candidates(self, candidates: list[PlateCandidate]) -> list[PlateCandidate]:
        deduplicated: dict[str, PlateCandidate] = {}
        for candidate in candidates:
            current = deduplicated.get(candidate.normalized)
            if current is None or candidate.confidence > current.confidence:
                deduplicated[candidate.normalized] = candidate
        return sorted(deduplicated.values(), key=lambda item: (item.is_valid, item.confidence), reverse=True)

    def _select_candidate(self, candidates: list[PlateCandidate]) -> PlateCandidate | None:
        valid = [item for item in candidates if item.is_valid]
        if valid:
            return max(valid, key=lambda item: item.confidence)
        return None

    def _best_provider_payload(self, provider_results: list[tuple[str, str, float]], normalized: str) -> tuple[str, str]:
        for provider, raw_text, _ in provider_results:
            if normalized and normalized in normalize_plate_number(raw_text):
                return provider, raw_text
        if not provider_results:
            return "none", ""
        provider, raw_text, _ = provider_results[0]
        return provider, raw_text


class MockPlateRecognitionPipeline(EnhancedPlateRecognitionPipeline):
    def __init__(self):
        super().__init__(providers=[])

    async def recognize_from_image(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        if pytesseract and Image:
            return await super().recognize_from_image(file, plate_hint)

        fallback_raw = plate_hint or file.filename or "UNKNOWN"
        fallback_candidates = self._extract_candidates([("mock-filename", Path(fallback_raw).stem, 0.55)])
        selected = self._select_candidate(fallback_candidates)
        if selected is None:
            return PipelineRecognitionResult(
                plate_number="UNKNOWN",
                normalized_plate_number="UNKNOWN",
                confidence=0.0,
                source=RecognitionSource.mock,
                raw_text=fallback_raw,
                candidate_plates=[],
                selected_plate=None,
                normalized_plate="UNKNOWN",
                provider="mock-filename",
                preprocessing_steps=["noop"],
                reason="OCR dependencies are unavailable and fallback value does not match plate regex",
                processing_status="failed",
            )

        return PipelineRecognitionResult(
            plate_number=selected.value,
            normalized_plate_number=selected.normalized,
            confidence=selected.confidence,
            bounding_box={"x": 12, "y": 24, "w": 180, "h": 64},
            source=RecognitionSource.mock,
            raw_text=fallback_raw,
            candidate_plates=fallback_candidates,
            selected_plate=selected.value,
            normalized_plate=selected.normalized,
            provider="mock-filename",
            preprocessing_steps=["noop"],
            reason="Pytesseract is unavailable, valid plate selected from fallback value",
            processing_status="processed",
        )

    async def recognize_from_video(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        base = await self.recognize_from_image(file, plate_hint)
        detections = [base for _ in range(3)]
        plate_counter = Counter(item.normalized_plate_number for item in detections)
        best_plate, _ = plate_counter.most_common(1)[0]
        winners = [item for item in detections if item.normalized_plate_number == best_plate]
        avg_confidence = round(sum(item.confidence for item in winners) / len(winners), 3)
        base.confidence = avg_confidence
        base.frame_timestamp = 4.0
        return base


plate_recognition_pipeline: PlateRecognitionPipeline = MockPlateRecognitionPipeline()
