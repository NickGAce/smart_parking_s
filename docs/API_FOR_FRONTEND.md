# API FOR FRONTEND (SPA handoff)

This document maps **implemented** API behavior to frontend integration tasks.
Base URL: `/api/v1`
Auth: `Authorization: Bearer <token>`.
Optional time headers in booking/spot flows: `X-Timezone`, `X-Device-Time`.

---

## 1) System / identity

### GET `/health`
- Purpose: liveness probe.
- Auth: no.
- Response: `{ "status": "ok" }`.

### GET `/me`
- Purpose: current authenticated user snapshot.
- Auth: yes.
- Response: `{ id, email, role }`.
- Use in frontend: app bootstrap (session restoration, role routing).

### GET `/admin-only`
- Purpose: simple RBAC check endpoint.
- Auth: admin only.

---

## 2) Auth

### POST `/auth/register`
- Body: `UserCreate` (`email`, `password`)
- Creates user with role `owner`.
- Responses:
  - `201` user payload
  - `409` duplicate email
  - `422` validation

### POST `/auth/login`
- Form body (`application/x-www-form-urlencoded`): `username`, `password`.
- Response: `Token` (`access_token`, `token_type`)
- Errors: `401` incorrect credentials.

Frontend note:
- Login uses OAuth2 form encoding, not JSON.

---

## 3) Admin users

### POST `/admin/users`
- Auth: admin.
- Body: `AdminUserCreate` (`email`, `password`, `role`).
- Returns: `UserOut`.
- Errors: `409` duplicate, `403` non-admin.

### PATCH `/admin/users/{user_id}`
- Auth: admin.
- Body: `UserRoleUpdate`.
- Returns updated `UserOut`.
- Errors: `404` user not found.

---

## 4) Parking lots + rules

### POST `/parking`
- Auth: admin/owner.
- Creates lot with policy fields (`access_mode`, allowed roles, booking windows).

### GET `/parking`
- Auth: any authenticated.
- Query: `limit`, `offset`, `sort_by`, `sort_order`.
- Role scoping: owners only see own lots.
- Returns paginated list.

### GET `/parking/{parking_lot_id}`
- Auth: yes.
- Owner cannot read чужой lot.

### PATCH `/parking/{parking_lot_id}`
- Auth: admin/owner, with ownership check.

### DELETE `/parking/{parking_lot_id}`
- Auth: admin/owner, with ownership check.

### GET `/parking/{parking_lot_id}/rules`
- Auth: yes.
- Returns booking/access policy + working hours + exceptions.

### PUT `/parking/{parking_lot_id}/rules`
- Auth: admin/owner.
- Replaces full rule set.

Frontend note:
- Rules are full-replace semantics on `PUT`, not partial patch.

---

## 5) Parking spots

### POST `/parking_spots`
- Auth: admin/owner.
- Body supports rich domain fields and backward-compat `type` alias.
- Can auto-create zone if `zone_name` provided and no existing zone.

### GET `/parking_spots`
- Auth: yes.
- Filters: `from`, `to`, `spot_type`, `vehicle_type`, `size_category`, `has_charger`, `zone_id`, `zone_name`, `parking_lot_id`, `status`.
- Pagination/sort: `limit`, `offset`, `sort_by`, `sort_order`.
- Returns `status` + computed `effective_status`.

### GET `/parking_spots/{parking_spot_id}`
- Auth: yes.
- Owner visibility restrictions apply.

### PATCH `/parking_spots/{parking_spot_id}`
- Auth: admin/owner.
- Supports moving spot between lots with ownership checks.

### DELETE `/parking_spots/{parking_spot_id}`
- Auth: admin/owner.

Frontend note:
- `effective_status` should drive availability UI.
- `status` alone may be stale vs booking overlap semantics.

---

## 6) Bookings + lifecycle operations

### POST `/bookings`
- Auth: yes.
- Two modes:
  1) manual: explicit `parking_spot_id`
  2) auto: `auto_assign=true` + `parking_lot_id` + optional recommendation config.
- Validates overlap, lot rules, role constraints, blocked spots.
- Returns `BookingOut` + assignment metadata and optional `decision_report` when auto-assign is used.
- Typical errors: `400` validation/rules, `403` access, `409` overlaps/no candidate.

### GET `/bookings`
- Auth: yes.
- Filters: `mine`, `parking_lot_id`, `parking_spot_id`, `from`, `to`, `status`, `statuses[]`.
- Pagination/sort available.
- Role visibility:
  - admin: all,
  - others: own bookings + owned spot bookings unless `mine=true`.

