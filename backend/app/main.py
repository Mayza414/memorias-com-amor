from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from contextlib import asynccontextmanager
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import engine, Base
from app.routers import auth, albums, photos, profile

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # Cria as tabelas se não existirem
        await conn.run_sync(Base.metadata.create_all)
        
        # Adiciona as colunas que faltam
        try:
            # Verifica e adiciona bio
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='bio'"
            ))
            if not result.fetchone():
                print("🔧 Adicionando coluna bio...")
                await conn.execute(text("ALTER TABLE users ADD COLUMN bio TEXT"))
                print("✅ Coluna bio adicionada!")
            
            # Verifica e adiciona profile_pic
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='profile_pic'"
            ))
            if not result.fetchone():
                print("🔧 Adicionando coluna profile_pic...")
                await conn.execute(text("ALTER TABLE users ADD COLUMN profile_pic VARCHAR(500)"))
                print("✅ Coluna profile_pic adicionada!")
            
            # Verifica e adiciona updated_at
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at'"
            ))
            if not result.fetchone():
                print("🔧 Adicionando coluna updated_at...")
                await conn.execute(text("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE"))
                print("✅ Coluna updated_at adicionada!")
                
        except Exception as e:
            print(f"⚠️ Erro ao adicionar colunas: {e}")
    
    yield

# CRIAR O APP PRIMEIRO
app = FastAPI(
    title="Memórias com Amor — API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# DEPOIS REGISTRAR OS ROUTERS
app.include_router(auth.router)
app.include_router(albums.router)
app.include_router(photos.router)
app.include_router(profile.router)

# CORS - Configuração explícita
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://memorias-com-amor-frontend.vercel.app",
        "https://memorias-com-amor-app.vercel.app",
        "http://localhost:3000",
        "http://localhost"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
