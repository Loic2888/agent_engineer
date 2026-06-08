import logging
from langgraph.graph import StateGraph, END
from backend.agent.state import AgentState
from backend.agent.nodes.detect_db import detect_db_type
from backend.agent.nodes.fetch_schema import fetch_schema
from backend.agent.nodes.clarify import clarify_if_needed
from backend.agent.nodes.generate_sql import generate_sql
from backend.agent.nodes.validate_sql import validate_sql
from backend.agent.nodes.execute_query import execute_query
from backend.agent.nodes.retry import retry
from backend.agent.nodes.translate import translate_response
from backend.config import settings

logger = logging.getLogger(__name__)


def _clarify_edge(state: AgentState) -> str:
    if state.get("needs_clarification"):
        return "end_clarify"
    return "generate_sql"


def _validate_edge(state: AgentState) -> str:
    if state.get("validation_error"):
        if state.get("retry_count", 0) < settings.max_retries:
            return "retry"
        return "end_error"
    return "execute_query"


def _execute_edge(state: AgentState) -> str:
    if state.get("validation_error"):
        if state.get("retry_count", 0) < settings.max_retries:
            return "retry"
        return "end_error"
    return "translate"


def _end_clarify(state: AgentState) -> dict:
    return {
        "natural_response": state.get("clarification_message", "Pouvez-vous préciser votre question ?"),
        "error_message": None,
    }


def _end_error(state: AgentState) -> dict:
    return {
        "natural_response": state.get("validation_error", "Une erreur s'est produite."),
        "error_message": state.get("validation_error"),
    }


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("detect_db_type", detect_db_type)
    graph.add_node("fetch_schema", fetch_schema)
    graph.add_node("clarify_if_needed", clarify_if_needed)
    graph.add_node("generate_sql", generate_sql)
    graph.add_node("validate_sql", validate_sql)
    graph.add_node("execute_query", execute_query)
    graph.add_node("retry", retry)
    graph.add_node("translate_response", translate_response)
    graph.add_node("end_clarify", _end_clarify)
    graph.add_node("end_error", _end_error)

    graph.set_entry_point("detect_db_type")
    graph.add_edge("detect_db_type", "fetch_schema")
    graph.add_edge("fetch_schema", "clarify_if_needed")
    graph.add_conditional_edges("clarify_if_needed", _clarify_edge, {
        "end_clarify": "end_clarify",
        "generate_sql": "generate_sql",
    })
    graph.add_edge("generate_sql", "validate_sql")
    graph.add_conditional_edges("validate_sql", _validate_edge, {
        "retry": "retry",
        "execute_query": "execute_query",
        "end_error": "end_error",
    })
    graph.add_conditional_edges("execute_query", _execute_edge, {
        "retry": "retry",
        "translate": "translate_response",
        "end_error": "end_error",
    })
    graph.add_edge("retry", "generate_sql")
    graph.add_edge("translate_response", END)
    graph.add_edge("end_clarify", END)
    graph.add_edge("end_error", END)

    logger.info("LangGraph compiled")
    return graph.compile()


agent_graph = build_graph()
