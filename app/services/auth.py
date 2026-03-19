from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.core.security import hash_password, verify_password, create_access_token


async def register_user(
    session: AsyncSession, email: str, password: str, role: UserRole = UserRole.owner
) -> User:
    user = User(email=email, hashed_password=hash_password(password), role=role)
    session.add(user)
    await session.flush()
    return user


async def authenticate(session: AsyncSession, email: str, password: str) -> str | None:
    res = await session.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return create_access_token(str(user.id))
