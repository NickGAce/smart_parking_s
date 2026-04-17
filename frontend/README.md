# Smart Parking Frontend

Demo/prototype-ready SPA на **React + TypeScript + Vite + MUI + TanStack Query**.

## Возможности

- Аутентификация и восстановление сессии.
- Protected routing + role-based guards.
- Экраны парковок и парковочных мест (список, детали, управление по ролям).
- Booking flows: создание, мой список, management-панель.
- Notifications inbox с polling и unread badge.
- Analytics dashboard из нескольких backend endpoint'ов.
- Admin screens: users (create/update role), audit logs.

## Установка

```bash
cd frontend
npm install
```

## Запуск

### Development

```bash
npm run dev
```

По умолчанию: `http://localhost:5173`.

### Production build

```bash
npm run build
npm run preview
```

## ENV

Скопируй шаблон:

```bash
cp .env.example .env
```

Основная переменная:

- `VITE_API_BASE_URL` — базовый URL backend API (по умолчанию `/api/v1`).

## Backend proxy в dev

`vite.config.ts` содержит proxy:

- `/api/*` → `http://localhost:8000`

Это упрощает локальную интеграцию без отдельной CORS-конфигурации.

## Структура проекта

- `src/app` — bootstrap, providers, router, layout shell.
- `src/shared` — инфраструктура (`api`, `types`, `config`, reusable UI).
- `src/entities` — доменные API-клиенты.
- `src/features` — бизнес-логика и query/mutation hooks.
- `src/widgets` — составные UI-блоки.
- `src/pages` — route-level страницы.
- `docs/` — интеграционные ограничения и архитектурные заметки.

## Документация

- `docs/integration_notes.md` — backend gaps и ограничения интеграции.
- `docs/frontend_architecture.md` — архитектурная карта SPA.
- `docs/demo_scenarios.md` — готовые сценарии для дипломной демонстрации (по ролям и шагам).

## Demo-сценарии для защиты

Краткий рекомендуемый порядок показа:

1. **Auth flow**: регистрация и вход.
2. **Каталог парковок**: список парковок и детали конкретной парковки.
3. **Каталог мест**: фильтрация парковочных мест, просмотр effective/raw статусов.
4. **Создание бронирования**:
   - manual (ручной выбор места),
   - auto (рекомендации и auto_assign).
5. **Мои бронирования**: фильтры и просмотр карточки бронирования.
6. **Management + lifecycle**: check-in/check-out/no-show на operational панели.
7. **Уведомления**: inbox, unread/read, mark as read.
8. **Аналитика**: KPI + occupancy + bookings + forecast + anomalies.
9. **Admin screens**: создание пользователя, смена роли, журнал аудита.

Подробный пошаговый сценарий см. в `docs/demo_scenarios.md`.

## Какие роли лучше использовать для показа

- **admin** — основной сценарий «максимальные права»: управление, lifecycle, analytics, admin screens.
- **tenant** — пользовательский сценарий бронирования end-to-end: create booking + my bookings + notifications.
- **guard** — демонстрация operational workflow (booking management, lifecycle actions).
- **owner** (опционально) — бизнес-взгляд на управление парковками и аналитикой без админских функций пользователей.

## Ограничения demo UX из-за backend

Ключевые backend-ограничения, которые влияют на «красивую» демо-презентацию:

- нет полного `GET /admin/users` каталога пользователей (обновление роли по known user_id);
- нет realtime канала уведомлений (используется polling);
- нет capabilities endpoint (action-level UX строится на role-based правилах во frontend);
- нет единого aggregated endpoint аналитики (несколько параллельных запросов);
- нет унифицированного error envelope для всех endpoint.

См. детальный список и рекомендации: `INTEGRATION_LIMITATIONS.md` и `docs/integration_notes.md`.
