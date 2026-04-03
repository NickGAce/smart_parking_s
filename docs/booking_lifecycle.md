# Booking lifecycle state machine

## States
- `pending` — booking draft/awaiting confirmation.
- `confirmed` — reserved slot for the selected interval.
- `active` — booking is currently in progress.
- `completed` — active booking ended successfully.
- `cancelled` — booking was cancelled by user/admin.
- `expired` — pending booking was never confirmed before start/end.
- `no_show` — confirmed booking reached end time without activation.

## Allowed transitions
| From | To |
|---|---|
| pending | confirmed, cancelled, expired |
| confirmed | active, completed, cancelled, expired, no_show |
| active | completed, cancelled |
| completed | *(terminal)* |
| cancelled | *(terminal)* |
| expired | *(terminal)* |
| no_show | *(terminal)* |

## Server-driven automatic transitions
- `active -> completed` when `end_time <= now`.
- `confirmed -> no_show` when `start_time + no_show_grace_minutes <= now` and booking never checked in.
- `pending -> expired` when `start_time <= now`.

All transitions are computed from **server UTC time**, not from client device time headers.

## Operational actions (check-in/check-out/no-show)
- `POST /api/v1/bookings/{booking_id}/check-in`
  - Roles: booking owner, `guard`, `admin`.
  - Preconditions: status is `confirmed` and current server time is in `[start_time - check_in_open_before_minutes, start_time + no_show_grace_minutes)` and `< end_time`.
  - Effect: `confirmed -> active`.
- `POST /api/v1/bookings/{booking_id}/check-out`
  - Roles: booking owner, `guard`, `admin`.
  - Preconditions: status is `active`.
  - Effect: `active -> completed`.
- `POST /api/v1/bookings/{booking_id}/mark-no-show`
  - Roles: booking owner, `guard`, `admin`.
  - Preconditions: status is `confirmed` and server time is `>= start_time + no_show_grace_minutes`.
  - Effect: `confirmed -> no_show`.

## API changes
- `GET /api/v1/bookings` now supports `statuses` query param (multi-value):
  - Example: `?statuses=confirmed&statuses=active`
  - Legacy single `status` is kept for backwards compatibility.
- `PATCH /api/v1/bookings/{booking_id}` applies explicit transition validation.
- `DELETE /api/v1/bookings/{booking_id}` reuses transition validator (`* -> cancelled` where allowed).
- `POST /api/v1/bookings` chooses initial lifecycle status from server time.
- Added configuration params:
  - `check_in_open_before_minutes` (default: `15`)
  - `no_show_grace_minutes` (default: `30`)
