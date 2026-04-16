# Frontend integration notes (demo/prototype)

Документ фиксирует **реальные ограничения backend**, которые напрямую влияют на frontend-реализацию.

## 1) Нет reference-data endpoint

Backend не предоставляет единый endpoint для справочников (role labels, status dictionaries, enum metadata, доступные transitions, и т.д.).

Последствия для frontend:

- часть справочных значений хранится в клиентских маппингах/константах;
- возможна рассинхронизация display-labels при изменениях backend перечислений;
- нет централизованной «feature discoverability» для новых enum значений.

Рекомендация backend: добавить `GET /reference-data` (или набор специализированных reference endpoints).

## 2) Нет standardized error envelope

Ошибки приходят в неоднородном виде (разные структуры `detail`/validation payload между endpoint'ами).

Последствия:

- frontend вынужден делать адаптацию ошибок и fallback-парсинг;
- одинаковые сценарии ошибок отображаются не полностью унифицированно;
- повышается риск потерять полезный контекст в UI.

Рекомендация backend: унифицировать error envelope (код, message, details, trace/request id).

## 3) Нет capabilities endpoint

Нет endpoint, который бы отдавал матрицу возможностей текущего пользователя/роли на уровне действий.

Последствия:

- frontend опирается на статическую route-role матрицу и локальные guard-правила;
- сложнее безопасно и прозрачно скрывать/показывать action-level controls;
- любое изменение role policy требует manual sync в SPA.

Рекомендация backend: добавить `GET /auth/capabilities` (или эквивалент) с явным action matrix.

## 4) Implicit lifecycle side effects на read endpoint'ах

Логика lifecycle бронирований может «догоняться» при чтении (read-triggered sync semantics).

Последствия:

- некоторые чтения фактически изменяют видимое состояние данных;
- frontend для критичных экранов использует более агрессивную invalidation/refetch стратегию;
- нужен аккуратный UX-текст, чтобы объяснять «почему статус мог смениться после refresh/read».

Рекомендация backend: либо документировать side effects формально, либо вынести синхронизацию в явный async pipeline.

## 5) Роль `uk` недодокументирована

По роли `uk` нет полного и стабильного permission matrix в backend-документации.

Текущее frontend-решение:

- роль считается restricted;
- дефолтный маршрут: `/dashboard`;
- при попытке открыть недоступный protected route — редирект на role default route.

Требуется backend-уточнение: конечная матрица прав и ожидаемые бизнес-сценарии для `uk`.

## 6) Нет realtime notifications

Inbox работает через polling (TanStack Query `refetchInterval`) и `refetchOnWindowFocus`.

Последствия:

- новые уведомления приходят с задержкой до интервала polling;
- нет push-UX для критичных событий.

Рекомендация backend: WebSocket/SSE канал для near-realtime обновлений.

## 7) Частично chatty API для аналитики

Dashboard собирается из нескольких endpoint'ов, единого aggregated endpoint нет.

Последствия:

- несколько параллельных запросов на загрузку одного экрана;
- больше edge-cases по loading/error partial states.

Рекомендация backend: агрегированный endpoint (или BFF-style aggregation).

## 8) Admin users ограничены отсутствием list endpoint

Есть создание и изменение роли, но нет получения каталога пользователей.

Последствия:

- экран admin users не может предоставить полноценный user directory;
- update role работает только по known `user_id`.

Рекомендация backend: `GET /admin/users` с фильтрами/пагинацией.
