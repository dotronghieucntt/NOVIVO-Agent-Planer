import httpx
import time
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from models.user import User, UserRole

logger = logging.getLogger("deps")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

NOVIVO_ME_URL = "https://api.novivo.net/api/auth/me"

# NOVIVO roles that map to local admin
_ADMIN_ROLES = {"admin", "superadmin", "manager"}

# ── Simple in-memory token cache (TTL = 5 min) ───────────────────────────────
_token_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 300  # seconds


def _get_novivo_user(token: str) -> dict:
    """Validate token against NOVIVO API with 5-minute cache."""
    now = time.time()
    cached = _token_cache.get(token)
    if cached and now - cached[1] < _CACHE_TTL:
        return cached[0]

    try:
        resp = httpx.get(
            NOVIVO_ME_URL,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot reach auth server",
        )

    if resp.status_code != 200:
        # Evict stale cache if any
        _token_cache.pop(token, None)
        logger.warning("NOVIVO /auth/me returned %s: %s", resp.status_code, resp.text[:200])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        data = resp.json()
    except Exception:
        logger.error("NOVIVO /auth/me returned non-JSON 200: %s", resp.text[:200])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Unwrap various NOVIVO response shapes:
    # { user: {...} }  /  { data: { user: {...} } }  /  { data: {...} }  /  { ...flat... }
    info = data
    if isinstance(info, dict):
        if "data" in info:
            info = info["data"]
        if isinstance(info, dict) and "user" in info:
            info = info["user"]

    if not isinstance(info, dict):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Cache successful result
    _token_cache[token] = (info, now)
    # Evict entries older than 2× TTL to prevent unbounded growth
    stale = [k for k, (_, t) in _token_cache.items() if now - t > _CACHE_TTL * 2]
    for k in stale:
        _token_cache.pop(k, None)

    return info


def _novivo_role_to_local(novivo_role: str) -> UserRole:
    return UserRole.admin if novivo_role in _ADMIN_ROLES else UserRole.staff


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    import traceback as _tb
    try:
        info = _get_novivo_user(token)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("_get_novivo_user crashed: %s\n%s", e, _tb.format_exc())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username: str = info.get("username") or info.get("userName") or ""
    if not username:
        logger.error("No username in NOVIVO info: %s", info)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    novivo_role: str = (info.get("role") or "employee").lower()
    local_role = _novivo_role_to_local(novivo_role)
    email: str = info.get("email") or f"{username}@novivo.net"
    full_name: str = info.get("fullName") or info.get("full_name") or username

    try:
        # Find or auto-create a local shadow user
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            # Ensure email is unique - fall back to a synthetic one if needed
            safe_email = email
            if db.query(User).filter(User.email == safe_email).first():
                safe_email = f"{username}__novivo@novivo.net"
            try:
                user = User(
                    username=username,
                    email=safe_email,
                    hashed_password="__novivo_sso__",
                    role=local_role,
                    full_name=full_name,
                    is_active=True,
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            except IntegrityError:
                db.rollback()
                user = db.query(User).filter(User.username == username).first()
                if user is None:
                    try:
                        user = User(
                            username=username,
                            email=f"{username}__{int(time.time())}@novivo.net",
                            hashed_password="__novivo_sso__",
                            role=local_role,
                            full_name=full_name,
                            is_active=True,
                        )
                        db.add(user)
                        db.commit()
                        db.refresh(user)
                    except Exception:
                        db.rollback()
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to create user record",
                        )
        else:
            changed = False
            if user.role != local_role:
                user.role = local_role
                changed = True
            if not user.is_active:
                user.is_active = True
                changed = True
            if changed:
                db.commit()
                db.refresh(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("DB error in get_current_user for '%s': %s\n%s", username, e, _tb.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {e}",
        )

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
