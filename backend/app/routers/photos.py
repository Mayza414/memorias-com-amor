from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid
import os
from datetime import date
from PIL import Image

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import get_settings
from app.models.user import User
from app.models.album import Album
from app.models.photo import Photo
from app.schemas.albums import PhotoOut, PhotoUpdate

# Supabase
from supabase import create_client

router = APIRouter(prefix="/api/photos", tags=["photos"])
settings = get_settings()

# Configuração do Supabase
SUPABASE_URL = "https://symrxkriawpxigkykmbd.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bXJ4a3JpYXdweGlna3lrbWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzMzNTgsImV4cCI6MjA5NzMwOTM1OH0.qcA3fl1EYa_oAQCoiZFzsfcg5x5T8jjpFAYps2fyA_8"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    """Upload de uma foto para um álbum usando Supabase Storage"""
    
    # Verifica se o álbum existe e pertence ao usuário
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado")
    
    # Valida tamanho do arquivo
    file_size = 0
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    max_size_bytes = settings.max_file_size_mb * 1024 * 1024
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo muito grande. Máximo: {settings.max_file_size_mb}MB"
        )
    
    # Valida extensão
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Formato não suportado. Use: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Gerar nome único para o arquivo
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = f"{current_user.id}/{album_id}/{unique_filename}"
        
        # Ler o conteúdo do arquivo
        content = await file.read()
        
        # Fazer upload para o Supabase Storage
        result = supabase.storage.from_("memorias").upload(
            file_path,
            content,
            file_options={"content-type": file.content_type}
        )
        
        if not result:
            raise Exception("Falha no upload para o Supabase")
        
        # Gerar URL pública
        file_url = f"{SUPABASE_URL}/storage/v1/object/public/memorias/{file_path}"
        
        # Criar registro no banco
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
        album.photo_count += 1
        
        # Se for a primeira foto, define como capa
        if album.photo_count == 1:
            album.cover_url = file_url
        
        await db.commit()
        await db.refresh(photo)
        
        return photo
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro no upload: {str(e)}")


@router.get("/album/{album_id}", response_model=list[PhotoOut])
async def list_album_photos(
    album_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista todas as fotos de um álbum"""
    
    # Verifica se o álbum existe
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado")
    
    # Busca as fotos
    result = await db.execute(
        select(Photo)
        .where(Photo.album_id == album_id)
        .order_by(Photo.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{photo_id}", response_model=PhotoOut)
async def get_photo(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtém detalhes de uma foto específica"""
    
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
    """Atualiza metadados de uma foto"""
    
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == current_user.id)
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    
    # Atualiza campos
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
    """Deleta uma foto (do Supabase e do banco)"""
    
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == current_user.id)
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    
    # Deleta do Supabase Storage
    try:
        # Extrair o caminho da URL
        path = photo.url.replace(f"{SUPABASE_URL}/storage/v1/object/public/memorias/", "")
        supabase.storage.from_("memorias").remove([path])
    except Exception as e:
        print(f"Erro ao deletar do Supabase: {e}")
    
    # Atualiza contagem no álbum
    album_result = await db.execute(
        select(Album).where(Album.id == photo.album_id)
    )
    album = album_result.scalar_one_or_none()
    if album:
        album.photo_count = max(0, album.photo_count - 1)
        
        # Se a foto deletada era a capa, atualiza
        if album.cover_url == photo.url and album.photo_count > 0:
            first_photo_result = await db.execute(
                select(Photo).where(Photo.album_id == album.id).limit(1)
            )
            first_photo = first_photo_result.scalar_one_or_none()
            album.cover_url = first_photo.url if first_photo else None
    
    await db.delete(photo)
    await db.commit()


@router.post("/{photo_id}/fav")
async def toggle_favorite(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Alterna o status de favorito de uma foto"""
    
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


@router.get("/all", response_model=list[PhotoOut])
async def get_all_photos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna todas as fotos do usuário"""
    result = await db.execute(
        select(Photo)
        .where(Photo.user_id == current_user.id)
        .order_by(Photo.created_at.desc())
    )
    return result.scalars().all()
EOF