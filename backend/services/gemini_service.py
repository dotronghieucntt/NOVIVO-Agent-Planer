"""
Gemini AI Service — wraps google-genai (new unified SDK) for chat + structured generation.
API key and model are read from the system_settings DB table at runtime,
falling back to .env values when not set in DB.
"""
from google import genai
from google.genai import types
from typing import AsyncGenerator
from config import settings

_client: genai.Client | None = None


def _get_effective_key() -> str:
    """Read Gemini API key from DB first, fall back to .env."""
    try:
        from database import SessionLocal
        from models.setting import SystemSetting
        db = SessionLocal()
        try:
            row = db.query(SystemSetting).filter(SystemSetting.key == "gemini_api_key").first()
            if row and row.value:
                return row.value
        finally:
            db.close()
    except Exception:
        pass
    return settings.GEMINI_API_KEY


def _get_effective_model() -> str:
    """Read Gemini model from DB first, fall back to .env."""
    try:
        from database import SessionLocal
        from models.setting import SystemSetting
        db = SessionLocal()
        try:
            row = db.query(SystemSetting).filter(SystemSetting.key == "gemini_model").first()
            if row and row.value:
                return row.value
        finally:
            db.close()
    except Exception:
        pass
    return settings.GEMINI_MODEL


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=_get_effective_key())
    return _client


def _extract_text(response) -> str:
    """Extract text from Gemini response, handling thinking models where .text may be None."""
    if response.text:
        return response.text
    # For thinking models (2.5-pro), iterate parts and skip thought parts
    try:
        for candidate in response.candidates:
            parts = [p.text for p in candidate.content.parts if p.text and not getattr(p, 'thought', False)]
            if parts:
                return "".join(parts)
    except Exception:
        pass
    return ""


async def generate_text(prompt: str, temperature: float = 0.8) -> str:
    """Single-turn text generation with retry on 503/429."""
    import asyncio
    from google.genai import errors as _errs

    client = _get_client()
    model = _get_effective_model()
    config = types.GenerateContentConfig(temperature=temperature)

    last_exc = None
    for attempt in range(4):  # 4 attempts: 0, 5, 15, 45s
        if attempt > 0:
            wait = 5 * (3 ** (attempt - 1))  # 5, 15, 45
            await asyncio.sleep(wait)
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=config,
            )
            return _extract_text(response)
        except (_errs.ServerError, _errs.ClientError) as e:
            msg = str(e)
            if "503" in msg or "UNAVAILABLE" in msg or "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                last_exc = e
                continue  # retry
            raise  # other errors: propagate immediately
        except Exception:
            raise

    raise last_exc


async def stream_text(prompt: str, temperature: float = 0.8) -> AsyncGenerator[str, None]:
    """Streaming text generation for real-time chat UI."""
    client = _get_client()
    model = _get_effective_model()
    config = types.GenerateContentConfig(temperature=temperature)
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=prompt,
        config=config,
    ):
        if chunk.text:
            yield chunk.text


async def chat_completion(
    history: list[dict],
    system_prompt: str,
    temperature: float = 0.7,
) -> str:
    """
    Multi-turn chat.
    history format: [{"role": "user"|"assistant", "content": "text"}]
    """
    import asyncio
    from google.genai import errors as _errs

    client = _get_client()
    model = _get_effective_model()
    contents = []
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
    config = types.GenerateContentConfig(
        temperature=temperature,
        system_instruction=system_prompt,
    )

    last_exc = None
    for attempt in range(4):
        if attempt > 0:
            await asyncio.sleep(5 * (3 ** (attempt - 1)))
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
            return _extract_text(response)
        except (_errs.ServerError, _errs.ClientError) as e:
            msg = str(e)
            if "503" in msg or "UNAVAILABLE" in msg or "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                last_exc = e
                continue
            raise
        except Exception:
            raise
    raise last_exc
