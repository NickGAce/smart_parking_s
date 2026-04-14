# DOMAIN REFERENCE

## 1) User roles
- `admin` — full access across tenants/lots, admin APIs, audit logs.
- `owner` — manages own parking lots/spots/rules; sees own scope.
- `tenant` — end-user booking role (subject to lot access rules).
- `guard` — operational role for lifecycle actions (check-in/check-out/no-show).
- `uk` — present in enum; currently under-documented in UX/business flows.

---

## 2) Parking lot access model

### `access_mode`
- `employees_only`
- `guests_only`
- `mixed`

### `allowed_user_roles`
- Optional allow-list at lot level.
- If non-empty, user role must be in list.

### Booking window rules (per lot)
- `min_booking_minutes`
- `max_booking_minutes`
- `booking_step_minutes`
- `max_advance_minutes`
- Working schedule:
  - weekly entries by `day_of_week`
  - date exceptions (closed/open custom window)

Key business constraints:
- Booking must stay within one date.
- Duration must satisfy min/max/step.
- Booking must fit lot working hours/exception day window.

---

## 3) Parking spot model

### Raw status (`status`)
- `available`
- `booked`
- `blocked`

### Effective status (`effective_status`)
- Computed at API layer for requested interval:
  - `blocked` if raw blocked,
  - `booked` if overlapping blocking booking exists,
  - else `available`.

### Spot classification enums
- `spot_type`: `regular`, `guest`, `disabled`, `ev`, `reserved`, `vip`
- `vehicle_type`: `car`, `bike`, `truck`
- `size_category`: `small`, `medium`, `large`

### Backward compatibility
- Legacy field `type` kept alongside `spot_type`.

---

## 4) Booking lifecycle

### Statuses
- `pending`
- `confirmed`
- `active`
- `completed`
- `cancelled`
- `expired`
- `no_show`

### Allowed transitions
- `pending -> confirmed | cancelled | expired`
- `confirmed -> active | completed | cancelled | expired | no_show`
- `active -> completed | cancelled`
- terminal: `completed`, `cancelled`, `expired`, `no_show`

### Operational actions
- Check-in: `confirmed -> active` (window-limited)
- Check-out: `active -> completed`
- Mark no-show: `confirmed -> no_show` (after grace)

### Automatic transitions
- `active -> completed` when `end_time <= now`
- `confirmed -> no_show` when grace expired
- `pending -> expired` when start reached

---

## 5) Notifications domain

### Types
- `booking_created`
- `booking_confirmed`
- `booking_cancelled`
- `booking_starts_soon`
- `booking_expired`
- `booking_no_show`
- `parking_rules_violation`

### Statuses
- `unread`
- `read`

---

## 6) Analytics and anomaly domain

### Analytics outputs
- Summary KPIs: occupancy %, count, avg duration, cancellation and no-show rates.
- Occupancy breakdown: by zone, by spot type, peak hours.
- Booking metrics: status breakdown.
- Forecast: explainable bucket predictions with confidence.

### Anomaly semantics
Implemented anomaly families include:
- user frequent cancellations
- user frequent no-show
- user last-minute pattern
- occupancy spike
- high conflict risk
- frequent spot blocking

---

## 7) Fields useful for UI vs system fields

### UI-essential
- User: `id`, `email`, `role`
- Parking lot: display + rules fields
- Spot: `spot_number`, `spot_type`, `effective_status`, `zone_name`, charger/size info
- Booking: `status`, `start_time`, `end_time`, `assignment_mode`, `assignment_explanation`
- Notification: `title`, `message`, `status`, `created_at`

### Mostly system/internal
- Audit `source_metadata`
- Spot legacy `type` (keep for compatibility but prefer `spot_type`)
- Lifecycle scheduler internals/stat counters (not exposed directly)
