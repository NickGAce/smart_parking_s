from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)

    class Config:
        str_strip_whitespace = True
        str_min_length = 6
        from_attributes = True


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    role: UserRole

    class Config:
        str_strip_whitespace = True
        str_min_length = 6
        from_attributes = True


class UserRoleUpdate(BaseModel):
    role: UserRole

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: UserRole

    class Config:
        from_attributes = True