### GET `/bookings/{booking_id}`
- Auth: yes.
- Visibility check by admin/booking owner/spot owner.

### PATCH `/bookings/{booking_id}`
- Auth: booking owner/admin.
- Supports changing times/type/status.
- Non-admin can only set `cancelled` when editing status.
- Transition rules enforced.

### DELETE `/bookings/{booking_id}`
- Auth: booking owner/admin.
- Soft cancel through status transition.

### POST `/bookings/{booking_id}/check-in`
- Auth: booking owner OR guard OR admin.
- Preconditions: confirmed + check-in window opened + not too late.

### POST `/bookings/{booking_id}/check-out`
- Auth: booking owner OR guard OR admin.
- Preconditions: booking is active.

### POST `/bookings/{booking_id}/mark-no-show`
- Auth: booking owner OR guard OR admin.
- Preconditions: confirmed and grace period elapsed.

Frontend note:
- Lifecycle can change due to background sync and endpoint-triggered sync; always refresh after operations.

---

## 7) Notifications

### GET `/notifications`
- Auth: yes.
- Own notifications only.
- Filter by `status` (`unread`/`read`), with pagination.

### PATCH `/notifications/{notification_id}/read`
- Auth: yes.
- Marks only own notification as read.

---

## 8) Audit logs

### GET `/audit-logs`
- Auth: admin only.
- Filters: actor/action/entity/time range + pagination.

---

## 9) Recommendations

### POST `/recommendations/spots`
- Auth: yes.
- Body: interval + lot + optional filters/preferences/weights.
- Returns ranked spots + explainability factors.
- `weights` задаются пользователем как относительная значимость факторов (0..1) и нормализуются на backend.
- `preferences.prefer_charger=true` теперь при наличии доступных мест с зарядкой отсекает варианты без зарядки (как rejected by `charger_preference`).

Frontend note:
- `/recommendations/spots` now can include `decision_report` (toggle by `include_decision_report`).
- Great for “Why this spot?” UI blocks.

### POST `/recommendations/decision-report`
- Auth: yes.
- Body: same as `/recommendations/spots`.
- Returns only structured `DecisionReport` for best candidate.
- Returns `404` when no candidate exists for the constraints.

Decision report structure:
- `selected_spot_id`, `selected_spot_label`, `final_score`, `confidence`, `generated_at`
- `selected_candidate`: spot id/label/score snapshot
- `factors[]`: `name`, `weight`, `raw_value`, `contribution`, `explanation`
- `hard_constraints_passed[]`: each hard constraint with pass flag and explanation
- `rejected_candidates[]`: rejected `spot_id`, `reason`, `constraint`

Scoring formula:
- `final_score = Σ(raw_factor_value * factor_weight)`
- `confidence = (top_score - second_score) / max(top_score, 0.0001)` limited to `[0,1]`


---

## 10) Analytics + anomalies

### GET `/analytics/summary`
- KPI: occupancy %, bookings count, avg duration, cancel/no-show rates.

### GET `/analytics/occupancy`
- Occupancy + breakdown by zone and spot type + peak hours.

### GET `/analytics/bookings`
- Booking metrics + status breakdown.

### GET `/analytics/occupancy-forecast`
- Explainable forecast buckets for target date/range.

### GET `/analytics/forecast-quality`
- Назначение: оценка качества прогноза загрузки на историческом периоде (backtesting).
- Query:
  - `parking_lot_id` (optional)
  - `date_from` (required, ISO datetime)
  - `date_to` (required, ISO datetime)
  - `bucket` (optional): `hour|day`, default `hour`
- Auth/RBAC:
  - `admin` / `owner` — доступ разрешен.
  - прочие роли — `403`.
- Response:
  - `mae` — Mean Absolute Error (в процентных пунктах загрузки).
  - `mape` — Mean Absolute Percentage Error (в процентах относительно факта; нулевые фактические точки исключаются из MAPE).
  - `rmse` — Root Mean Squared Error (optional).
  - `sample_size` — число оцененных бакетов.
  - `confidence` — `low|medium|high`.
  - `explanation` — текстовое пояснение надежности.
  - `evaluated_period` — фактический интервал и тип бакета.
  - `comparison_series[]` — ряд для визуализации факт vs прогноз:
    - `time_bucket`
    - `actual_occupancy_percent`
    - `predicted_occupancy_percent`
    - `absolute_error`

