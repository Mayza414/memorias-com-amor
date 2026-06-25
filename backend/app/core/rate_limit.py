from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request, HTTPException
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return HTTPException(
        status_code=429,
        detail="Muitas requisições. Tente novamente em alguns segundos."
    )
