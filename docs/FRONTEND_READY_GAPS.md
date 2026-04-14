# FRONTEND READY GAPS (backend improvements for UI phase)

## Legend
- Priority: `critical` / `high` / `medium` / `low`

---

## 1) No reference-data endpoint for enums/roles/statuses
- Problem: frontend must hardcode roles, booking statuses, spot statuses/types, notification types.
- Impact: fragile UI constants, risk of drift after backend updates.
- Recommendation: add `GET /reference-data` with enums + labels + transition maps.
- Priority: **critical**.

## 2) No standardized error envelope with machine-readable code
- Problem: errors mostly string `detail`, inconsistent semantics across modules.
- Impact: hard to build uniform toast/form/full-page handling.
- Recommendation: adopt global format, e.g. `{ error: { code, message, fields?, context? } }`.
- Priority: **critical**.

## 3) Missing “current capabilities” endpoint
- Problem: frontend infers permissions from role only.
- Impact: cannot accurately render action availability per resource/state.
- Recommendation: `GET /me/capabilities` and/or resource-level `available_actions` fields.
- Priority: **high**.

## 4) Dashboard requires many separate API calls
- Problem: dashboard screens need summary + occupancy + bookings + notifications etc.
- Impact: chatty frontend, complex loading states.
- Recommendation: add aggregated dashboard endpoint(s), e.g. `/dashboard/summary`.
- Priority: **high**.

## 5) Lifecycle side effects on read endpoints are implicit
- Problem: list/get endpoints can mutate statuses through sync.
- Impact: difficult for optimistic caching and deterministic UI refresh logic.
- Recommendation: explicitly document side effects and optionally split into background-only mode.
- Priority: **high**.

## 6) List/detail schemas not consistently “UI-shaped”
- Problem: some entities omit relational labels/frontend-friendly computed fields.
- Impact: frontend needs extra calls/transforms.
- Recommendation: standard list-item/detail DTO strategy with stable display fields.
- Priority: **high**.

## 7) No explicit realtime channel for notifications/lifecycle updates
- Problem: only polling inbox model exists.
- Impact: stale UX for operational views (guard panel, active booking board).
- Recommendation: introduce websocket/SSE event stream or long-poll endpoint.
- Priority: **medium**.

## 8) Inconsistent discoverability of sort/filter options
- Problem: options live in code/OpenAPI but no concise reference endpoint.
- Impact: slower frontend integration and risk of invalid query composition.
- Recommendation: include allowed filters/sorts in docs or reference endpoint metadata.
- Priority: **medium**.

## 9) Lack of idempotency support for critical create operations
- Problem: retries of booking creation can duplicate requests.
- Impact: duplicate business actions under unstable network.
- Recommendation: add optional idempotency key support for POST booking.
- Priority: **medium**.

## 10) No API-level pagination cursor option
- Problem: only offset pagination.
- Impact: weaker UX/perf on very large datasets and frequent updates.
- Recommendation: keep offset for admin tables, add cursor mode where needed.
- Priority: **low**.

## 11) Sparse frontend-oriented examples in OpenAPI/docs
- Problem: request/response examples for edge cases are limited.
- Impact: longer implementation/debug cycle for frontend team.
- Recommendation: enrich OpenAPI descriptions/examples for auth, booking conflicts, lifecycle errors.
- Priority: **medium**.

## 12) Role `uk` is under-documented in UX context
- Problem: exists in enum but unclear intended flows/privileges.
- Impact: ambiguous routing and feature flags in SPA.
- Recommendation: either document role intent fully or deprecate if unused.
- Priority: **high**.
