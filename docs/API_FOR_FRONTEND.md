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
- Returns `BookingOut` + assignment metadata.
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

Frontend note:
- Great for “Why this spot?” UI blocks.

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

### GET `/analytics/anomalies`
- Explainable anomaly items with severity/reason/related entity.
- User-level scope restrictions for non-admin/non-owner/non-guard.

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
| POST | `/recommendations/spots` | yes | auth | ranked explainable list |
| GET | `/analytics/summary` | yes | auth | KPI summary |
| GET | `/analytics/occupancy` | yes | auth | occupancy breakdown |
| GET | `/analytics/bookings` | yes | auth | booking KPI breakdown |
| GET | `/analytics/occupancy-forecast` | yes | auth | explainable forecast |
| GET | `/analytics/anomalies` | yes | auth | scoped anomaly visibility |
