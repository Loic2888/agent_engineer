from backend.agent.state import AgentState
from backend.gmail.reader import get_email_text


def fetch_email_node(state: AgentState) -> AgentState:
    """Étape 1 : récupérer et convertir l'email en texte brut."""
    email_id = state["email_id"]
    parsed = get_email_text(email_id)

    if parsed is None:
        return {**state, "error": f"Email {email_id} introuvable"}

    return {
        **state,
        "email_parsed": {
            "from_address": parsed.from_address,
            "from_name": parsed.from_name,
            "subject": parsed.subject,
            "body": parsed.body,
            "date": parsed.date.isoformat(),
            "message_id": parsed.message_id,
        },
        "error": None,
    }