Формулы:
- `MAE = (1/n) * Σ |y_true - y_pred|`
- `MAPE = (100%/k) * Σ (|y_true - y_pred| / |y_true|)`, где суммирование по точкам с `y_true > 0`, `k` — число таких точек.
- `RMSE = sqrt((1/n) * Σ (y_true - y_pred)^2)`

### GET `/analytics/anomalies`
- Объяснимые аномалии с уровнем критичности, причиной и связанным объектом.
- Обратная совместимость сохранена: исторические поля не изменены, новые поля объяснимости в схеме optional.
- Для ролей без расширенных прав применяется ограничение по области видимости пользователя.

Поля элемента аномалии (расширение):
- `anomaly_type`, `severity`, `reason`, `related_entity`, `metrics`
- `explanation` — что произошло
- `impact` — почему это важно
- `recommended_action` — что рекомендуется сделать
- `related_metric` — ключевая метрика, связанная с аномалией
- `severity_reason` — почему выбран уровень `medium/high`

Матрица действий (`anomaly_type` -> `recommended_action`):

| Anomaly type | Recommended action |
|---|---|
| `user.frequent_no_show` (high) | Сократить период ожидания подтверждения прибытия и включить автоматические напоминания. |
| `user.frequent_cancellations` (high) | Пересмотреть правила отмены. |
| `parking.occupancy_spike` | Включить резервную зону или ограничить гостевые бронирования. |
| `security.suspicious_access_events` | Проверить неизвестные номера. |
| `booking.unusual_duration` | Проверить ограничения по максимальной длительности бронирования. |

### GET `/analytics/management-recommendations`
- Назначение: управленческие рекомендации по корректировке правил, зонирования, бронирований и контроля доступа.
- Query:
  - `parking_lot_id` (optional)
  - `date_from` (required, ISO datetime)
  - `date_to` (required, ISO datetime)
  - `severity` (optional): `low|medium|high|critical`
- Auth/RBAC:
  - `admin` — все парковки.
  - `owner` — только свои парковки (при чужом `parking_lot_id` вернется пустой набор).
  - `tenant`/прочие роли — `403`.
- Response item:
  - `id`
  - `type`: `overload|no_show|cancellation|underutilization|zone_imbalance|rule_change|security`
  - `severity`: `low|medium|high|critical`
  - `title`, `description`
  - `recommended_action`
  - `metric_source`
  - `evidence`
  - `expected_effect`
  - `created_at`
- Источники данных: существующие analytics/anomalies + audit events (ANPR unknown plate).

---

## 11) Common response patterns
- List endpoints generally use:
  - `items: []`
  - `meta: { limit, offset, total }`
- Validation errors use FastAPI default 422 shape.
- Business/RBAC errors mostly use `{ detail: "..." }` with 400/403/404/409.

---

## 12) Frontend integration gotchas
1. Login form encoding differs from JSON APIs.
2. Time normalization matters; send `X-Timezone` consistently.
3. Spot availability should rely on `effective_status`.
4. Lifecycle states can shift between calls due to sync.
5. No unified reference endpoint for enums/capabilities (frontend may mirror constants for now).

---

## 13) Full endpoint registry (method/path/auth/roles)

