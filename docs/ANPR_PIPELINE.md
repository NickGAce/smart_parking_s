# ANPR-конвейер Smart Parking

## 1) Аудит текущего pipeline (до исправлений)

- Upload image принимался в `POST /api/v1/access-events/recognize/image`, дальше файл сохранялся через `media_storage_service.save(...)`.
- Распознавание использовало mock-алгоритм по `filename/plate_hint` (regex по строке), без реального OCR по пикселям.
- Итоговый `plate_number` выбирался из имени файла/подсказки, confidence был статическим (`~0.93`/`~0.51`).
- Нормализация была минимальная: uppercase + удаление пробелов/дефисов.
- Из-за этого качество распознавания по изображению было низким: фактически не анализировалось содержимое фото.

## 2) Новый pipeline

### Ingest + storage
1. `POST /api/v1/access-events/recognize/image` принимает image upload.
2. Файл сохраняется в mock/local storage (`app/services/media_storage.py`) и URL сохраняется в access-event.

### Provider chain
1. **Preprocessing stage** (внутри `EnhancedPlateRecognitionPipeline`):
   - grayscale;
   - contrast enhancement;
   - sharpen;
   - resize x2;
   - thresholding;
   - denoise (median filter);
   - опциональный crop центральной/нижней области (region heuristic).
2. **Основной OCR provider chain**:
   - `OcrSpaceProvider` (HTTP OCR; можно задать `OCR_SPACE_API_KEY`);
   - `TesseractOcrProvider` (локальный OCR, если доступны Pillow + pytesseract).
3. **Fallback provider**: `filename_hint` используется только если OCR не дал валидного кандидата.

### Postprocessing
- очистка мусорных символов;
- uppercase;
- нормализация пробелов/дефисов;
- карта похожих кириллица/латиница (А↔A, В↔B, ...);
- генерация candidate_plates из OCR-токенов;
- валидация по regex-паттернам:
  - RU с регионом: `A123BC77`/`A123BC777`;
  - RU без региона: `A123BC`;
- выбор лучшего кандидата по valid-pattern + confidence.

## 3) PlateRecognitionResult / diagnostics

Pipeline теперь отдает:
- `raw_text`;
- `candidate_plates`;
- `selected_plate`;
- `normalized_plate`;
- `confidence`;
- `provider`;
- `preprocessing_steps`;
- `reason`;
- `processing_status`.

## 4) Endpoint response

`POST /api/v1/access-events/recognize/image` возвращает access-event + диагностику OCR:
- `raw_text`;
- `candidates`;
- `provider`;
- `confidence`;
- `recognition_reason`;
- `processing_status_detail`;
- `selected_plate`;
- `normalized_plate`;
- `preprocessing_steps`.

> Важно: fallback-механизм не маскируется под реальный OCR и помечается отдельным provider/reason.
