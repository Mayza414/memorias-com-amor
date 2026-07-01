from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://mca:mca_secret@db:5432/memorias"
    secret_key: str = "troque-esta-chave"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    upload_dir: str = "/app/uploads"
    max_file_size_mb: int = 20
    allowed_origins: str = "http://localhost"
    
    # Adicionar URLs para frontend e backend
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
