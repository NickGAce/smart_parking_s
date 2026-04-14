# BACKEND AUDIT — Smart Parking System

## Scope and method
This audit is based on actual implementation in `app/`, `alembic/`, `tests/`, and existing docs.

Reviewed areas:
- API layer (`app/api/v1/endpoints/*`, `app/api/v1/router.py`)
- Domain/data models (`app/models/*`)
- Schemas (`app/schemas/*`)
- Service layer (`app/services/*`)
- Security/auth (`app/core/security.py`, `app/api/deps.py`)
- DB/session and migrations (`app/db/*`, `alembic/versions/*`)
- Test coverage (`tests/*`)

---

## 1) Current backend architecture

### 1.1 Architectural style
- **Layered modular monolith** on FastAPI + SQLAlchemy AsyncSession.
- Layers are clear and pragmatic:
  - **Endpoints/controllers**: HTTP parsing, role checks, response composition.
  - **Services**: reusable business logic (booking lifecycle, analytics, recommendations, rules, notifications, audit).
  - **Models**: SQLAlchemy domain entities + DB constraints.
  - **Schemas**: Pydantic request/response contracts.
- Lifecycle engine has **dual mode**:
  - on-demand sync during API calls,
  - periodic scheduler (`BookingLifecycleScheduler`) in app lifespan.

### 1.2 Domain entities
Core entities already implemented:
- `User` with roles: `admin`, `owner`, `tenant`, `guard`, `uk`.
- `ParkingLot` with booking/rules policy fields.
- `ParkingZone` for zone-level segmentation and access level.
- `ParkingSpot` with domain-rich attributes (type, vehicle type, charger, size, zone).
- `Booking` with expanded lifecycle statuses.
- `Notification` inbox model.
- `AuditLog` for action traces.
- Parking rules sub-entities: `ParkingLotWorkingHour`, `ParkingLotScheduleException`.

### 1.3 Endpoint organization
- Root API prefix: `/api/v1`.
- Routers grouped by domain:
  - auth
  - admin users
  - parking lots + rules
  - parking spots
  - bookings + lifecycle actions
  - notifications
  - audit logs
  - recommendations
  - analytics (+ anomalies)

### 1.4 Business logic placement
Strong separation is already present:
- Lifecycle transition rules and time-window checks → `services/bookings.py`.
- Automatic status sync (expired/no_show/completed + spot sync) → `services/booking_lifecycle.py`.
- Parking policy validation (working hours, role access, booking duration windows) → `services/parking_rules.py`.
- Recommendation scoring and explainability → `services/recommendations.py`.
- KPI/analytics/forecast aggregation → `services/analytics.py`.
- Notification write path + dedup for starts-soon → `services/notifications.py`.
- Audit event capture helper → `services/audit.py`.

### 1.5 Auth & RBAC model
- JWT bearer auth (`OAuth2PasswordBearer`) with `sub=user_id`.
- Password hashing via passlib bcrypt.
- Role guard dependency `require_roles(...)` for endpoint-level RBAC.
- Additional contextual checks exist inside endpoint/service logic (owner scoping to own lots/spots, booking ownership constraints).

### 1.6 Transactions and consistency
- Request-scoped AsyncSession.
- Explicit commit/rollback in mutation endpoints.
- Lifecycle sync often runs before reads/mutations and commits updates.
- Audit + domain changes are usually in same transaction.
- Notification creation tied to booking actions and committed in same unit.

### 1.7 Time handling and lifecycle
- Datetime strategy: DB stores naive local wall-clock values; conversion helpers normalize client/server times.
- Supports `X-Timezone` header parsing and fixed UTC offsets.
- Lifecycle includes statuses:
  `pending`, `confirmed`, `active`, `completed`, `cancelled`, `expired`, `no_show`.
- Operational actions:
  - check-in
  - check-out
  - manual no-show
- Automatic transitions run via sync service + in-process scheduler.

---

## 2) Production-readiness assessment (technical)

### Production-ready or close
- Strong domain model and constraints in DB and code.
- Good baseline security primitives (hashed passwords, JWT, role checks).
- Booking lifecycle rules are explicit and mostly deterministic.
- Good breadth of backend capabilities already implemented:
  CRUD + operational lifecycle + analytics + anomaly detection + recommendations + notifications + audit.
- Pagination/filtering present in key list endpoints.
- Tests cover many critical modules.

### Partially ready / caution areas
- Error schema is not globally unified (different `detail` patterns, no shared error envelope with codes).
- Some role semantics are non-obvious for frontend (especially `uk` and owner-vs-admin visibility scopes).
- API lacks dedicated **reference-data endpoint** (roles/statuses/enums/capabilities).
- No realtime transport yet (notifications are inbox/polling only).
- Some response models are backend-oriented and force extra frontend joins/requests.
- Potential N+1/perf hotspots in list endpoints that compute effective statuses per spot.

---

## 3) Strengths
- Rich business domain already encoded in backend.
- Transaction-aware lifecycle updates and spot status sync.
- Explainable recommendation scoring (frontend can display factor contributions).
- Analytics layer includes summary, occupancy breakdowns, booking metrics, and forecast.
- Audit logs and notifications provide observability primitives.
- Backward compatibility retained for legacy parking spot `type` field.

## 4) Disputed areas / technical debt
- Mixed locale/comment style and occasional implicit contracts in code comments.
- Enum handling in some paths mixes string/enum objects; mostly controlled but should be standardized in responses.
- Repeated timezone helpers exist in both `bookings.py` and `booking_lifecycle.py` (duplication risk).
- Lifecycle sync is invoked in many endpoints; could become expensive under load.
- No standardized API versioning strategy beyond `/v1` path prefix.

