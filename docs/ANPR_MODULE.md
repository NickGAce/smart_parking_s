# ANPR/LPR модуль Smart Parking

## Назначение
Модуль обрабатывает события контроля доступа (въезд/выезд) по распознанному номеру автомобиля и автоматически связывает их с бронированиями.

## Архитектура
1. **Источник номера**
   - `POST /access-events/recognize` (mock-распознавание через `plate_recognition_service`)
   - `POST /access-events/manual` (ручной ввод номера)
2. **Нормализация**
   - номер приводится к верхнему регистру, удаляются пробелы и дефисы.
3. **Matching**
   - поиск подходящего бронирования по `parking_lot_id + normalized_plate_number`.
4. **Decision Engine**
   - `entry`: перевод `pending/confirmed -> active`, либо `review`, если номер неизвестен.
   - `exit`: перевод `active -> completed`, либо `denied`, если активной записи нет.
   - низкая confidence -> `review`.
5. **Persistence и Observability**
   - запись в `vehicle_access_events`;
   - аудит (`anpr.access_event`, `anpr.unknown_plate_detected`);
   - уведомления guard/owner/admin для review/denied кейсов.

## Расширяемость
Текущая реализация использует `MockPlateRecognitionService`, но слой `PlateRecognitionService` изолирован и позволяет подключить Plate Recognizer/OpenALPR/EasyOCR без изменения API контроллеров.
