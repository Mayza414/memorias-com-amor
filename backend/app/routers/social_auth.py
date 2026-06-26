from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from app.core.database import get_db
from app.core.oauth import oauth
from app.core.security import create_access_token, create_refresh_token, hash_password
from app.models.user import User
from app.schemas.auth import TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

FRONTEND_URL = "https://memorias-com-amor-frontend.vercel.app"
BACKEND_URL = "https://memorias-com-amor.onrender.com"

def _make_tokens(user: User) -> TokenResponse:
    data = {"sub": user.id}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
        user=UserOut.model_validate(user),
    )

@router.get("/github/login")
async def github_login(request: Request):
    """Inicia o login com GitHub"""
    redirect_uri = f"{BACKEND_URL}/api/auth/github/callback"
    return await oauth.github.authorize_redirect(request, redirect_uri)

@router.get("/github/callback")
async def github_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Callback do GitHub"""
    try:
        token = await oauth.github.authorize_access_token(request)
        access_token = token.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="Erro ao obter token do GitHub")
        
        # Busca dados do usuário no GitHub
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            user_data = response.json()
        
        # Busca email do usuário
        email = user_data.get("email")
        if not email:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                emails = resp.json()
                for e in emails:
                    if e.get("primary") and e.get("verified"):
                        email = e.get("email")
                        break
        
        if not email:
            raise HTTPException(status_code=400, detail="Não foi possível obter o email")
        
        name = user_data.get("name") or user_data.get("login") or email.split("@")[0]
        github_id = str(user_data.get("id"))
        
        # Verifica se usuário já existe
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(
                name=name,
                email=email,
                hashed_password=hash_password(github_id + "social"),
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        
        tokens = _make_tokens(user)
        return RedirectResponse(
            f"{FRONTEND_URL}/?token={tokens.access_token}"
        )
    except Exception as e:
        return RedirectResponse(f"{FRONTEND_URL}/?auth_error={str(e)}")
