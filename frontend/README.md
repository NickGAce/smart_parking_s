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
