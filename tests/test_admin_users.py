import asyncio
import os

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret")

from app.api.deps import get_session
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.main import app
from app.models.user import User, UserRole


def _setup_state():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async def init_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with session_local() as session:
            admin = User(email="admin@test.com", hashed_password=hash_password("secret123"), role=UserRole.admin)
            session.add(admin)
            await session.commit()

    asyncio.run(init_db())

    async def override_get_session():
        async with session_local() as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    return {"admin": create_access_token("1")}


def test_admin_create_user_uses_json_body():
    tokens = _setup_state()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/users",
            json={"email": "new_user@test.com", "password": "secret123", "role": UserRole.owner},
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["email"] == "new_user@test.com"
        assert payload["role"] == UserRole.owner
        assert "hashed_password" not in payload


def test_admin_create_user_rejects_query_params_without_body():
    tokens = _setup_state()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/admin/users?email=query@test.com&password=secret123&role=owner",
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )

        assert response.status_code == 422


def test_admin_update_role_uses_json_body():
    tokens = _setup_state()

    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/admin/users",
            json={"email": "change_role@test.com", "password": "secret123", "role": UserRole.owner},
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )
        user_id = create_response.json()["id"]

        update_response = client.patch(
            f"/api/v1/admin/users/{user_id}",
            json={"role": UserRole.tenant},
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )

        assert update_response.status_code == 200
        assert update_response.json()["role"] == UserRole.tenant


def test_admin_update_role_rejects_query_param_only():
    tokens = _setup_state()

    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/admin/users",
            json={"email": "query_role@test.com", "password": "secret123", "role": UserRole.owner},
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )
        user_id = create_response.json()["id"]

        update_response = client.patch(
            f"/api/v1/admin/users/{user_id}?new_role=tenant",
            headers={"Authorization": f"Bearer {tokens['admin']}"},
        )

        assert update_response.status_code == 422


def test_openapi_admin_users_has_request_body_not_password_query_param():
    _setup_state()

    with TestClient(app) as client:
        openapi = client.get("/openapi.json").json()

    create_operation = openapi["paths"]["/api/v1/admin/users"]["post"]
    assert "requestBody" in create_operation
    assert "parameters" not in create_operation or all(
        p.get("name") not in {"email", "password", "role"}
        for p in create_operation.get("parameters", [])
    )

    patch_operation = openapi["paths"]["/api/v1/admin/users/{user_id}"]["patch"]
    assert "requestBody" in patch_operation
    assert all(p.get("name") != "new_role" for p in patch_operation.get("parameters", []))
