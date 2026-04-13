from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.user import UserCreate, UserOut
from app.schemas.auth import Token
from app.models.user import User, UserRole
from app.services.auth import register_user, authenticate
from app.services.audit import build_source_metadata, log_audit_event

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(payload: UserCreate, request: Request, session: AsyncSession = Depends(get_session)):
    # Регистрируем пользователя с ролью "owner"
    try:
        user = await register_user(session, payload.email, payload.password, UserRole.owner)
        await log_audit_event(
            session,
            action_type="auth.register",
            entity_type="user",
            entity_id=user.id,
            actor_user=user,
            new_values={"email": payload.email, "role": UserRole.owner.value},
            source_metadata=build_source_metadata(request),
        )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    await session.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_session),
):
    # OAuth2PasswordRequestForm использует поля username/password
    token = await authenticate(session, form.username, form.password)
    if not token:
        await log_audit_event(
            session,
            action_type="auth.login.failed",
            entity_type="auth",
            entity_id=form.username,
            new_values={"email": form.username},
            source_metadata=build_source_metadata(request),
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    res = await session.execute(select(User).where(User.email == form.username))
    user = res.scalar_one()
    await log_audit_event(
        session,
        action_type="auth.login.success",
        entity_type="user",
        entity_id=user.id,
        actor_user=user,
        source_metadata=build_source_metadata(request),
    )
    await session.commit()
    return Token(access_token=token)
