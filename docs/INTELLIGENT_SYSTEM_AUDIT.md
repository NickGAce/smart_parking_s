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
   - Trigger: elevated no-show rate (15%+).
   - Action: reduce grace period and enable auto-cancel.

3. **cancellation**
   - Trigger: cancellation rate elevated and recent-half cancellations > previous-half cancellations.
   - Action: adjust booking policy (late-cancel penalties, warning windows, limits).

4. **underutilization**
   - Trigger: one zone has persistently low occupancy (<=25%).
   - Action: repurpose zone as overflow.

5. **zone_imbalance**
   - Trigger: high spread between max/min zone occupancy (40pp+) with overloaded zone.
   - Action: rebalance routing/quotas between zones.

6. **rule_change**
   - Trigger: anomaly signal for frequent cancellations.
   - Action: tighten policy for repeated violators and late cancellation behavior.

7. **security**
   - Trigger: many unknown-plate ANPR audit events in period.
   - Action: strengthen access control and guard escalation flow.

### RBAC
- `admin`: sees recommendations across all lots.
- `owner`: sees only own parking lots.
- `tenant`: no access (`403`).

## Anomaly explainability module (2026-04-27)

### Extended anomaly payload
`GET /api/v1/analytics/anomalies` now returns enriched anomaly context:
- `explanation` (что произошло)
- `impact` (почему это важно)
- `recommended_action` (что сделать)
- `related_metric` (метрика-источник)
- `severity_reason` (почему выбран этот уровень severity)

All fields are additive/optional in schema for backward compatibility.

### Action mapping catalog

| Anomaly type | Trigger context | Recommended action |
|---|---|---|
| `user.frequent_no_show` | High no-show rate for user | Сократить grace period / включить напоминания |
| `user.frequent_cancellations` | High cancellation rate for user | Пересмотреть правила отмены |
| `parking.occupancy_spike` | Sudden booking spike vs baseline | Включить overflow-зону или ограничить гостевые бронирования |
| `security.suspicious_access_events` | Suspicious ANPR/unknown plate events | Проверить неизвестные номера |
| `booking.unusual_duration` | Booking duration significantly above baseline | Проверить max duration rules |

### Frontend behavior
- Compact anomaly mode is used on Dashboard for quick triage.
- Detailed mode is used in Analytics page cards.
- Detail modal exposes three explainability sections:
  1. **Что произошло**
  2. **Почему это важно**
  3. **Что сделать**

### Additional anomaly detectors
- `security.suspicious_access_events`: counts unknown-plate ANPR signals in audit logs.
- `booking.unusual_duration`: detects significant growth of average booking duration vs baseline window.
