from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.album import Album
from app.schemas.albums import AlbumCreate, AlbumUpdate, AlbumOut

router = APIRouter(prefix="/api/albums", tags=["albums"])


@router.get("", response_model=list[AlbumOut])
async def list_albums(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Album)
        .where(Album.user_id == current_user.id)
        .order_by(Album.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=AlbumOut, status_code=201)
async def create_album(
    body: AlbumCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    album = Album(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        title=body.title.strip(),
        description=body.description,
        category=body.category,
        commemorative_date=body.commemorative_date,
    )
    db.add(album)
    await db.commit()
    await db.refresh(album)
    return album


@router.get("/{album_id}", response_model=AlbumOut)
async def get_album(
    album_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado")
    return album


@router.patch("/{album_id}", response_model=AlbumOut)
async def update_album(
    album_id: str,
    body: AlbumUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(album, field, value)

    await db.commit()
    await db.refresh(album)
    return album


@router.delete("/{album_id}", status_code=204)
async def delete_album(
    album_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado")

    await db.delete(album)
    await db.commit()
