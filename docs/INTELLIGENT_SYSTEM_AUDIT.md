# Intelligent System Audit: Decision Report (2026-04-27)

## Scope
This document describes explainability additions for Smart Parking recommendations and auto-assign booking.

## Decision Report model
Every auto-assign decision may include `decision_report`:
- `selected_spot_id`
- `selected_spot_label`
- `final_score`
- `confidence`
- `factors[]`: `name`, `weight`, `raw_value`, `contribution`, `explanation`
- `hard_constraints_passed[]`
- `rejected_candidates[]`: `spot_id`, `reason`, `constraint`
- `generated_at`
- `selected_candidate`

## Scoring and confidence
Scoring for each candidate:

`final_score = Σ(raw_factor_value * factor_weight)`

Current weighted factors:
- availability
- spot_type
- zone
- charger
- role
- conflict

Weights are user-configurable in API requests (`weights`) and are normalized before scoring.

Confidence:

`confidence = clamp((top_score - second_score) / max(top_score, 0.0001), 0, 1)`

Where:
- `top_score` — score of selected candidate
- `second_score` — score of second candidate (or `0` if absent)

## Hard constraints
Hard constraints are pass/fail and may reject candidate before ranking:
- `spot_status_available`
- `interval_conflict`
- `role_access`
- `charger_preference` (when prefer_charger is enabled)

## Rejected candidates auditability
Rejected candidates are captured explicitly with machine-readable reason and constraint id.
This allows frontend to show why blocked/conflicting/restricted spots were skipped.

## Endpoint-level behavior
- `POST /api/v1/recommendations/spots` returns ranked list, rejected candidates, and optional `decision_report`.
- `POST /api/v1/recommendations/decision-report` returns only best decision report.
- `POST /api/v1/bookings` with `auto_assign=true` returns `decision_report` and compact `assignment_metadata`.

## Frontend traceability
Decision report panel renders:
- selected place and score
- confidence
- factor contributions (progress bars)
- hard-constraint badges
- compact rejected candidates list

## Management recommendations module (2026-04-27)

### Endpoint
- `GET /api/v1/analytics/management-recommendations`
- Query:
  - `parking_lot_id` (optional)
  - `date_from` (required)
  - `date_to` (required)
  - `severity` (optional)

### Recommendation rule-set
Rules are built on top of already implemented analytics/anomaly primitives (without duplicating heavy models):

1. **overload**
   - Trigger: high average occupancy for lot (threshold 85%+).
   - Action: recommend redistribution and guest-booking limitation in peak.

2. **no_show**
   - Триггер: повышенная доля неявок (15%+).
   - Действие: сократить период ожидания подтверждения прибытия и включить автоотмену.

3. **cancellation**
   - Trigger: cancellation rate elevated and recent-half cancellations > previous-half cancellations.
   - Action: adjust booking policy (late-cancel penalties, warning windows, limits).

4. **underutilization**
   - Trigger: one zone has persistently low occupancy (<=25%).
   - Действие: использовать зону как резервную.

5. **zone_imbalance**
   - Trigger: high spread between max/min zone occupancy (40pp+) with overloaded zone.
   - Action: rebalance routing/quotas between zones.

6. **rule_change**
   - Trigger: anomaly signal for frequent cancellations.
   - Action: tighten policy for repeated violators and late cancellation behavior.

7. **security**
   - Триггер: много событий с неизвестными номерами в журнале доступа за период.
   - Action: strengthen access control and guard escalation flow.

### RBAC
- `admin`: sees recommendations across all lots.
- `owner`: sees only own parking lots.
- `tenant`: no access (`403`).

## Forecast quality analytics module (2026-04-27)

### Endpoint
- `GET /api/v1/analytics/forecast-quality`
- Query:
  - `parking_lot_id` (optional)
  - `date_from` (required)
  - `date_to` (required)
  - `bucket` (`hour|day`, default `hour`)

### Что считает модуль
Модуль сравнивает прогнозную загрузку с фактической загрузкой на историческом периоде и возвращает агрегированные метрики ошибок:
- `MAE` (средняя абсолютная ошибка, п.п.)
- `MAPE` (средняя абсолютная процентная ошибка, %)
- `RMSE` (квадратичная ошибка, optional)
- `sample_size` (размер выборки бакетов)
- `confidence` + `explanation` (надежность оценки)

