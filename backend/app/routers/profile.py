from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
import cloudinary
import cloudinary.uploader

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.album import Album
from app.models.photo import Photo
from app.schemas.auth import UserUpdate, UserProfileResponse

router = APIRouter(prefix="/api/profile", tags=["profile"])

@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    albums_count = await db.scalar(
        select(func.count()).select_from(Album).where(Album.user_id == current_user.id)
    )
    photos_count = await db.scalar(
        select(func.count()).select_from(Photo).where(Photo.user_id == current_user.id)
    )
    favorites_count = await db.scalar(
        select(func.count()).select_from(Photo).where(
            Photo.user_id == current_user.id,
            Photo.is_fav == True
        )
    )
    
    return UserProfileResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        bio=current_user.bio,
        profile_pic=current_user.profile_pic,
        albums_count=albums_count or 0,
        photos_count=photos_count or 0,
        favorites_count=favorites_count or 0,
        created_at=current_user.created_at
    )

@router.patch("/me", response_model=UserProfileResponse)
async def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.name is not None:
        current_user.name = data.name
    if data.bio is not None:
        current_user.bio = data.bio
    if data.profile_pic is not None:
        current_user.profile_pic = data.profile_pic
    
    await db.commit()
    await db.refresh(current_user)
    
    return await get_my_profile(current_user, db)

@router.post("/upload-pic", response_model=UserProfileResponse)
async def upload_profile_pic(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        content = await file.read()
        upload_result = cloudinary.uploader.upload(
            content,
            folder=f"memorias/profiles/{current_user.id}",
            public_id="profile",
            resource_type="image",
            transformation=[
                {"width": 300, "height": 300, "crop": "fill", "gravity": "face"},
                {"quality": "auto"}
            ]
        )
        current_user.profile_pic = upload_result.get("secure_url")
        await db.commit()
        await db.refresh(current_user)
        return await get_my_profile(current_user, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no upload: {str(e)}")
