"""
Settings Router — manage runtime API keys and model configuration.
Stored in system_settings table so no server restart needed.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.setting import SystemSetting
from models.user import User
from core.deps import get_current_user, require_admin

router = APIRouter(prefix="/api/settings", tags=["settings"])

# Keys that are readable by all logged-in users (non-secret)
_PUBLIC_KEYS = {"gemini_model", "tavily_enabled"}
# Keys that require admin to write
_ADMIN_WRITE_KEYS = {"gemini_api_key", "tavily_api_key"}

_ALL_DEFAULTS = {
    "gemini_api_key": "",
    "gemini_model": "gemini-2.5-flash",
    "tavily_api_key": "",
}


def get_setting(db: Session, key: str) -> str | None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row and row.value:
        return row.value
    return None


def set_setting(db: Session, key: str, value: str):
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if row:
        row.value = value
    else:
        row = SystemSetting(key=key, value=value)
        db.add(row)
    db.commit()


# ── GET all settings (admin: full values; staff: masked keys) ─────────────────

@router.get("")
def list_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = {r.key: r.value for r in db.query(SystemSetting).all()}
    result = {}
    for key, default in _ALL_DEFAULTS.items():
        raw = rows.get(key, default) or ""
        if key.endswith("_api_key") and raw and current_user.role not in ("admin", "superadmin", "manager"):
            # Mask for non-admin: show last 4 chars
            result[key] = "•" * max(0, len(raw) - 4) + raw[-4:]
        else:
            result[key] = raw
    # Include a flag so frontend knows if the key is set
    result["gemini_key_set"] = bool(rows.get("gemini_api_key") or "")
    result["tavily_key_set"] = bool(rows.get("tavily_api_key") or "")
    return result


# ── PATCH settings ────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    gemini_api_key: str | None = None
    gemini_model: str | None = None
    tavily_api_key: str | None = None


@router.patch("")
def update_settings(
    data: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    updated = {}
    payload = data.model_dump(exclude_none=True)

    if "gemini_api_key" in payload:
        set_setting(db, "gemini_api_key", payload["gemini_api_key"].strip())
        # Invalidate cached client so new key is used immediately
        try:
            import services.gemini_service as gs
            gs._client = None
        except Exception:
            pass
        updated["gemini_api_key"] = "updated"

    if "gemini_model" in payload:
        set_setting(db, "gemini_model", payload["gemini_model"].strip())
        updated["gemini_model"] = payload["gemini_model"].strip()

    if "tavily_api_key" in payload:
        set_setting(db, "tavily_api_key", payload["tavily_api_key"].strip())
        updated["tavily_api_key"] = "updated"

    return {"updated": updated}


# ── TEST Gemini key ────────────────────────────────────────────────────────────

class TestGeminiRequest(BaseModel):
    key: str | None = None   # optional: test with this key instead of DB value
    model: str | None = None


@router.post("/test-gemini")
async def test_gemini(
    body: TestGeminiRequest = TestGeminiRequest(),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    from google import genai
    from google.genai import types

    # Use key from request body first, then DB, then .env
    key = (body.key or "").strip()
    if "•" in key:  # masked value sent by frontend — not the real key
        key = ""
    if not key:
        key = get_setting(db, "gemini_api_key") or ""
    if not key:
        from config import settings as cfg
        key = cfg.GEMINI_API_KEY
    if not key:
        raise HTTPException(status_code=400, detail="Chưa cấu hình Gemini API Key")

    model = body.model or get_setting(db, "gemini_model") or "gemini-2.5-flash"
    try:
        client = genai.Client(api_key=key)
        resp = client.models.generate_content(
            model=model,
            contents="Reply with exactly: OK",
            config=types.GenerateContentConfig(temperature=0, max_output_tokens=16),
        )
        # Handle thinking models where resp.text may be None and parts may be None
        text = resp.text or ""
        if not text:
            for cand in (resp.candidates or []):
                content_parts = getattr(cand.content, "parts", None) or []
                parts = [p.text for p in content_parts if getattr(p, "text", None) and not getattr(p, 'thought', False)]
                if parts:
                    text = "".join(parts)
                    break
        if not text:
            text = "OK"  # Model responded but returned no visible text (thinking-only response)
        return {"ok": True, "response": text.strip(), "model": model}
    except Exception as e:
        import logging, traceback
        logging.getLogger("settings").error("test-gemini error: %s\n%s", e, traceback.format_exc())
        msg = str(e)
        status = 400
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
            status = 429
            detail = "Gemini API đã hết quota hoặc vượt spending cap. Vào https://aistudio.google.com để kiểm tra."
        elif "503" in msg or "UNAVAILABLE" in msg:
            status = 503
            detail = "Gemini API đang quá tải — thử lại sau vài phút."
        elif "401" in msg or "API_KEY_INVALID" in msg:
            detail = "API Key không hợp lệ."
        else:
            detail = f"Lỗi kết nối Gemini: {e}"
        raise HTTPException(status_code=status, detail=detail)


class TestTavilyRequest(BaseModel):
    key: str | None = None


@router.post("/test-tavily")
async def test_tavily(
    body: TestTavilyRequest = TestTavilyRequest(),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    import httpx

    key = (body.key or "").strip()
    if "•" in key:
        key = ""
    if not key:
        key = get_setting(db, "tavily_api_key") or ""
    if not key:
        from config import settings as cfg
        key = getattr(cfg, "TAVILY_API_KEY", "")
    if not key:
        raise HTTPException(status_code=400, detail="Chưa cấu hình Tavily API Key")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={"query": "test", "max_results": 1},
                headers={"Authorization": f"Bearer {key}"},
            )
        if resp.status_code == 401:
            raise HTTPException(status_code=400, detail="API Key không hợp lệ (401 Unauthorized)")
        if resp.status_code == 200:
            data = resp.json()
            result_count = len(data.get("results", []))
            return {"ok": True, "message": f"Kết nối thành công! Nhận được {result_count} kết quả."}
        raise HTTPException(status_code=400, detail=f"Tavily trả về lỗi HTTP {resp.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        import logging, traceback
        logging.getLogger("settings").error("test-tavily error: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Lỗi kết nối: {e}")
