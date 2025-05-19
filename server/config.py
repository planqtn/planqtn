from functools import lru_cache
import os
import traceback
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic_settings import BaseSettings
from supabase import create_client, Client
import supabase
import jwt
from jwt import PyJWKClient
import requests


class Settings(BaseSettings):
    """Main settings"""

    app_name: str = "PlanqTN"
    env: str = os.getenv("ENV", "development")
    port: int = os.getenv("PORT", 5005)
    supabase_url: str = os.environ["SUPABASE_APP_URL"]
    supabase_key: str = os.environ["SUPABASE_KEY"]
    supabase_jwt_secret: str = os.environ["SUPABASE_JWT_SECRET"]


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

        # Get the JWT secret from environment
        jwt_secret = get_settings().supabase_jwt_secret

        # Decode the JWT token
        payload = jwt.decode(
            token.credentials,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
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
