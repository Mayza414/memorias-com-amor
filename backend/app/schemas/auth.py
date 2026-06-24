from pydantic import BaseModel, EmailStr

from typing import Optional
from datetime import datetime

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    name: str
    email: str

    model_config = {"from_attributes": True}


TokenResponse.model_rebuild()

class UserUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    profile_pic: Optional[str] = None


class UserProfileResponse(UserOut):
    bio: Optional[str] = None
    profile_pic: Optional[str] = None
    albums_count: int = 0
    photos_count: int = 0
    favorites_count: int = 0
    created_at: datetime
