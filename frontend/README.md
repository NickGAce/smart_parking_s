# Smart Parking Frontend (SPA)

Frontend приложение для интеллектуальной системы управления парковочными местами.

## Stack
- React + TypeScript + Vite
- React Router
- TanStack Query
- Axios
- Material UI

## Требования окружения
- Node.js `18.18+` (рекомендуется LTS 20+)

## Запуск
1. Установить зависимости:
   ```bash
   npm install
   ```
2. Запустить dev-сервер:
   ```bash
   npm run dev
   ```
3. Backend должен быть доступен на `http://localhost:8000`.

## Переменные окружения
- `VITE_API_BASE_URL` (по умолчанию: `/api/v1`)

## Архитектура
- `src/app` — providers, маршрутизация.
- `src/shared` — конфиг, API-клиент, типы, общие UI-компоненты.
- `src/entities` — доступ к API по доменным сущностям.
- `src/features` — реактовые хуки и прикладная логика по сценариям.
- `src/pages` — экранные компоненты.
- `src/widgets` — составные блоки интерфейса.
