import logging
from backend.agent.state import AgentState

logger = logging.getLogger(__name__)


def retry(state: AgentState) -> dict:
    count = state.get("retry_count", 0) + 1
    logger.info("Retry #%d — error: %s", count, state.get("validation_error"))
    return {"retry_count": count}
