from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid, os
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import get_settings
from app.models.user import User
from app.models.album import Album
from app.models.photo import Photo
from app.schemas.albums import PhotoOut, PhotoUpdate
from supabase import create_client

router = APIRouter(prefix="/api/photos", tags=["photos"])
settings = get_settings()

SUPABASE_URL = "https://symrxkriawpxigkykmbd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bXJ4a3JpYXdweGlna3lrbWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzMzNTgsImV4cCI6MjA5NzMwOTM1OH0.qcA3fl1EYa_oAQCoiZFzsfcg5x5T8jjpFAYps2fyA_8"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


# ⚠️ ROTAS ESTÁTICAS PRIMEIRO — antes de /{photo_id}
@router.get("/all", response_model=list[PhotoOut])
async def get_all_photos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Photo)
        .where(Photo.user_id == current_user.id)
        .order_by(Photo.created_at.desc())
    )
    return result.scalars().all()


@router.get("/album/{album_id}", response_model=list[PhotoOut])
async def list_album_photos(
    album_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Álbum não encontrado")

    result = await db.execute(
        select(Photo)
        .where(Photo.album_id == album_id)
        .order_by(Photo.created_at.desc())
    )
    return result.scalars().all()


@router.post("/upload", response_model=PhotoOut, status_code=201)
async def upload_photo(
    album_id: str = Form(...),
    caption: Optional[str] = Form(None),
    photo_date: Optional[date] = Form(None),
    is_fav: bool = Form(False),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verifica álbum
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado")

    # Valida extensão
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Formato não suportado. Use: {', '.join(ALLOWED_EXTENSIONS)}")

    # Valida tamanho
    content = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Arquivo muito grande. Máximo: {settings.max_file_size_mb}MB")

    # Upload para Supabase
    try:
        file_path = f"{current_user.id}/{album_id}/{uuid.uuid4()}{file_ext}"
        upload_result = supabase.storage.from_("memorias").upload(
            file_path,
            content,
            file_options={"content-type": file.content_type or "image/jpeg"},
        )
        # A lib supabase-py v2 levanta exceção em caso de erro — se chegou aqui, deu certo
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha no upload para o storage: {str(e)}")

    file_url = f"{SUPABASE_URL}/storage/v1/object/public/memorias/{file_path}"

    try:
        photo = Photo(
            id=str(uuid.uuid4()),
            album_id=album_id,
            user_id=current_user.id,
            filename=file.filename,
            url=file_url,
            caption=caption,
            is_fav=is_fav,
            photo_date=photo_date,
        )
        db.add(photo)
        album.photo_count = (album.photo_count or 0) + 1
        if album.photo_count == 1:
            album.cover_url = file_url

        await db.commit()
        await db.refresh(photo)
        return photo
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar no banco: {str(e)}")


@router.get("/{photo_id}", response_model=PhotoOut)
async def get_photo(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == current_user.id)
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    return photo


@router.patch("/{photo_id}", response_model=PhotoOut)
async def update_photo(
    photo_id: str,
    body: PhotoUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == current_user.id)
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto não encontrada")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(photo, field, value)
    await db.commit()
    await db.refresh(photo)
    return photo


@router.delete("/{photo_id}", status_code=204)
async def delete_photo(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == current_user.id)
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto não encontrada")

    # Remove do storage (falha silenciosa)
    try:
        path = photo.url.replace(f"{SUPABASE_URL}/storage/v1/object/public/memorias/", "")
        supabase.storage.from_("memorias").remove([path])
    except Exception as e:
        print(f"Aviso: erro ao deletar do Supabase Storage: {e}")

    # Atualiza álbum
    album_result = await db.execute(select(Album).where(Album.id == photo.album_id))
    album = album_result.scalar_one_or_none()
    if album:
        album.photo_count = max(0, (album.photo_count or 1) - 1)
        if album.cover_url == photo.url:
            next_photo = await db.execute(
                select(Photo)
                .where(Photo.album_id == album.id, Photo.id != photo_id)
                .limit(1)
            )
            first = next_photo.scalar_one_or_none()
            album.cover_url = first.url if first else None

    await db.delete(photo)
    await db.commit()


@router.post("/{photo_id}/fav")
async def toggle_favorite(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == current_user.id)
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto não encontrada")

    photo.is_fav = not photo.is_fav
    await db.commit()
    await db.refresh(photo)
    return {"id": photo.id, "is_fav": photo.is_fav}