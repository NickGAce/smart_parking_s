from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any, Protocol

from fastapi import UploadFile

from app.models.vehicle_access_event import RecognitionSource
from app.services.plate_recognition import extract_plate_candidate, normalize_plate_number


@dataclass(slots=True)
class PipelineRecognitionResult:
    plate_number: str
    normalized_plate_number: str
    confidence: float | None
    provider: str
    source: RecognitionSource
    bounding_box: dict[str, float] | None = None
    frame_timestamp: float | None = None
    raw_response: dict[str, Any] | None = None
    error: str | None = None


class BasePlateRecognitionProvider(Protocol):
    name: str

    async def recognize(
        self,
        *,
        file: UploadFile,
        file_bytes: bytes,
        plate_hint: str | None,
        media_type: str,
    ) -> PipelineRecognitionResult | None:
        ...


class MockPlateRecognitionProvider:
    name = "mock"

    async def recognize(
        self,
        *,
        file: UploadFile,
        file_bytes: bytes,
        plate_hint: str | None,
        media_type: str,
    ) -> PipelineRecognitionResult | None:
        plate = extract_plate_candidate(plate_hint)
        if not plate:
            return None
        return PipelineRecognitionResult(
            plate_number=plate,
            normalized_plate_number=plate,
            confidence=0.97,
            provider=self.name,
            source=RecognitionSource.mock,
            raw_response={"mode": media_type, "hint_used": True, "bytes": len(file_bytes)},
        )


class FilenameHintPlateRecognitionProvider:
    name = "filename_hint"

    async def recognize(
        self,
        *,
        file: UploadFile,
        file_bytes: bytes,
        plate_hint: str | None,
        media_type: str,
    ) -> PipelineRecognitionResult | None:
        filename = Path(file.filename or "").stem
        plate = extract_plate_candidate(filename)
        if not plate:
            return None
        return PipelineRecognitionResult(
            plate_number=plate,
            normalized_plate_number=plate,
            confidence=0.9 if media_type == "image" else 0.86,
            provider=self.name,
            source=RecognitionSource.provider,
            frame_timestamp=2.0 if media_type == "video" else None,
            raw_response={"mode": media_type, "filename": file.filename, "bytes": len(file_bytes)},
        )


class OptionalOcrPlateRecognitionProvider:
    name = "ocr_optional"

    async def recognize(
        self,
        *,
        file: UploadFile,
        file_bytes: bytes,
        plate_hint: str | None,
        media_type: str,
    ) -> PipelineRecognitionResult | None:
        if media_type != "image":
            return None

        # Optional OCR: works only when dependencies are available in runtime.
        try:
            import pytesseract  # type: ignore
            from PIL import Image, ImageOps  # type: ignore
        except Exception:
            return None

        image = Image.open(BytesIO(file_bytes))
        grayscale = ImageOps.grayscale(image)
        # Simple binarization often helps plate OCR for high-contrast images.
        prepared = grayscale.point(lambda p: 255 if p > 135 else 0)

        ocr_text = pytesseract.image_to_string(
            prepared,
            config=(
                "--psm 7 "
                "-c tessedit_char_whitelist="
                "ABEKMHOPCTYX0123456789АВЕКМНОРСТУХ"
            ),
        )
        plate = extract_plate_candidate(plate_hint, ocr_text, Path(file.filename or "").stem)
        if not plate:
            return None

        return PipelineRecognitionResult(
            plate_number=plate,
            normalized_plate_number=plate,
            confidence=0.82,
            provider=self.name,
            source=RecognitionSource.provider,
            raw_response={
                "ocr_text": ocr_text[:128],
                "mode": media_type,
                "bytes": len(file_bytes),
            },
        )


class PlateRecognitionPipeline:
    async def recognize_from_image(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        raise NotImplementedError

    async def recognize_from_video(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        raise NotImplementedError


class ProviderChainPlateRecognitionPipeline(PlateRecognitionPipeline):
    def __init__(self):
        self.ocr_provider = OptionalOcrPlateRecognitionProvider()
        self.providers: list[BasePlateRecognitionProvider] = [
            self.ocr_provider,
            MockPlateRecognitionProvider(),
            FilenameHintPlateRecognitionProvider(),
        ]

    async def recognize_from_image(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        self._validate_file(file, "image")
        file_bytes = await self._read_file_bytes(file)
        return await self._recognize(file=file, file_bytes=file_bytes, plate_hint=plate_hint, media_type="image")

    async def recognize_from_video(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        self._validate_file(file, "video")
        file_bytes = await self._read_file_bytes(file)
        return await self._recognize(file=file, file_bytes=file_bytes, plate_hint=plate_hint, media_type="video")

    async def _recognize(
        self,
        *,
        file: UploadFile,
        file_bytes: bytes,
        plate_hint: str | None,
        media_type: str,
    ) -> PipelineRecognitionResult:
        errors: list[str] = []
        for provider in self.providers:
            try:
                result = await provider.recognize(
                    file=file,
                    file_bytes=file_bytes,
                    plate_hint=plate_hint,
                    media_type=media_type,
                )
            except Exception:
                errors.append(f"provider:{provider.name}")
                continue
            if result and normalize_plate_number(result.plate_number) != "UNKNOWN":
                return result

        return PipelineRecognitionResult(
            plate_number="UNKNOWN",
            normalized_plate_number="UNKNOWN",
            confidence=None,
            provider="none",
            source=RecognitionSource.provider,
            raw_response={"providers": [provider.name for provider in self.providers]},
            error=";".join(errors) if errors else None,
        )

    @staticmethod
    async def _read_file_bytes(file: UploadFile) -> bytes:
        payload = await file.read()
        await file.seek(0)
        return payload

    @staticmethod
    def _validate_file(file: UploadFile, media_type: str) -> None:
        if file.filename is None:
            raise ValueError("Файл не передан")

        filename = file.filename.lower()
        guessed_type = mimetypes.guess_type(filename)[0] or ""
        content_type = file.content_type or ""

        acceptable_prefix = f"{media_type}/"
        if not (content_type.startswith(acceptable_prefix) or guessed_type.startswith(acceptable_prefix)):
            raise ValueError(f"Неподдерживаемый формат файла для {media_type}")


plate_recognition_pipeline: PlateRecognitionPipeline = ProviderChainPlateRecognitionPipeline()
