# Frontend Audit — Smart Parking SPA

Дата аудита: 2026-04-17

## Scope and inputs

Проверены:
- исходники SPA в `frontend/src`
- frontend docs (`frontend/docs/frontend_architecture.md`, `frontend/docs/integration_notes.md`)
- backend handoff docs:
  - `docs/API_FOR_FRONTEND.md`
  - `docs/BACKEND_AUDIT.md`
  - `docs/DOMAIN_REFERENCE.md`
  - `docs/FRONTEND_READY_GAPS.md`
  - `docs/SCREEN_TO_API_MAPPING.md`

## Strengths

- Хорошая модульная структура по слоям (`entities` → `features` → `pages`/`widgets` → `app`), что облегчает сопровождение.
- Используется React Query с понятными query key фабриками в доменах, есть явная работа с пагинацией и фильтрами.
- Присутствует общий HTTP client и централизованный адаптер ошибок (`shared/api/http-client.ts`, `shared/api/error-adapter.ts`).
- UI-состояния в большинстве экранов покрыты: loading/error/empty, есть reusable-компоненты (`PageState`, `ErrorState`, `LoadingState`, `ApiErrorAlert`).
- В booking/parking сценариях фронтенд учитывает специфику backend контрактов (`effective_status`, lifecycle operations, full-replace rules через `PUT`).

## Risks

- **Role logic была размазана** по страницам и фичам (повторяющиеся массивы ролей, ad-hoc проверки `role === 'admin' || ...`).
- **Слабое место в обработке ошибок**: `adaptApiError` не распознавал уже-адаптированную ошибку, из-за чего часть UI (например `admin-users`) могла терять детализацию ошибок.
- **Хрупкие query refresh-паттерны**: после lifecycle-операций использовались и `invalidateQueries`, и `refetchQueries` на те же ключи, что дублировало сетевую нагрузку.
- **Типобезопасность query-парсинга** в `parking-spots-page` опиралась на прямые касты `as ...`, что могло пропускать некорректные значения из URL.
- **Frontend contract drift risk**: повторяющиеся локальные role-константы и условия повышали риск рассинхронизации с backend domain.

## Tech debt

- Нет единого capability-layer (frontend вынужден выводить возможности из роли, что уже отмечено в `docs/FRONTEND_READY_GAPS.md`).
- Нет централизованного runtime-validation для API ответов (zod/io-ts), поэтому защита от schema drift ограничена TypeScript compile-time.
- В SPA пока отсутствует code-splitting по крупным разделам: build warning по large chunk подтверждает риск деградации UX при росте функционала.
- Локально остаются места с ручной логикой маппинга backend ошибок по статусам (например в booking flow), стоит унифицировать.

## Что исправлено в рамках аудита

1. **Централизована role logic**
   - Добавлен `shared/config/roles.ts` с наборами ролей и `hasRole` helper.
   - Мигрированы ключевые места с дублированием ролей:
     - маршрутизация,
     - parking-lot/parking-spot management checks,
     - analytics anomaly filter gating,
     - booking actions,
     - role options в админских/parking forms.

2. **Улучшена устойчивость error handling**
   - `adaptApiError` теперь корректно распознаёт и возвращает уже-нормализованные `ApiError`, избегая повторной деградации ошибки до `unknown_error`.

3. **Снижена хрупкость query refresh после lifecycle-операций**
   - Удалён дублирующий ручной `refetchQueries` после `invalidateQueries` в bookings hooks.
   - Это уменьшает лишние сетевые запросы при check-in/check-out/no-show/cancel операциях.

4. **Усилена типобезопасность URL query parsing в parking-spots**
   - Добавлен runtime-safe enum parser вместо небезопасных `as` кастов для полей `spot_type`, `vehicle_type`, `size_category`, `status`, `sort_by`, `sort_order`.

5. **Приведён в порядок lint baseline**
   - Исправлены предупреждения, из-за которых `npm run lint` падал при `--max-warnings=0`.

## Recommended next steps

### Short term (1-2 спринта)
- Вынести унифицированные UX-контракты ошибок (form/global/toast) в один shared слой, чтобы убрать точечные status-based ветки.
- Добавить schema-level runtime validation хотя бы на критических endpoint’ах (`/me`, `/bookings`, `/parking_spots`, analytics).
- Внедрить code-splitting по route-level для тяжёлых страниц (analytics, booking management).

### Mid term
- Перейти от role-only gating к capability-based UI policy, когда backend добавит `GET /me/capabilities` (или аналог).
- Нормализовать query invalidation policy по доменам (точечные key scopes + optimistic update там, где это безопасно).
- Добавить e2e smoke сценарии для критических screen-to-api цепочек:
  - login/bootstrap,
  - create booking (manual/auto),
  - lifecycle ops,
  - parking spot CRUD.

### Long term
- Подготовить фронтенд к realtime/near-realtime обновлениям (SSE/WebSocket) для inbox/lifecycle экранов.
- Сформировать reference-data consumption strategy после появления backend reference endpoint.
