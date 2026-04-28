from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings


@dataclass(slots=True)
class RunoiModelPaths:
    yolo_model_path: Path
    crnn_model_path: Path


def get_runoi_model_paths() -> RunoiModelPaths:
    return RunoiModelPaths(
        yolo_model_path=Path(settings.anpr_runoi_yolo_model_path),
        crnn_model_path=Path(settings.anpr_runoi_crnn_model_path),
    )
