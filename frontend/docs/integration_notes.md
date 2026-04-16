# Frontend integration notes

## Role `uk`

Backend documentation currently does not provide a complete permission matrix for role `uk`.
To keep the SPA stable and secure, `uk` is treated as a **restricted role**:

- default post-login route: `/dashboard`
- allowed navigation routes: `/dashboard`, `/notifications`
- all other protected routes redirect to role default route

When backend clarification appears, this matrix should be updated in route guards and navigation config.

## Notifications inbox (polling integration)

Notifications inbox реализован на базе:

- `GET /notifications` (list + filter + pagination)
- `PATCH /notifications/{notification_id}/read` (mark as read)

Текущая стратегия обновления:

- polling: `refetchInterval = 60_000ms`
- `refetchOnWindowFocus = true` для быстрого восстановления актуальности при возврате в таб
- polling не запускается в фоне (`refetchIntervalInBackground = false`)

Badge непрочитанных в app shell считается без отдельного endpoint через `GET /notifications?status=unread&limit=1&offset=0` и `meta.total`.

Ограничение интеграции: backend пока не предоставляет realtime-канал (WebSocket/SSE), поэтому inbox обновляется только polling-моделью.
