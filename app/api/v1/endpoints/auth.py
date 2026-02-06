from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.user import UserCreate, UserOut
from app.schemas.auth import Token
from app.models.user import User, UserRole
from app.services.auth import register_user, authenticate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: UserCreate, session: AsyncSession = Depends(get_session)):
    # проверка уникальности email
    res = await session.execute(select(User).where(User.email == payload.email))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    # Регистрируем пользователя с ролью "owner"
    user = await register_user(session, payload.email, payload.password, UserRole.owner)
    return user


@router.post("/login", response_model=Token)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    # OAuth2PasswordRequestForm использует поля username/password
    token = await authenticate(session, form.username, form.password)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return Token(access_token=token)
