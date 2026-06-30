from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
import uuid
import secrets

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.album import Album
from app.models.photo import Photo
from app.schemas.albums import AlbumCreate, AlbumUpdate, AlbumOut, ShareAlbumRequest

router = APIRouter(prefix="/api/albums", tags=["albums"])

# URL do frontend para links de compartilhamento
FRONTEND_URL = "https://memorias-com-amor-frontend.vercel.app"


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


# ========== COMPARTILHAMENTO ==========

@router.post("/{album_id}/share")
async def share_album(
    album_id: str,
    body: ShareAlbumRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compartilha um álbum com outro usuário por email"""
    
    # Verifica se o álbum existe e pertence ao usuário
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado")
    
    # Busca o usuário pelo email
    result = await db.execute(select(User).where(User.email == body.email))
    user_to_share = result.scalar_one_or_none()
    if not user_to_share:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if user_to_share.id == current_user.id:
        raise HTTPException(status_code=400, detail="Não é possível compartilhar com você mesmo")
    
    # Adiciona o usuário à lista de compartilhados
    if not album.shared_with:
        album.shared_with = []
    if user_to_share.id not in album.shared_with:
        album.shared_with.append(user_to_share.id)
    
    # Gera token de compartilhamento se não existir
    if not album.share_token:
        album.share_token = secrets.token_urlsafe(32)
    
    album.is_shared = True
    
    await db.commit()
    await db.refresh(album)
    
    return {
        "message": f"Álbum compartilhado com {user_to_share.email}",
        "share_link": f"{FRONTEND_URL}/shared/{album.share_token}"
    }


@router.post("/{album_id}/unshare")
async def unshare_album(
    album_id: str,
    body: ShareAlbumRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove o compartilhamento de um usuário"""
    
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado")
    
    # Busca o usuário pelo email
    result = await db.execute(select(User).where(User.email == body.email))
    user_to_remove = result.scalar_one_or_none()
    if not user_to_remove:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # Remove da lista
    if album.shared_with and user_to_remove.id in album.shared_with:
        album.shared_with.remove(user_to_remove.id)
    
    # Se não houver mais ninguém, desativa compartilhamento
    if not album.shared_with:
        album.is_shared = False
        album.share_token = None
    
    await db.commit()
    await db.refresh(album)
    
    return {"message": f"Compartilhamento removido para {user_to_remove.email}"}


@router.get("/shared")
async def get_shared_albums(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista álbuns compartilhados com o usuário"""
    
    result = await db.execute(
        select(Album)
        .where(
            or_(
                Album.user_id == current_user.id,
                Album.shared_with.contains([current_user.id])
            )
        )
        .order_by(Album.created_at.desc())
    )
    albums = result.scalars().all()
    return albums


@router.get("/public/{token}")
async def get_shared_album_by_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Acessa um álbum compartilhado via token (sem autenticação)"""
    
    result = await db.execute(
        select(Album).where(Album.share_token == token)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado ou não compartilhado")
    
    # Busca as fotos do álbum
    result = await db.execute(
        select(Photo).where(Photo.album_id == album.id)
    )
    photos = result.scalars().all()
    
    # Busca o dono do álbum
    result = await db.execute(select(User).where(User.id == album.user_id))
    owner = result.scalar_one_or_none()
    
    return {
        "album": album,
        "photos": photos,
        "owner_name": owner.name if owner else None,
        "owner_email": owner.email if owner else None,
    }
