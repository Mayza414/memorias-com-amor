from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os
from contextlib import asynccontextmanager
from sqlalchemy import text
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.database import engine, Base
from app.routers import auth, albums, photos, profile, social_auth
from app.core.rate_limit import limiter, rate_limit_handler

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # Cria as tabelas
        await conn.run_sync(Base.metadata.create_all)
        
        # ===== COLUNAS DOS USUÁRIOS =====
        try:
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='bio'"
            ))
            if not result.fetchone():
                await conn.execute(text("ALTER TABLE users ADD COLUMN bio TEXT"))
                print("✅ Coluna bio adicionada!")
            
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='profile_pic'"
            ))
            if not result.fetchone():
                await conn.execute(text("ALTER TABLE users ADD COLUMN profile_pic VARCHAR(500)"))
                print("✅ Coluna profile_pic adicionada!")
            
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at'"
            ))
            if not result.fetchone():
                await conn.execute(text("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE"))
                print("✅ Coluna updated_at adicionada!")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar colunas de usuário: {e}")
        
        # ===== COLUNAS DE COMPARTILHAMENTO DOS ÁLBUNS =====
        try:
            # Verifica is_shared
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='albums' AND column_name='is_shared'"
            ))
            if not result.fetchone():
                await conn.execute(text("ALTER TABLE albums ADD COLUMN is_shared BOOLEAN DEFAULT false"))
                print("✅ Coluna is_shared adicionada!")
            
            # Verifica share_token
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='albums' AND column_name='share_token'"
            ))
            if not result.fetchone():
                await conn.execute(text("ALTER TABLE albums ADD COLUMN share_token VARCHAR(64)"))
                await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_albums_share_token ON albums (share_token)"))
                print("✅ Coluna share_token adicionada!")
            
            # Verifica shared_with
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='albums' AND column_name='shared_with'"
            ))
            if not result.fetchone():
                await conn.execute(text("ALTER TABLE albums ADD COLUMN shared_with JSONB DEFAULT '[]'::jsonb"))
                print("✅ Coluna shared_with adicionada!")
        except Exception as e:
            print(f"⚠️ Erro ao adicionar colunas de compartilhamento: {e}")
    
    yield

app = FastAPI(
    title="Memórias com Amor — API",
    description="""
    # 📸 Memórias com Amor API
    
    API para gerenciar memórias, álbuns e fotos.
    
    ## 🔐 Autenticação
    Use o endpoint `/api/auth/login` para obter um token JWT.
    
    ## 📚 Álbuns
    - Criar, listar, atualizar e deletar álbuns
    - Cada álbum pode ter várias fotos
    
    ## 📸 Fotos
    - Upload de fotos (com otimização)
    - Favoritar/desfavoritar
    - Linha do tempo
    
    ## 👤 Perfil
    - Visualizar e editar perfil
    - Upload de foto de perfil
    
    ## 🔒 Segurança
    - Rate limiting (limite de requisições)
    - Headers de segurança
    - Validação de senha forte
    - Tokens JWT com expiração
    """,
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "auth", "description": "Autenticação de usuários"},
        {"name": "albums", "description": "Gerenciamento de álbuns"},
        {"name": "photos", "description": "Gerenciamento de fotos"},
        {"name": "profile", "description": "Perfil do usuário"}
    ]
)

# Session Middleware (necessário para OAuth com Google/GitHub)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    session_cookie="mca_session",
    max_age=3600,
)

# Rate Limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas
app.include_router(auth.router)
app.include_router(albums.router)
app.include_router(photos.router)
app.include_router(profile.router)
app.include_router(social_auth.router)

# Health check
@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.head("/api/health")
async def health_head():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