### Формулы
- `MAE = (1/n) * Σ |y_true - y_pred|`
- `MAPE = (100%/k) * Σ (|y_true - y_pred| / |y_true|), y_true > 0`
- `RMSE = sqrt((1/n) * Σ (y_true - y_pred)^2)`

### Confidence policy
- `high`: данных достаточно для устойчивой оценки.
- `medium`: данных умеренно, результат информативен, но с ограничениями.
- `low`: мало бакетов, возвращается warning/explanation о низкой надежности.

### RBAC
- `admin`, `owner`: доступ есть.
- другие роли: `403`.

## Модуль объяснимости аномалий (2026-04-27)

### Расширенный payload аномалий
`GET /api/v1/analytics/anomalies` теперь возвращает расширенный контекст аномалий:
- `explanation` (что произошло)
- `impact` (почему это важно)
- `recommended_action` (что сделать)
- `related_metric` (метрика-источник)
- `severity_reason` (почему выбран этот уровень критичности)

Все поля добавлены без ломающих изменений и являются optional в схеме для обратной совместимости.

### Каталог action mapping

| Тип аномалии | Контекст срабатывания | Рекомендуемое действие |
|---|---|---|
| `user.frequent_no_show` | Высокая доля неявок у пользователя | Сократить период ожидания подтверждения прибытия / включить напоминания |
| `user.frequent_cancellations` | Высокая доля отмен у пользователя | Пересмотреть правила отмены |
| `parking.occupancy_spike` | Резкий всплеск бронирований относительно базового уровня | Включить резервную зону или ограничить гостевые бронирования |
| `security.suspicious_access_events` | Подозрительные события с неизвестными номерами | Проверить неизвестные номера |
| `booking.unusual_duration` | Длительность бронирования заметно выше базового уровня | Проверить ограничения по максимальной длительности бронирования |

### Поведение frontend
- Компактный режим аномалий используется на Dashboard для быстрой приоритизации.
- Подробный режим используется в карточках страницы аналитики.
- Модальное окно деталей содержит три блока объяснимости:
  1. **Что произошло**
  2. **Почему это важно**
  3. **Что сделать**

### Дополнительные детекторы аномалий
- `security.suspicious_access_events`: считает сигналы о неизвестных номерах из журнала доступа.
- `booking.unusual_duration`: выявляет значимый рост средней длительности бронирования относительно базового окна.

## Обновление: интеллектуальный ANPR/LPR модуль (2026-04-27)

Добавлен модуль интеллектуального распознавания номеров и автоматического контроля доступа:
- введена доменная сущность `vehicle_access_events`;
- реализованы решения `allowed / review / denied` с причинами;
- добавлена автоматическая реакция на въезд/выезд через жизненный цикл бронирований (auto check-in/check-out);
- добавлены уведомления и аудит для неизвестных номеров/подозрительных событий;
- добавлен frontend-раздел «Контроль доступа» и dashboard-виджет последних событий.

## Доработка интеллектуального модуля ANPR (2026-04-27)

В модуль добавлены:
- отдельная доменная сущность `vehicles` с привязкой номерных знаков к пользователям;
- логика подстановки основного автомобиля (primary) при создании бронирования;
- pipeline загрузки и распознавания `image/video`;
- media-атрибуты и статус обработки в `vehicle_access_events`;
- интеллектуальное связывание: `plate -> vehicle -> user -> booking -> access decision`;
- frontend-страница «Мои автомобили» и расширенный интерфейс контроля доступа с загрузкой изображений/видео.

## ANPR upgrade to YOLOv8 + CRNN (2026-04-28)

ANPR pipeline upgraded from mock-first recognition to provider chain with primary provider:
- `runoi_yolo_crnn` (YOLOv8 detector + CRNN PyTorch OCR + OpenCV preprocessing).
- fallback provider remains enabled for resilience when models/dependencies are unavailable.

Attribution: **ANPR provider adapted from Runoi/ANPR-System, MIT License**.
