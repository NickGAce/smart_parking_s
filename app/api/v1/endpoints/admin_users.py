from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.db.session import get_session
from app.models.user import User, UserRole
from app.schemas.user import AdminUserCreate, UserOut, UserRoleUpdate
from app.services.auth import register_user
from app.services.audit import build_source_metadata, log_audit_event
from app.services.db_errors import is_duplicate_user_email_error

router = APIRouter(prefix="/admin/users", tags=["admin"])


@router.post("", response_model=UserOut)
async def create_user(
    payload: AdminUserCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_roles(UserRole.admin)),
):
    # Не используем `session.begin()` здесь: зависимости авторизации уже могут
    # открыть транзакцию (autobegin), и повторный begin приведет к InvalidRequestError.
    try:
        user = await register_user(session, payload.email, payload.password, payload.role)
        await log_audit_event(
            session,
            action_type="admin.user.create",
            entity_type="user",
            entity_id=user.id,
            actor_user=admin,
            new_values={"email": user.email, "role": user.role},
            source_metadata=build_source_metadata(request),
        )
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        if is_duplicate_user_email_error(exc):
            raise HTTPException(status_code=409, detail="Email already registered")
        raise
    await session.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    admin: User = Depends(require_roles(UserRole.admin)),
):
    # Проверяем, что пользователь существует
    res = await session.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Обновляем роль
    old_role = user.role
    user.role = payload.role
    await log_audit_event(
        session,
        action_type="admin.user.update_role",
        entity_type="user",
        entity_id=user.id,
        actor_user=admin,
        old_values={"role": old_role},
        new_values={"role": user.role},
        source_metadata=build_source_metadata(request),
    )
    await session.commit()
    await session.refresh(user)
    return user
