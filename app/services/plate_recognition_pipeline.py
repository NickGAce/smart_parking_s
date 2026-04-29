from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings
from app.services.anpr.providers.base import PlateRecognitionResult
from app.services.anpr.providers.fallback_provider import FilenameFallbackANPRProvider
from app.services.anpr.providers.runoi_provider import RunoiANPRProvider


@dataclass(slots=True)
class PlateRecognitionDiagnostics:
    provider: str
    raw_text: str | None
    candidates: list[str]
    confidence: float | None
    bbox: dict[str, int] | None
    processing_status: str
    reason: str | None
    frame_timestamp: float | None
    preprocessing_steps: list[str]


class PlateRecognitionPipeline:
    def __init__(self) -> None:
        self.runoi_provider = RunoiANPRProvider()
        self.fallback_provider = FilenameFallbackANPRProvider()

    async def recognize_from_image(self, file_path: str, *, plate_hint: str | None = None) -> PlateRecognitionResult:
        return await self._recognize("image", file_path=file_path, plate_hint=plate_hint)

    async def recognize_from_video(self, file_path: str, *, plate_hint: str | None = None) -> PlateRecognitionResult:
        return await self._recognize("video", file_path=file_path, plate_hint=plate_hint)

    async def _recognize(self, media_type: str, *, file_path: str, plate_hint: str | None) -> PlateRecognitionResult:
        provider = settings.anpr_provider.lower()
        runoi_result: PlateRecognitionResult | None = None

        if provider == "runoi":
            if media_type == "image":
                runoi_result = await self.runoi_provider.recognize_from_image(file_path, plate_hint=plate_hint)
            else:
                runoi_result = await self.runoi_provider.recognize_from_video(file_path, plate_hint=plate_hint)

        if runoi_result and not runoi_result.error and runoi_result.normalized_plate_number != "UNKNOWN":
            return runoi_result

        if media_type == "image":
            fallback = await self.fallback_provider.recognize_from_image(file_path, plate_hint=plate_hint)
        else:
            fallback = await self.fallback_provider.recognize_from_video(file_path, plate_hint=plate_hint)

        if runoi_result and runoi_result.error:
            fallback.preprocessing_steps = [*runoi_result.preprocessing_steps, *fallback.preprocessing_steps]
            fallback.error = runoi_result.error
        return fallback


plate_recognition_pipeline = PlateRecognitionPipeline()


def build_diagnostics(result: PlateRecognitionResult) -> PlateRecognitionDiagnostics:
    return PlateRecognitionDiagnostics(
        provider=result.provider,
        raw_text=result.raw_text,
        candidates=result.candidate_plates,
        confidence=result.confidence,
        bbox=result.bounding_box,
        processing_status="fallback" if result.provider == "filename_fallback" else "processed",
        reason=result.error,
        frame_timestamp=result.frame_timestamp,
        preprocessing_steps=result.preprocessing_steps,
    )
