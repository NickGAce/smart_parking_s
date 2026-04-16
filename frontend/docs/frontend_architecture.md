# Frontend architecture (demo/prototype stage)

## Layered structure

Frontend follows a lightweight layered structure:

- `src/app` — app bootstrap, providers, router, layout shell.
- `src/shared` — cross-cutting infrastructure (`api`, `config`, `types`, reusable `ui`).
- `src/entities` — thin API clients by domain entity (parking, bookings, notifications, analytics, etc.).
- `src/features` — business actions and orchestration hooks (queries/mutations + screen-level logic).
- `src/widgets` — composite reusable blocks (app shell, analytics sections).
- `src/pages` — route entry points with page composition and minimal glue code.

This keeps API calls in `entities`, state orchestration in `features`, and presentation mostly in `widgets/pages`.

## Core modules

- **Auth module**
  - `app/providers/auth-provider.tsx`
  - `features/auth/*`
  - handles login/register/logout, user session hydration, token lifecycle.
- **Routing + guards**
  - `app/router/app-router.tsx`, `route-config.ts`, `route-guards.tsx`, `role-routes.ts`
  - route metadata (title/menu/roles), protected routing, role-based access.
- **Parking domain**
  - lots, spots, rules editor and details pages.
- **Bookings domain**
  - create booking, my bookings, guard/ops management flows.
- **Notifications**
  - inbox + mark-as-read + unread badge polling.
- **Analytics**
  - multi-section dashboard aggregated from several backend endpoints.

## API integration model

- HTTP transport is centralized in `shared/api/http-client.ts` (Axios instance).
- API base URL and runtime config are read from `shared/config/env.ts`.
- Query strings and pagination helpers are in `shared/api/*` utilities.
- Errors are normalized through `shared/api/error-adapter.ts` and mapped into user-friendly messages in features.
- Domain API clients live under `entities/*/api.ts` and are intentionally thin.

## State and async model

- TanStack Query is used for remote state.
- Query keys are colocated near features (`features/*/query-keys.ts`) where present.
- Mutations invalidate relevant query trees; critical booking operations additionally refetch active queries to avoid stale operational UI.
- Loading/error/empty states are rendered via shared UI primitives (`LoadingState`, `PageState`, `ApiErrorAlert`, etc.).

## Auth flow

1. User authenticates via `/login` or `/register`.
2. Tokens are persisted in `shared/api/token-storage.ts`.
3. `AuthProvider` restores session on app start and fetches current user profile.
4. Guards:
   - `RequireAuth` blocks protected routes for anonymous users.
   - `PublicOnlyRoute` redirects authenticated users away from auth screens.
   - `RequireRole` validates route role matrix and redirects forbidden users to their role default route.

## Routing model

- Single source of route metadata: `app/router/route-config.ts`.
- `AppShell` builds side menu and page header from route metadata.
- Breadcrumbs and page titles are driven by route config for consistency.
- Role defaults are configured in `app/router/role-routes.ts`.

## UI consistency approach

At demo stage, style consistency is achieved by:

- shared page chrome in `AppShell` + `PageHeader`;
- reusable status chips (`StatusChip`), filters container (`FiltersToolbar`), and pagination control (`PaginationControls`);
- reusable error/confirm patterns (`ApiErrorAlert`, `ConfirmDialog`);
- MUI primitives with consistent spacing (`Stack`/`Paper`, mostly `spacing={2}` and `p={2}`).
