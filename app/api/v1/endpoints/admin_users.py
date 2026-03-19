from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.db.session import get_session
from app.models.user import User, UserRole
from app.schemas.user import AdminUserCreate, UserOut, UserRoleUpdate
from app.services.auth import register_user

router = APIRouter(prefix="/admin/users", tags=["admin"])


@router.post("", response_model=UserOut)
async def create_user(
    payload: AdminUserCreate,
    session: AsyncSession = Depends(get_session),
    _admin: User = Depends(require_roles(UserRole.admin)),
):
    # проверка уникальности email
    res = await session.execute(select(User).where(User.email == payload.email))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Регистрируем пользователя с ролью, заданной администратором
    user = await register_user(session, payload.email, payload.password, payload.role)
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    session: AsyncSession = Depends(get_session),
    _admin: User = Depends(require_roles(UserRole.admin)),
):
    # Проверяем, что пользователь существует
    res = await session.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Обновляем роль
    user.role = payload.role
    await session.commit()
    await session.refresh(user)
    return user
