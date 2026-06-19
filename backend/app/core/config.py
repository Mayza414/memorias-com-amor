from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://mca:mca_secret@db:5432/memorias"
    
    # JWT
    secret_key: str = "troque-esta-chave"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    
    # Upload
    upload_dir: str = "/app/uploads"
    max_file_size_mb: int = 20
    
    # CORS
    allowed_origins: str = "http://localhost,http://localhost:80"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignora todas as variáveis extras


@lru_cache
def get_settings() -> Settings:
    return Settings()