## 5) Scaling risks
- Heavy sync-on-read behavior for lifecycle/spot status can increase DB write load.
- Recommendation and analytics queries may become expensive on large datasets without additional indexes/materialized aggregates.
- In-process scheduler is single-instance local; multi-instance deployments need distributed coordination strategy.
- Notification delivery is currently stub-like inbox channel only.

## 6) Frontend integration risks
- No single endpoint for “current capabilities/permissions” by user and context.
- Some screens will require multiple calls (list + related lot/zone + rule context).
- API error surface is predictable enough for basic UX, but lacks machine-readable error codes for robust UI branching.
- Missing explicit contracts for optimistic concurrency (e.g., ETag/version fields).

---

## 7) Test and docs consistency notes
- Tests validate most key modules (auth, admin, parking, booking lifecycle, rules, notifications, audit, analytics, anomalies, recommendations).
- Existing docs (`booking_lifecycle.md`, `occupancy_forecast.md`) are aligned with implemented features at high level.
- OpenAPI is likely useful, but frontend still needs curated screen-oriented mapping (provided in other docs in this handoff).

---

## 8) Critical inconsistencies found
1. **Role `uk` exists in enum but is not clearly represented in endpoint-level narratives and frontend flows.**
2. **No centralized reference endpoint for enums/roles/statuses**, forcing frontend to hardcode.
3. **Error handling shape lacks global standardization**, making generic UI error adapters harder.
4. **Lifecycle sync side-effects on list/read endpoints** can surprise frontend (state changes between sequential requests).

---

## 9) Overall conclusion
Backend is **functionally rich and mostly ready** for SPA frontend phase, especially for core booking workflows and admin operations. Main pre-frontend improvements should focus on integration ergonomics: reference data, consistent error contracts, dashboard aggregation endpoints, and predictable capability metadata.

---

## 10) Backend handoff scenarios for frontend

### Supported flows (fact-based)
1. **Auth bootstrap**: register/login + `/me`.
2. **Lot management**: create/list/view/update/delete lots + full rules management.
3. **Spot management**: full CRUD with filtering, sorting, pagination, interval-aware effective status.
4. **Booking flow**:
   - manual selection,
   - auto-assign using recommendation weights/preferences,
   - update/cancel,
   - operational check-in/check-out/no-show.
5. **User inbox**: notifications list + mark read.
6. **Admin control**: admin user creation/role updates, audit logs.
7. **Analytics**: summary, occupancy breakdowns, booking metrics, forecast, anomalies.

### Typical call order examples
- Booking creation (manual):
  1) `GET /parking_spots` with interval filters
  2) `POST /bookings`
  3) `GET /bookings/{id}` (or list refresh)
- Booking creation (guided):
  1) `POST /recommendations/spots`
  2) `POST /bookings` with `auto_assign=true` or explicit spot
- Guard operations:
  1) `GET /bookings` filtered by status/time
  2) `POST /bookings/{id}/check-in` or `check-out`

### Client-side state to keep
- Access token + current user role.
- Active filter state for list endpoints.
- Booking status maps and action availability UI map.
- Timezone context (send `X-Timezone` consistently).

### UI status handling guidance
- Booking badges must support all 7 statuses.
- Spot availability widgets should use `effective_status`.
- Lifecycle operation buttons must be status-gated and role-aware.

---

## 11) Frontend readiness matrix

| Area | Status | Why | Minimal backend work before frontend |
|---|---|---|---|
| API completeness | mostly ready | Core CRUD + ops + analytics + recommendations exist | Add small helper endpoints for reference/capabilities |
| Response consistency | partially ready | Pagination mostly unified, but DTO ergonomics vary | Define list/detail DTO conventions |
| Error predictability | partially ready | HTTP codes good; error body lacks machine codes | Standard error envelope |
| Dashboard UI suitability | mostly ready | Analytics endpoints rich but fragmented | Add aggregated dashboard summary endpoint |
| Booking UI suitability | ready | End-to-end booking and lifecycle actions implemented | Add reference endpoint for statuses/actions |
| Admin panel suitability | mostly ready | Admin users + audit logs + domain CRUD available | Add admin user listing/search endpoint (if needed) |
| Notifications/realtime readiness | partially ready | Inbox API exists; no push channel | Add SSE/WebSocket or efficient polling strategy |
| Analytics screens | mostly ready | Summary/occupancy/bookings/forecast/anomalies implemented | Add cached presets for heavy views |
| Recommendation UI | mostly ready | Ranking + explainability available | Add compact recommendation mode for fast list rendering |

---

## 12) Test and documentation audit

### Well covered by tests
- auth and async API contracts
- admin users request-body contracts
- parking access and rules
- spot domain model and compatibility fields
- bookings and lifecycle behavior
- analytics and occupancy forecast
- anomalies and recommendations
- notifications and audit logs
- constraints/pagination behavior

### Weak or missing coverage (frontend-critical)
- standardized error format behavior (currently not centralized)
- explicit capability/action exposure for UI
- heavy-load/performance scenarios (N+1 and sync frequency)
- multi-instance scheduler behavior
- real-time notification delivery integration

### Documentation gaps before this handoff
- No single frontend-oriented API handbook.
- No explicit screen-to-endpoint map.
- No central domain reference for roles/statuses/lifecycle semantics.

This handoff adds those missing artifacts in `docs/`.
