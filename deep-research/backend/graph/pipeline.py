from langgraph.graph import StateGraph, START, END
from graph.state import ResearchState
from agents.planner import run_planner
from agents.researcher import run_researcher
from agents.synthesizer import run_synthesizer
from agents.writer import run_writer_outline, run_writer_final
from agents.editor import run_editor


def _route_after_editor(state: ResearchState) -> str:
    if state.get("needs_more_research", False) and state.get("iteration", 0) < 2:
        return "researcher"
    return "writer_final"


def build_pipeline():
    graph = StateGraph(ResearchState)

    graph.add_node("planner", run_planner)
    graph.add_node("researcher", run_researcher)
    graph.add_node("synthesizer", run_synthesizer)
    graph.add_node("writer_outline", run_writer_outline)
    graph.add_node("editor", run_editor)
    graph.add_node("writer_final", run_writer_final)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "researcher")
    graph.add_edge("researcher", "synthesizer")
    graph.add_edge("synthesizer", "writer_outline")
    graph.add_edge("writer_outline", "editor")
    graph.add_conditional_edges(
        "editor",
        _route_after_editor,
        {"researcher": "researcher", "writer_final": "writer_final"},
    )
    graph.add_edge("writer_final", END)

    return graph.compile()


pipeline = build_pipeline()
