from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request, HTTPException
from slowapi.errors import RateLimitExceeded

# Função personalizada para pegar o IP real
def get_real_ip(request: Request):
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)

limiter = Limiter(key_func=get_real_ip)

def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return HTTPException(
        status_code=429,
        detail="Muitas requisições. Tente novamente em alguns segundos."
    )
