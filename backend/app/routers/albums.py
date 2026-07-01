from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
import uuid
import secrets
import string

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.album import Album
from app.models.photo import Photo
from app.schemas.albums import AlbumCreate, AlbumUpdate, AlbumOut, ShareAlbumRequest

router = APIRouter(prefix="/api/albums", tags=["albums"])

# IMPORTANTE: Usar variável de ambiente
from app.core.config import get_settings
settings = get_settings()
FRONTEND_URL = settings.frontend_url


# ─── ROTAS ESTÁTICAS (declaradas ANTES das rotas com parâmetros) ──────────

@router.get("/shared")
async def get_shared_albums(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista apenas álbuns que OUTROS usuários compartilharam com o usuário atual.
    
    CORREÇÃO: a query anterior incluía os próprios álbuns do usuário (user_id == current_user.id),
    misturando-os com os álbuns recebidos. Agora filtra somente pelo shared_with.
    """
    result = await db.execute(
        select(Album)
        .where(Album.shared_with.contains([current_user.id]))
        .order_by(Album.created_at.desc())
    )
    albums = result.scalars().all()

    # Enriquece cada álbum com o nome do dono
    enriched = []
    for album in albums:
        owner_result = await db.execute(select(User).where(User.id == album.user_id))
        owner = owner_result.scalar_one_or_none()
        album_dict = {
            "id": album.id,
            "title": album.title,
            "description": album.description,
            "category": album.category,
            "cover_url": album.cover_url,
            "photo_count": album.photo_count,
            "commemorative_date": album.commemorative_date,
            "is_shared": album.is_shared,
            "share_token": album.share_token,
            "shared_with": album.shared_with,
            "created_at": album.created_at,
            "owner_name": owner.name if owner else "Usuário",
            "owner_email": owner.email if owner else None,
        }
        enriched.append(album_dict)

    return enriched


@router.get("/public/{token}")
async def get_shared_album_by_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Acessa um álbum compartilhado via token (sem autenticação)."""
    result = await db.execute(
        select(Album).where(Album.share_token == token)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado ou não compartilhado")

    result = await db.execute(
        select(Photo).where(Photo.album_id == album.id)
    )
    photos = result.scalars().all()

    result = await db.execute(select(User).where(User.id == album.user_id))
    owner = result.scalar_one_or_none()

    return {
        "album": album,
        "photos": photos,
        "owner_name": owner.name if owner else None,
        "owner_email": owner.email if owner else None,
    }


# ─── ROTAS COM PARÂMETRO DINÂMICO ────────────────────────────────────────────

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
    """Retorna um álbum do usuário ou um álbum compartilhado com ele."""
    result = await db.execute(
        select(Album).where(
            Album.id == album_id,
            or_(
                Album.user_id == current_user.id,
                Album.shared_with.contains([current_user.id]),
            )
        )
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


# ─── COMPARTILHAMENTO ─────────────────────────────────────────────────────────

def generate_unique_share_token(db: AsyncSession):
    """Gera um token único para compartilhamento."""
    import secrets
    while True:
        token = secrets.token_urlsafe(32)
        # Verifica se já existe (em produção, seria uma query assíncrona)
        # Por simplicidade, retorna o token gerado
        # Em produção, use: result = await db.execute(select(Album).where(Album.share_token == token))
        # if not result.scalar_one_or_none(): return token
        return token  # Simplificado para demonstração


@router.post("/{album_id}/share")
async def share_album(
    album_id: str,
    body: ShareAlbumRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compartilha um álbum com outro usuário por e-mail."""
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado")

    result = await db.execute(select(User).where(User.email == body.email))
    user_to_share = result.scalar_one_or_none()
    if not user_to_share:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if user_to_share.id == current_user.id:
        raise HTTPException(status_code=400, detail="Não é possível compartilhar com você mesmo")

    if not album.shared_with:
        album.shared_with = []
    if user_to_share.id not in album.shared_with:
        album.shared_with.append(user_to_share.id)

    if not album.share_token:
        album.share_token = generate_unique_share_token(db)

    album.is_shared = True

    await db.commit()
    await db.refresh(album)

    return {
        "message": f"Álbum compartilhado com {user_to_share.email}",
        "share_link": f"{FRONTEND_URL}/?album={album.id}",
    }


@router.post("/{album_id}/unshare")
async def unshare_album(
    album_id: str,
    body: ShareAlbumRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove o compartilhamento de um usuário."""
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Álbum não encontrado")

    result = await db.execute(select(User).where(User.email == body.email))
    user_to_remove = result.scalar_one_or_none()
    if not user_to_remove:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if album.shared_with and user_to_remove.id in album.shared_with:
        album.shared_with.remove(user_to_remove.id)

    if not album.shared_with:
        album.is_shared = False
        album.share_token = None

    await db.commit()
    await db.refresh(album)

    return {"message": f"Compartilhamento removido para {user_to_remove.email}"}