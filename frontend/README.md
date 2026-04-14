# Smart Parking Frontend (Stage 1)

Базовый каркас SPA на **React + TypeScript + Vite** для дальнейшей разработки экранов Smart Parking.

## Что настроено
- React Router (`RouterProvider`) с базовым роутером.
- TanStack Query (`QueryClientProvider`).
- Глобальная тема Material UI (`ThemeProvider` + `CssBaseline`).
- Axios instance с базовым URL API (`/api/v1`) и заголовком `X-Timezone`.
- Архитектурная структура каталогов под entities/features/widgets/pages.

## Структура
- `src/app` — корневой слой приложения (layout, роутер, providers).
- `src/shared` — общая инфраструктура (`api`, `config`, `types`, `ui`).
- `src/entities` — доступ к API по доменным сущностям.
- `src/features` — сценарные хуки/логика.
- `src/widgets` — составные UI-блоки.
- `src/pages` — страницы приложения.

## Переменные окружения
Скопируй пример и при необходимости измени URL API:

```bash
cp .env.example .env
```

- `VITE_API_BASE_URL` (по умолчанию: `/api/v1`)

## Локальный запуск
```bash
npm install
npm run dev
```

По умолчанию dev-сервер Vite: `http://localhost:5173`.

## Взаимодействие с backend
В `vite.config.ts` включен proxy:
- `/api/*` -> `http://localhost:8000`

Это позволяет вызывать backend из frontend без CORS-настроек в режиме разработки.
