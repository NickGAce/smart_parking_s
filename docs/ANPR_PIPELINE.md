# ANPR-конвейер Smart Parking

## Архитектура конвейера

1. **Ingest**
   - `POST /api/v1/access-events/recognize/image`
   - `POST /api/v1/access-events/recognize/video`
2. **Storage**
   - файл сохраняется в `media_storage_service` (локальный/mock storage), возвращается URL.
3. **Recognition**
   - `plate_recognition_pipeline`:
     - `recognize_from_image(file)` — mock regex по имени файла/подсказке;
     - `recognize_from_video(file)` — mock разбиение на кадры, голосование по номеру, агрегированная confidence.
4. **Normalization**
   - plate -> uppercase + remove spaces/hyphens.
5. **Smart Linking**
   - поиск `vehicle` по `normalized_plate_number`;
   - связывание с `user_id`;
   - поиск подходящего `booking` (entry: pending/confirmed/active, exit: active).
6. **Decision Engine**
   - known plate + valid booking -> auto check-in/check-out -> `allowed`;
   - low confidence/unknown plate -> `review`;
   - exit without active booking -> `denied`.
7. **Persistence & Ops**
   - запись `vehicle_access_events` с media URL и processing status;
   - audit log (`anpr.access_event`, `anpr.unknown_plate_detected`);
   - notifications для guard/owner/admin при `review/denied`.

## Поток обработки (изображение/видео -> решение)
`загрузка медиа -> распознавание номера -> нормализация -> поиск автомобиля -> поиск бронирования -> переход жизненного цикла -> запись события доступа -> уведомления/аудит`

## Runoi provider integration (YOLOv8 + CRNN)

С апреля 2026 backend использует provider architecture:
1. `RunoiANPRProvider` (`provider=runoi_yolo_crnn`) — YOLOv8 detection + CRNN OCR + OpenCV preprocessing.
2. Fallback provider (`provider=filename_fallback`) — только для demo/test, **не полноценное OCR**.

### Что было адаптировано из Runoi/ANPR-System
- CRNN архитектура и CTC decode.
- OpenCV preprocessing (grayscale + blur + Otsu + contour + perspective transform).
- Видео-логика со стабилизацией по частоте распознанных кандидатов.

Attribution: **ANPR provider adapted from Runoi/ANPR-System, MIT License**.

### Пути к моделям
Положите модели в:
- `ANPR_RUNOI_YOLO_MODEL_PATH` (например `./app/services/anpr/runoi/models/yolo/best.pt`)
- `ANPR_RUNOI_CRNN_MODEL_PATH` (например `./app/services/anpr/runoi/models/crnn/crnn_ocr_model_int8_fx.pth`)

Если пути неверные/файлы отсутствуют, backend возвращает `provider_unavailable` и автоматически переключается на fallback.

### Environment variables
- `ANPR_PROVIDER=runoi|mock|fallback`
- `ANPR_RUNOI_YOLO_MODEL_PATH=...`
- `ANPR_RUNOI_CRNN_MODEL_PATH=...`
- `ANPR_CONFIDENCE_THRESHOLD=0.5`
- `ANPR_DEVICE=cpu|cuda`

### Зависимости
Тяжелые зависимости вынесены в `requirements-anpr.txt`:
`torch`, `torchvision`, `ultralytics`, `opencv-python`, `numpy`.

Установка:
```bash
pip install -r requirements-anpr.txt
```

Без этих библиотек приложение продолжит работать через fallback provider.
