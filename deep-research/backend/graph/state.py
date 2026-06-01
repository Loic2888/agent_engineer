from typing import TypedDict, Annotated
from operator import add


class ResearchState(TypedDict):
    query: str
    sub_questions: list[str]
    raw_sources: Annotated[list[dict], add]  # accumulates across researcher iterations
    ranked_sources: list[dict]
    outline: str
    editor_feedback: str
    needs_more_research: bool
    report: str
    iteration: int
    status: str
