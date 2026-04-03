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
- `confirmed -> active` when `start_time <= now < end_time`.
- `active -> completed` when `end_time <= now`.
- `confirmed -> no_show` when `end_time <= now` and booking never became active.
- `pending -> expired` when `start_time <= now`.

All transitions are computed from **server UTC time**, not from client device time headers.

## API changes
- `GET /api/v1/bookings` now supports `statuses` query param (multi-value):
  - Example: `?statuses=confirmed&statuses=active`
  - Legacy single `status` is kept for backwards compatibility.
- `PATCH /api/v1/bookings/{booking_id}` applies explicit transition validation.
- `DELETE /api/v1/bookings/{booking_id}` reuses transition validator (`* -> cancelled` where allowed).
- `POST /api/v1/bookings` chooses initial lifecycle status from server time.
