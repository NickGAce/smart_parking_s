# SCREEN TO API MAPPING (SPA)

## 1) Login screen
- Goal: authenticate user and bootstrap session.
- APIs:
  - `POST /auth/login`
  - `GET /me`
- Data needed:
  - token, user role/profile.
- Actions:
  - sign in.
- Roles: all.
- States:
  - loading submit, invalid credentials error, success redirect.

## 2) Registration screen
- Goal: self-register owner account.
- API: `POST /auth/register`
- Actions: create account.
- States: validation errors, duplicate email conflict.

## 3) App shell / session bootstrap
- Goal: restore user from token.
- API: `GET /me`
- Actions: role-based nav composition.
- States: unauthenticated -> login route.

## 4) Parking lots list (admin/owner)
- Goal: browse and manage lots.
- API: `GET /parking`
- Data: paginated lots, owner-scope aware.
- Actions: open details, create lot.
- Roles: admin, owner (read); others may have limited read use.
- Empty/loading/error: table skeleton, empty CTA, auth/403 state.

## 5) Parking lot details + rules editor
- APIs:
  - `GET /parking/{id}`
  - `GET /parking/{id}/rules`
  - `PATCH /parking/{id}`
  - `PUT /parking/{id}/rules`
- Actions: edit lot metadata and policy.
- Roles: admin/owner by ownership constraints.
- Notes: rules `PUT` is full replacement; keep form state complete.

## 6) Parking spot catalog screen
- APIs:
  - `GET /parking_spots` (filters + pagination)
  - `POST /parking_spots`
  - `PATCH /parking_spots/{id}`
  - `DELETE /parking_spots/{id}`
- Data: list items with `effective_status`.
- Roles: read authenticated; manage admin/owner.
- States: filter-empty vs no-data, conflict errors for duplicate spot number.

## 7) Create booking modal/page
- APIs:
  - `POST /bookings` (manual mode)
  - optionally `POST /recommendations/spots` then `POST /bookings` (auto mode UX)
- Data: selected interval, spot/lot, booking type.
- Errors: overlap 409, rule violations 400, role access 403.

## 8) My bookings screen
- API: `GET /bookings?mine=true`
- Data: lifecycle status + interval + assignment metadata.
- Actions: cancel/edit where allowed.
- States: lifecycle badges and disabled actions by status.

## 9) Booking management/admin table
- API: `GET /bookings` with filters/statuses/pagination.
- Roles: admin + scoped owner views.
- Actions: inspect detail, transition via patch/ops endpoints.

## 10) Booking detail / operations panel
- APIs:
  - `GET /bookings/{id}`
  - `PATCH /bookings/{id}`
  - `DELETE /bookings/{id}`
  - `POST /bookings/{id}/check-in`
  - `POST /bookings/{id}/check-out`
  - `POST /bookings/{id}/mark-no-show`
- Roles: depends on operation and actor relation.
- States: show allowed actions by current status and role.

## 11) Notifications inbox
- APIs:
  - `GET /notifications`
  - `PATCH /notifications/{id}/read`
- Data: unread/read split, timestamps.
- States: polling refresh, empty inbox view.

## 12) Admin user management
- APIs:
  - `POST /admin/users`
  - `PATCH /admin/users/{id}`
- Roles: admin only.
- States: 403 guard, validation conflict for duplicate email.

## 13) Audit log screen (admin)
- API: `GET /audit-logs` with filters/date range.
- Roles: admin.
- States: filter-driven table, empty log.

## 14) Recommendation assistant UI
- API: `POST /recommendations/spots`
- Data: ranked spots + explainability factors.
- Actions: pick suggested spot and continue booking.

## 15) Analytics dashboard
- APIs:
  - `GET /analytics/summary`
  - `GET /analytics/occupancy`
  - `GET /analytics/bookings`
  - `GET /analytics/occupancy-forecast`
  - `GET /analytics/anomalies`
- Roles: authenticated (with anomaly visibility constraints for regular users).
- States: period filters, lot/zone filters, chart empty/error states.
