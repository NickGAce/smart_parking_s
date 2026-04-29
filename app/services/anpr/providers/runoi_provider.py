from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.models.vehicle_access_event import RecognitionSource
from app.services.anpr.model_paths import get_runoi_model_paths
from app.services.anpr.providers.base import PlateRecognitionResult
from app.services.plate_recognition import normalize_plate_number


class RunoiANPRProvider:
    provider_name = "runoi_yolo_crnn"

    def __init__(self) -> None:
        self._initialized = False
        self._init_error: str | None = None
        self._yolo_model: Any = None
        self._crnn_model: Any = None
        self._torch: Any = None
        self._cv2: Any = None
        self._np: Any = None

    def _lazy_init(self) -> None:
        if self._initialized:
            return

        model_paths = get_runoi_model_paths()
        missing = [str(path) for path in (model_paths.yolo_model_path, model_paths.crnn_model_path) if not path.exists()]
        if missing:
            self._init_error = f"provider_unavailable: model files not found: {', '.join(missing)}"
            self._initialized = True
            return

        try:
            import cv2
            import numpy as np
            import torch
            import torch.ao.quantization.quantize_fx as quantize_fx
            from torch import nn
            from torchvision import transforms
            from ultralytics import YOLO
            from torch.ao.quantization import QConfigMapping
        except Exception as exc:  # pragma: no cover - depends on runtime env
            self._init_error = f"provider_unavailable: required deps missing ({exc})"
            self._initialized = True
            return

        class CRNN(nn.Module):
            def __init__(self, num_classes: int):
                super().__init__()
                self.cnn = nn.Sequential(
                    nn.Conv2d(1, 64, kernel_size=3, padding=1),
                    nn.ReLU(True),
                    nn.MaxPool2d(2, 2),
                    nn.Conv2d(64, 128, kernel_size=3, padding=1),
                    nn.ReLU(True),
                    nn.MaxPool2d(2, 2),
                    nn.Conv2d(128, 256, kernel_size=3, padding=1),
                    nn.BatchNorm2d(256),
                    nn.ReLU(True),
                    nn.Conv2d(256, 256, kernel_size=3, padding=1),
                    nn.ReLU(True),
                    nn.MaxPool2d((2, 1), (2, 1)),
                    nn.Conv2d(256, 512, kernel_size=3, padding=1),
                    nn.BatchNorm2d(512),
                    nn.ReLU(True),
                    nn.Conv2d(512, 512, kernel_size=3, padding=1),
                    nn.ReLU(True),
                    nn.MaxPool2d((2, 1), (2, 1)),
                )
                self.rnn = nn.LSTM(512 * 2, 256, bidirectional=True, num_layers=2, batch_first=True)
                self.classifier = nn.Linear(512, num_classes)

            def forward(self, x):
                x = self.cnn(x)
                batch, channels, height, _ = x.size()
                x = x.reshape(batch, channels * height, -1).permute(0, 2, 1)
                x, _ = self.rnn(x)
                x = self.classifier(x).permute(1, 0, 2)
                return nn.functional.log_softmax(x, dim=2)

        self._torch = torch
        self._cv2 = cv2
        self._np = np
        try:
            self._yolo_model = YOLO(str(model_paths.yolo_model_path))
            self._yolo_model.to(settings.anpr_device)

            alphabet = "0123456789ABCEHKMOPTXY"
            int_to_char = {i + 1: char for i, char in enumerate(alphabet)}
            int_to_char[0] = ""

            num_classes = len(alphabet) + 1
            model_to_load = CRNN(num_classes).eval()
            qconfig_mapping = QConfigMapping().set_global(torch.ao.quantization.get_default_qconfig("fbgemm"))
            example_inputs = (torch.randn(1, 1, 32, 128),)
            model_prepared = quantize_fx.prepare_fx(model_to_load, qconfig_mapping, example_inputs)
            model_quantized = quantize_fx.convert_fx(model_prepared)
            model_quantized.load_state_dict(
                torch.load(str(model_paths.crnn_model_path), map_location=settings.anpr_device)
            )
            self._crnn_model = model_quantized
            self._int_to_char = int_to_char
            self._transform = transforms.Compose(
                [transforms.ToPILImage(), transforms.Resize((32, 128)), transforms.Grayscale(), transforms.ToTensor()]
            )
        except Exception as exc:  # pragma: no cover - depends on runtime env/model files
            self._init_error = f"provider_unavailable: model init failed ({exc})"
        finally:
            self._initialized = True

    def _preprocess_plate(self, plate_image):
        gray = self._cv2.cvtColor(plate_image, self._cv2.COLOR_BGR2GRAY)
        blurred = self._cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = self._cv2.threshold(blurred, 0, 255, self._cv2.THRESH_BINARY + self._cv2.THRESH_OTSU)
        contours, _ = self._cv2.findContours(thresh.copy(), self._cv2.RETR_EXTERNAL, self._cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return plate_image
        contours = sorted(contours, key=self._cv2.contourArea, reverse=True)
        for contour in contours:
            peri = self._cv2.arcLength(contour, True)
            approx = self._cv2.approxPolyDP(contour, 0.02 * peri, True)
            if len(approx) == 4:
                pts = approx.reshape(4, 2).astype("float32")
                dst = self._np.array([[0, 0], [199, 0], [199, 63], [0, 63]], dtype="float32")
                matrix = self._cv2.getPerspectiveTransform(pts, dst)
                return self._cv2.warpPerspective(plate_image, matrix, (200, 64))
        return plate_image

    def _decode(self, preds):
        best = preds.permute(1, 0, 2).argmax(dim=2)[0]
        seq = []
        last_char_idx = 0
        for char_idx in best:
            value = char_idx.item()
            if value != 0 and value != last_char_idx:
                seq.append(self._int_to_char.get(value, ""))
            last_char_idx = value
        return "".join(seq)

    def _recognize_crop(self, plate_image):
        with self._torch.no_grad():
            input_tensor = self._transform(plate_image).unsqueeze(0).to(settings.anpr_device)
            preds = self._crnn_model(input_tensor)
            return self._decode(preds)

    def _recognize_frame(self, frame, track_id: int | None = None) -> list[dict[str, Any]]:
        mode = "track" if track_id is not None else "predict"
        if mode == "track":
            detections = self._yolo_model.track(frame, persist=True, verbose=False, device=settings.anpr_device)
        else:
            detections = self._yolo_model.predict(frame, verbose=False, device=settings.anpr_device)
        results = []
        for box in detections[0].boxes.data:
            x1, y1, x2, y2, conf, *_ = box.cpu().numpy()
            if float(conf) < settings.anpr_confidence_threshold:
                continue
            roi = frame[int(y1) : int(y2), int(x1) : int(x2)]
            if roi.size == 0:
                continue
            processed = self._preprocess_plate(roi)
            text = self._recognize_crop(processed)
            results.append({"bbox": [int(x1), int(y1), int(x2), int(y2)], "confidence": float(conf), "text": text})
        return results

    async def recognize_from_image(self, file_path: str, *, plate_hint: str | None = None) -> PlateRecognitionResult:
        self._lazy_init()
        if self._init_error:
            return PlateRecognitionResult(
                plate_number="UNKNOWN",
                normalized_plate_number="UNKNOWN",
                confidence=None,
                provider=self.provider_name,
                source=RecognitionSource.provider,
                preprocessing_steps=["provider_unavailable"],
                error=self._init_error,
            )

        frame = self._cv2.imread(file_path)
        if frame is None:
            return PlateRecognitionResult(
                plate_number="UNKNOWN",
                normalized_plate_number="UNKNOWN",
                confidence=None,
                provider=self.provider_name,
                source=RecognitionSource.provider,
                error="image_read_failed",
            )

        detected = self._recognize_frame(frame)
        if not detected:
            return PlateRecognitionResult(
                plate_number="UNKNOWN",
                normalized_plate_number="UNKNOWN",
                confidence=0.0,
                raw_text="",
                provider=self.provider_name,
                source=RecognitionSource.provider,
                preprocessing_steps=["opencv_preprocess", "yolov8_detect", "crnn_ocr"],
                error="plate_not_found",
            )
        best = max(detected, key=lambda item: item["confidence"])
        plate = best["text"] or "UNKNOWN"
        return PlateRecognitionResult(
            plate_number=plate,
            normalized_plate_number=normalize_plate_number(plate),
            confidence=best["confidence"],
            raw_text=best["text"],
            candidate_plates=[item["text"] for item in detected if item["text"]],
            provider=self.provider_name,
            source=RecognitionSource.provider,
            bounding_box={"x1": best["bbox"][0], "y1": best["bbox"][1], "x2": best["bbox"][2], "y2": best["bbox"][3]},
            preprocessing_steps=["opencv_preprocess", "yolov8_detect", "crnn_ocr"],
        )

    async def recognize_from_video(self, file_path: str, *, plate_hint: str | None = None) -> PlateRecognitionResult:
        self._lazy_init()
        if self._init_error:
            return PlateRecognitionResult(
                plate_number="UNKNOWN",
                normalized_plate_number="UNKNOWN",
                confidence=None,
                provider=self.provider_name,
                source=RecognitionSource.provider,
                preprocessing_steps=["provider_unavailable"],
                error=self._init_error,
            )

        cap = self._cv2.VideoCapture(file_path)
        if not cap.isOpened():
            return PlateRecognitionResult(
                plate_number="UNKNOWN",
                normalized_plate_number="UNKNOWN",
                confidence=None,
                provider=self.provider_name,
                source=RecognitionSource.provider,
                error="video_open_failed",
            )

        fps = cap.get(self._cv2.CAP_PROP_FPS) or 25.0
        sample_step = max(1, int(fps // 2))
        idx = 0
        all_candidates: list[tuple[str, float, float, list[int]]] = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if idx % sample_step != 0:
                idx += 1
                continue
            ts = idx / fps
            for det in self._recognize_frame(frame, track_id=1):
                if det["text"]:
                    all_candidates.append((det["text"], det["confidence"], ts, det["bbox"]))
            idx += 1
        cap.release()

        if not all_candidates:
            return PlateRecognitionResult(
                plate_number="UNKNOWN",
                normalized_plate_number="UNKNOWN",
                confidence=0.0,
                raw_text="",
                provider=self.provider_name,
                source=RecognitionSource.provider,
                preprocessing_steps=["video_sampling", "opencv_preprocess", "yolov8_track", "crnn_ocr"],
                error="plate_not_found",
            )

        counts = Counter(item[0] for item in all_candidates)
        best_text, _ = counts.most_common(1)[0]
        winners = [item for item in all_candidates if item[0] == best_text]
        avg_conf = round(sum(item[1] for item in winners) / len(winners), 3)
        best_sample = max(winners, key=lambda item: item[1])
        return PlateRecognitionResult(
            plate_number=best_text,
            normalized_plate_number=normalize_plate_number(best_text),
            confidence=avg_conf,
            raw_text=best_text,
            candidate_plates=list({item[0] for item in all_candidates}),
            provider=self.provider_name,
            source=RecognitionSource.provider,
            bounding_box={"x1": best_sample[3][0], "y1": best_sample[3][1], "x2": best_sample[3][2], "y2": best_sample[3][3]},
            frame_timestamp=best_sample[2],
            preprocessing_steps=["video_sampling", "opencv_preprocess", "yolov8_track", "crnn_ocr", "stability_by_frequency"],
        )
