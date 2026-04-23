"""
JWT Authentication service for BlueSME.

Provides:
  - JWT token generation (login)
  - Token verification (middleware)
  - SME-scoped access control

Usage in FastAPI (queue_bridge or future API server):
    from backend.services.auth import require_sme_token, create_access_token
"""

from __future__ import annotations

import os
import time
from typing import Optional

import jwt
from pydantic import BaseModel

from backend.utils.logger import get_logger

logger = get_logger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-use-long-random-string")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = int(os.getenv("JWT_EXPIRY_SECONDS", "86400"))  # 24h default


# ── Token schema ──────────────────────────────────────────────────────────────

class TokenPayload(BaseModel):
    sub: str           # SME wallet address (subject)
    sme_id: str        # DB UUID of the SME
    sme_name: str
    exp: int           # Unix timestamp
    iat: int           # Issued-at


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    sme_address: str
    sme_name: str


# ── Token operations ──────────────────────────────────────────────────────────

def create_access_token(
    sme_address: str,
    sme_id: str,
    sme_name: str,
) -> LoginResponse:
    """
    Generate a signed JWT for the given SME.
    The token encodes the SME's wallet address for scope enforcement.
    """
    now = int(time.time())
    payload = {
        "sub": sme_address.lower(),
        "sme_id": sme_id,
        "sme_name": sme_name,
        "iat": now,
        "exp": now + JWT_EXPIRY_SECONDS,
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return LoginResponse(
        access_token=token,
        expires_in=JWT_EXPIRY_SECONDS,
        sme_address=sme_address.lower(),
        sme_name=sme_name,
    )


def verify_token(token: str) -> Optional[TokenPayload]:
    """
    Verify and decode a JWT.
    Returns TokenPayload on success, None if invalid/expired.
    """
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return TokenPayload(**data)
    except jwt.ExpiredSignatureError:
        logger.warning("JWT expired")
        return None
    except jwt.InvalidTokenError as exc:
        logger.warning(f"Invalid JWT: {exc}")
        return None


def extract_bearer_token(authorization_header: str) -> Optional[str]:
    """Extract raw token from 'Bearer <token>' header."""
    if not authorization_header:
        return None
    parts = authorization_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


# ── FastAPI dependency ────────────────────────────────────────────────────────

try:
    from fastapi import Depends, HTTPException, Security, status
    from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

    _bearer_scheme = HTTPBearer(auto_error=False)

    async def require_auth(
        credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer_scheme),
    ) -> TokenPayload:
        """
        FastAPI dependency — raises 401 if token is missing or invalid.

        Usage:
            @app.get("/protected")
            async def endpoint(token: TokenPayload = Depends(require_auth)):
                ...
        """
        if not credentials:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        payload = verify_token(credentials.credentials)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload

    async def require_sme_scope(
        sme_address: str,
        token: TokenPayload = Depends(require_auth),
    ) -> TokenPayload:
        """
        Verifies the authenticated SME matches the requested sme_address.
        Prevents one SME accessing another SME's data.
        """
        if token.sub != sme_address.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Token is not scoped for this SME address",
            )
        return token

except ImportError:
    # FastAPI not installed — auth module still importable, just no FastAPI deps
    pass


# ── Auth endpoints (to add to queue_bridge.py) ────────────────────────────────

class LoginRequest(BaseModel):
    wallet_address: str
    signature: str   # Placeholder for future wallet-signature auth

    class Config:
        # In production: verify EIP-191 signature. For now: accept any signature.
        pass


def authenticate_sme(wallet_address: str, sme_id: str, sme_name: str) -> LoginResponse:
    """
    Issue a JWT for the given SME.
    In production: verify wallet signature before calling this.
    """
    return create_access_token(
        sme_address=wallet_address,
        sme_id=sme_id,
        sme_name=sme_name,
    )
