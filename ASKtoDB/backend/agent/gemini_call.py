import time
import logging
from google import genai
from backend.config import settings

logger = logging.getLogger(__name__)

_DELAYS = [2, 5, 10]


def _is_retryable(exc: Exception) -> bool:
    msg = str(exc).upper()
    return "503" in msg or "UNAVAILABLE" in msg or "429" in msg or "RESOURCE_EXHAUSTED" in msg


def gemini_generate(contents: str, system: str, response_mime_type: str | None = None) -> str:
    client = genai.Client(api_key=settings.gemini_api_key)
    cfg: dict = {"system_instruction": system}
    if response_mime_type:
        cfg["response_mime_type"] = response_mime_type

    last_exc: Exception | None = None
    for attempt, delay in enumerate([0] + _DELAYS):
        if delay:
            logger.warning("Gemini indisponible — retry %d/%d dans %ds", attempt, len(_DELAYS), delay)
            time.sleep(delay)
        try:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=contents,
                config=cfg,
            )
            return response.text
        except Exception as exc:
            if _is_retryable(exc):
                last_exc = exc
            else:
                raise

    raise RuntimeError(f"Gemini indisponible après {len(_DELAYS)} tentatives : {last_exc}")
