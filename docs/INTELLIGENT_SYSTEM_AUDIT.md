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
