from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass

from fastapi import UploadFile

from app.models.vehicle_access_event import RecognitionSource
from app.services.plate_recognition import normalize_plate_number


PLATE_PATTERN = re.compile(r"([A-Za-zА-Яа-я0-9]{5,10})")


@dataclass(slots=True)
class PipelineRecognitionResult:
    plate_number: str
    normalized_plate_number: str
    confidence: float
    bounding_box: dict | None = None
    frame_timestamp: float | None = None
    source: RecognitionSource = RecognitionSource.mock


class PlateRecognitionPipeline:
    async def recognize_from_image(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        raise NotImplementedError

    async def recognize_from_video(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        raise NotImplementedError


class MockPlateRecognitionPipeline(PlateRecognitionPipeline):
    async def recognize_from_image(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        candidate = plate_hint or file.filename or "UNKNOWN"
        match = PLATE_PATTERN.search(candidate)
        plate = (match.group(1) if match else "UNKNOWN").upper()
        normalized = normalize_plate_number(plate)
        confidence = 0.93 if normalized != "UNKNOWN" else 0.51
        return PipelineRecognitionResult(
            plate_number=plate,
            normalized_plate_number=normalized,
            confidence=confidence,
            bounding_box={"x": 12, "y": 24, "w": 180, "h": 64} if normalized != "UNKNOWN" else None,
        )

    async def recognize_from_video(self, file: UploadFile, plate_hint: str | None = None) -> PipelineRecognitionResult:
        base_candidate = plate_hint or file.filename or "UNKNOWN"
        frames = [f"{base_candidate}_frame_{idx}" for idx in range(1, 6)]
        detections: list[PipelineRecognitionResult] = []
        for idx, frame in enumerate(frames, start=1):
            match = PLATE_PATTERN.search(frame)
            plate = (match.group(1) if match else "UNKNOWN").upper()
            normalized = normalize_plate_number(plate)
            detections.append(
                PipelineRecognitionResult(
                    plate_number=plate,
                    normalized_plate_number=normalized,
                    confidence=0.9 if normalized != "UNKNOWN" else 0.5,
                    bounding_box={"x": 12, "y": 24, "w": 180, "h": 64} if normalized != "UNKNOWN" else None,
                    frame_timestamp=float(idx * 2),
                )
            )

        plate_counter = Counter(item.normalized_plate_number for item in detections)
        best_plate, _ = plate_counter.most_common(1)[0]
        winners = [item for item in detections if item.normalized_plate_number == best_plate]
        avg_confidence = round(sum(item.confidence for item in winners) / len(winners), 3)
        return PipelineRecognitionResult(
            plate_number=winners[0].plate_number,
            normalized_plate_number=best_plate,
            confidence=avg_confidence,
            bounding_box=winners[0].bounding_box,
            frame_timestamp=winners[len(winners) // 2].frame_timestamp,
        )


plate_recognition_pipeline: PlateRecognitionPipeline = MockPlateRecognitionPipeline()
