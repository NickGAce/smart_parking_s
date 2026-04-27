# ANPR Pipeline Smart Parking

## Архитектура pipeline

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

## Flow (image/video -> decision)
`upload media -> detect plate -> normalize -> resolve vehicle -> resolve booking -> transition lifecycle -> persist access-event -> notify/audit`
