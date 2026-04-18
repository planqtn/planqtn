from functools import lru_cache
import os
import traceback
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic_settings import BaseSettings
import jwt
from jwt import PyJWKClient


class Settings(BaseSettings):
    """Main settings"""

    app_name: str = "PlanqTN"
    env: str = os.getenv("ENV", "development")
    port: int = os.getenv("PORT", 5005)
    supabase_url: str = os.environ["SUPABASE_APP_URL"]
    supabase_key: str = os.environ["SUPABASE_KEY"]


@lru_cache(maxsize=8)
def _jwks_client(supabase_app_url: str) -> PyJWKClient:
    jwks_url = f"{supabase_app_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url)


@lru_cache
def get_settings() -> Settings:
    """Retrieves the fastapi settings"""
    return Settings()


bearer_scheme = HTTPBearer(auto_error=False)


def get_supabase_user_from_token(
    token: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict | None:
    """Uses bearer token to identify supabase user id
    Args:
        token : the bearer token. Can be None as we set auto_error to False
    Returns:
        dict: the supabase user on success
    Raises:
        HTTPException 401 if user does not exist or token is invalid
    """
    try:
        if not token:
            raise ValueError("No token")

        settings = get_settings()
        issuer = f"{settings.supabase_url.rstrip('/')}/auth/v1"
        jwks = _jwks_client(settings.supabase_url)
        signing_key = jwks.get_signing_key_from_jwt(token.credentials)
        payload = jwt.decode(
            token.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=issuer,
        )

        # Extract user information
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("No user ID in token")

        return {
            "uid": user_id,
            "email": payload.get("email"),
            "token": token.credentials,
        }

    except jwt.PyJWTError as e:
        traceback.print_exc()
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not logged in or Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