| Method | Path | Auth | Roles (effective) | Notes |
|---|---|---|---|---|
| GET | `/health` | no | public | health check |
| GET | `/me` | yes | any authenticated | current user |
| GET | `/admin-only` | yes | admin | RBAC sample |
| POST | `/auth/register` | no | public | creates owner |
| POST | `/auth/login` | no | public | OAuth2 form login |
| POST | `/admin/users` | yes | admin | create user with role |
| PATCH | `/admin/users/{user_id}` | yes | admin | update role |
| POST | `/parking` | yes | admin/owner | create lot |
| GET | `/parking` | yes | auth | owner sees own lots only |
| GET | `/parking/{parking_lot_id}` | yes | auth | owner scope check |
| PATCH | `/parking/{parking_lot_id}` | yes | admin/owner | owner scope check |
| GET | `/parking/{parking_lot_id}/rules` | yes | auth | owner scope check |
| PUT | `/parking/{parking_lot_id}/rules` | yes | admin/owner | full replace rules |
| DELETE | `/parking/{parking_lot_id}` | yes | admin/owner | owner scope check |
| POST | `/parking_spots` | yes | admin/owner | create spot |
| GET | `/parking_spots` | yes | auth | rich filters + effective status |
| GET | `/parking_spots/{parking_spot_id}` | yes | auth | owner scope check |
| PATCH | `/parking_spots/{parking_spot_id}` | yes | admin/owner | update/move spot |
| DELETE | `/parking_spots/{parking_spot_id}` | yes | admin/owner | delete spot |
| POST | `/bookings` | yes | auth | manual/auto-assign modes |
| GET | `/bookings` | yes | auth | role-scoped visibility |
| GET | `/bookings/{booking_id}` | yes | auth | scoped visibility |
| PATCH | `/bookings/{booking_id}` | yes | owner/admin | status transition rules |
| DELETE | `/bookings/{booking_id}` | yes | owner/admin | soft cancel |
| POST | `/bookings/{booking_id}/check-in` | yes | owner/guard/admin | status/time window checks |
| POST | `/bookings/{booking_id}/check-out` | yes | owner/guard/admin | active only |
| POST | `/bookings/{booking_id}/mark-no-show` | yes | owner/guard/admin | grace window rule |
| GET | `/notifications` | yes | auth | own inbox |
| PATCH | `/notifications/{notification_id}/read` | yes | auth | own notification only |
| GET | `/audit-logs` | yes | admin | paginated filters |
| POST | `/recommendations/spots` | yes | auth | ranked explainable list + optional decision report |
| POST | `/recommendations/decision-report` | yes | auth | structured explainable report only |
| GET | `/analytics/summary` | yes | auth | KPI summary |
| GET | `/analytics/occupancy` | yes | auth | occupancy breakdown |
| GET | `/analytics/bookings` | yes | auth | booking KPI breakdown |
| GET | `/analytics/occupancy-forecast` | yes | auth | explainable forecast |
| GET | `/analytics/forecast-quality` | yes | admin/owner | forecast quality metrics |
| GET | `/analytics/anomalies` | yes | auth | scoped anomaly visibility |
| GET | `/analytics/management-recommendations` | yes | admin/owner | intelligent management actions |

## ANPR / Контроль доступа

### Новые endpoint'ы
- `POST /api/v1/access-events/recognize` — mock-распознавание номера по `image_token`/`plate_number_hint`.
- `POST /api/v1/access-events/manual` — ручная фиксация события доступа.
- `GET /api/v1/access-events` — список событий с фильтрами `parking_lot_id`, `plate_number`, `decision`, `direction`, `date_from`, `date_to`.
- `GET /api/v1/access-events/{id}` — детали события.

### Ответ события
Событие содержит: `decision` (`allowed|review|denied`), `reason`, связи на `booking_id`, `parking_spot_id`, `user_id`, а также `recognition_confidence` и `recognition_source`.

### Расширение бронирования
`Booking` теперь поддерживает необязательное поле `plate_number` для автоматического сопоставления при въезде/выезде.

## API автомобилей
- `POST /api/v1/vehicles` — создать автомобиль пользователя.
- `GET /api/v1/vehicles` — список автомобилей (admin видит все, пользователь — свои).
- `PATCH /api/v1/vehicles/{id}` — обновить автомобиль.
- `DELETE /api/v1/vehicles/{id}` — удалить автомобиль.

## API загрузки в ANPR-конвейер
- `POST /api/v1/access-events/recognize/image` (multipart/form-data): `file`, `parking_lot_id`, `direction`, необязательный `plate_hint`.
- `POST /api/v1/access-events/recognize/video` (multipart/form-data): `file`, `parking_lot_id`, `direction`, необязательный `plate_hint`.

## Медиа-поля события доступа
`access-event` ответ теперь дополнительно содержит:
- `vehicle_id`
- `image_url`
- `video_url`
- `frame_timestamp`
- `processing_status` (`pending|processed|failed`)

---

## 11) Access events image/video diagnostics

### POST `/access-events/recognize/image`
### POST `/access-events/recognize/video`
- Content-Type: `multipart/form-data`
- Fields:
  - `file` (required)
  - `parking_lot_id` (required)
  - `direction` (`entry|exit`)
  - `plate_hint` (optional)

Response расширен полем `diagnostics`:
- `provider`
- `raw_text`
- `candidates[]`
- `confidence`
- `bbox`
- `processing_status` (`processed|fallback`)
- `reason`
- `frame_timestamp` (для видео)
- `preprocessing_steps[]`

Frontend should show warning banner when `diagnostics.provider == "filename_fallback"`.
