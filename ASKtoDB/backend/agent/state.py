from typing import TypedDict, Optional


class AgentState(TypedDict):
    # Input
    user_question: str
    conversation_history: list[dict]

    # DB context
    db_dialect: str
    schema: dict  # {table_name: [{col, type, nullable, pk, fk}]}

    # SQL pipeline
    sql_query: Optional[str]
    validation_error: Optional[str]
    raw_results: Optional[list[dict]]
    retry_count: int

    # Output
    natural_response: str
    needs_clarification: bool
    clarification_message: Optional[str]
    error_message: Optional[str]
