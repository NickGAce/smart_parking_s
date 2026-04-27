from fastapi import APIRouter
from app.api.v1.endpoints import auth, admin_users
from fastapi import Depends
from app.api.deps import get_current_user, require_roles
from app.models.user import UserRole
from app.api.v1.endpoints import access_events, analytics, anomalies, audit_logs, bookings, notifications, parking, parking_spots, recommendations, vehicles


router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
router.include_router(admin_users.router)
router.include_router(parking.router)
router.include_router(parking_spots.router)
router.include_router(bookings.router)
router.include_router(vehicles.router)
router.include_router(access_events.router)
router.include_router(notifications.router)
router.include_router(audit_logs.router)
router.include_router(recommendations.router)
router.include_router(anomalies.router)
router.include_router(analytics.router)


@router.get("/health")
def health():
    return {"status": "ok"}

@router.get("/me")
async def me(user = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "role": user.role}

@router.get("/admin-only")
async def admin_only(user = Depends(require_roles(UserRole.admin))):
    return {"ok": True, "admin_id": user.id}
