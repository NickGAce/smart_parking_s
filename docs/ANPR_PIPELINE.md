# ANPR-конвейер Smart Parking

## Почему добавлен provider chain

Реальный OCR может быть недоступен в dev/test среде, поэтому pipeline построен как цепочка провайдеров с безопасным fallback:

1. `OptionalOcrPlateRecognitionProvider` — опциональный слой для будущего реального OCR (по умолчанию пропускает обработку).
2. `MockPlateRecognitionProvider` — использует `plate_hint` / `expected_plate`.
3. `FilenameHintPlateRecognitionProvider` — извлекает номер из имени файла (`car_A123BC77.jpg`).

Если номер не найден, backend возвращает `decision=review`, `processing_status=processed`, `reason=plate_not_recognized`.
Если провайдеры падают, backend возвращает `decision=review`, `processing_status=failed`, `reason=provider_error`.

## Единая нормализация

Везде используется единая функция `normalize_plate_number`:
- удаляет не-алфанумерические символы,
- приводит к upper case,
- `A123BC77`, `A 123 BC 77`, `a-123-bc-77` -> `A123BC77`.

## Поток image/video

`upload multipart -> validate media type -> save file -> provider chain -> normalize -> vehicle/booking linking -> decision engine -> vehicle_access_event + audit + notifications`

## Как подключить реальный OCR

1. Реализовать `recognize(...)` внутри `OptionalOcrPlateRecognitionProvider`.
2. Вернуть `PipelineRecognitionResult` с `plate_number`, `confidence`, `provider`, `raw_response`.
3. Оставить fallback-провайдеры в цепочке (для деградации без падений).
