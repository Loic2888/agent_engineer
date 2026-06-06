from langgraph.graph import StateGraph, END

from backend.agent.state import AgentState
from backend.agent.nodes.fetch_email import fetch_email_node
from backend.agent.nodes.triage import triage_node
from backend.agent.nodes.identify import identify_node
from backend.agent.nodes.extract import extract_node
from backend.agent.nodes.generate import generate_node
from backend.agent.nodes.followup import followup_node


def _should_skip(state: AgentState) -> str:
    """Route : si spam ou hors_scope, on arrête le pipeline."""
    if state.get("error"):
        return "end"
    email_type = state.get("email_type", "")
    if email_type in ("spam", "hors_scope"):
        return "end"
    return "continue"


def _needs_clarification(state: AgentState) -> str:
    """Route : si des infos manquent, on génère quand même (le prompt le gère)."""
    return "generate"


def build_pipeline() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("fetch_email", fetch_email_node)
    graph.add_node("triage", triage_node)
    graph.add_node("identify", identify_node)
    graph.add_node("extract", extract_node)
    graph.add_node("generate", generate_node)
    graph.add_node("followup", followup_node)

    graph.set_entry_point("fetch_email")
    graph.add_edge("fetch_email", "triage")

    graph.add_conditional_edges(
        "triage",
        _should_skip,
        {"end": END, "continue": "identify"},
    )

    graph.add_edge("identify", "extract")

    graph.add_conditional_edges(
        "extract",
        _needs_clarification,
        {"generate": "generate"},
    )

    graph.add_edge("generate", END)

    return graph.compile()


pipeline = build_pipeline()
