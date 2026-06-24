# No WSL, na pasta backend
cd /mnt/c/Users/mayza/memorias-com-amor/backend

# Substitua todo o conteúdo do main.py
cat > app/main.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.database import engine, Base
from app.routers import auth, albums, photos, profile

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Memórias com Amor — API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

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

# Rota para HEAD (para o UptimeRobot)
@app.head("/api/health")
async def health_head():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
EOF