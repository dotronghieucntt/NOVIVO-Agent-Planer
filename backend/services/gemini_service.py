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


# Fallback chain when primary model is overloaded
_FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"]


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


def _is_overload_error(e: Exception) -> bool:
    msg = str(e)
    return "503" in msg or "UNAVAILABLE" in msg or "429" in msg or "RESOURCE_EXHAUSTED" in msg or "overloaded" in msg.lower()


def _make_config(model: str, temperature: float, system_instruction: str | None = None) -> types.GenerateContentConfig:
    """Build GenerateContentConfig, adding thinking_budget for 2.5-series thinking models."""
    kwargs: dict = {"temperature": temperature}
    if system_instruction:
        kwargs["system_instruction"] = system_instruction
    # gemini-2.5-* only works in thinking mode — must provide a budget > 0
    if "2.5" in model:
        try:
            kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=2048)
        except AttributeError:
            pass  # older SDK version without ThinkingConfig
    return types.GenerateContentConfig(**kwargs)


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
    """Single-turn text generation. Tries primary model with 2 retries, then falls back to flash models."""
    import asyncio
    from google.genai import errors as _errs

    client = _get_client()
    primary_model = _get_effective_model()

    # Build model list: primary + fallbacks (skip duplicates)
    model_list = [primary_model] + [m for m in _FALLBACK_MODELS if m != primary_model]

    last_exc = None
    for model in model_list:
        config = _make_config(model, temperature)
        for attempt in range(2):  # 2 tries per model: 0s, 5s
            if attempt > 0:
                await asyncio.sleep(5)
            try:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=config,
                )
                return _extract_text(response)
            except (_errs.ServerError, _errs.ClientError) as e:
                if _is_overload_error(e):
                    last_exc = e
                    continue  # retry same model
                raise
            except Exception:
                raise
        # Both attempts for this model failed with overload → try next model

    raise last_exc


async def stream_text(prompt: str, temperature: float = 0.8) -> AsyncGenerator[str, None]:
    """Streaming text generation for real-time chat UI (async, non-blocking)."""
    client = _get_client()
    model = _get_effective_model()
    config = _make_config(model, temperature)
    async for chunk in await client.aio.models.generate_content_stream(
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
    contents = []
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
    primary_model = _get_effective_model()
    model_list = [primary_model] + [m for m in _FALLBACK_MODELS if m != primary_model]

    last_exc = None
    for model in model_list:
        config = _make_config(model, temperature, system_instruction=system_prompt)
        for attempt in range(2):
            if attempt > 0:
                await asyncio.sleep(5)
            try:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config,
                )
                return _extract_text(response)
            except (_errs.ServerError, _errs.ClientError) as e:
                if _is_overload_error(e):
                    last_exc = e
                    continue
                raise
            except Exception:
                raise

    raise last_exc
