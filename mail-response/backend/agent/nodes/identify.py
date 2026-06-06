from backend.agent.state import AgentState
from backend.memory.contacts import find_contact_by_email, add_contact


def identify_node(state: AgentState) -> AgentState:
    """Étape 2 : identifier l'expéditeur via la mémoire ChromaDB."""
    parsed = state["email_parsed"]
    email_addr = parsed.get("from_address", "")
    from_name = parsed.get("from_name")

    contact = find_contact_by_email(email_addr)
    is_new = contact is None

    if is_new:
        contact = add_contact(email=email_addr, name=from_name)

    return {
        **state,
        "contact": {
            "id": contact.id,
            "email": contact.email,
            "name": contact.name,
            "company": contact.company,
            "email_count": contact.email_count,
            "notes": contact.notes,
        },
        "is_new_contact": is_new,
    }
