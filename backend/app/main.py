from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from contextlib import asynccontextmanager
from sqlalchemy import text
from slowapi.middleware import SlowAPIMiddleware
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.database import engine, Base
from app.routers import auth, albums, photos, profile, social_auth  # ← ADICIONEI social_auth AQUI
from app.core.rate_limit import limiter, rate_limit_handler

from app.routers import auth, albums, photos, profile, social_auth

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Adiciona colunas se não existirem
        try:
            # Verifica bio
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='bio'"
            ))
            if not result.fetchone():
                await conn.execute(text("ALTER TABLE users ADD COLUMN bio TEXT"))
            
            # Verifica profile_pic
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='profile_pic'"
            ))
            if not result.fetchone():
                await conn.execute(text("ALTER TABLE users ADD COLUMN profile_pic VARCHAR(500)"))
            
            # Verifica updated_at
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at'"
            ))
            if not result.fetchone():
                await conn.execute(text("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE"))
        except Exception as e:
            print(f"⚠️ Erro ao adicionar colunas: {e}")
    
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

# Rotas - TODAS JUNTAS AQUI
app.include_router(auth.router)
app.include_router(albums.router)
app.include_router(photos.router)
app.include_router(profile.router)
app.include_router(social_auth.router)  # ← ADICIONE ESTA LINHA

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