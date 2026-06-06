from datetime import datetime

from backend.agent.state import AgentState
from backend.memory.contacts import update_contact_last_seen


def followup_node(state: AgentState) -> AgentState:
    """Étape 7 : mise à jour mémoire et tâches de suivi post-envoi."""
    contact = state.get("contact")
    if contact and contact.get("id"):
        summary = {
            "date": datetime.utcnow().isoformat(),
            "email_id": state.get("email_id"),
            "subject": state["email_parsed"].get("subject", ""),
            "intent": state.get("intent", ""),
            "email_type": state.get("email_type", ""),
            "draft_sent": state.get("sent", False),
        }
        update_contact_last_seen(contact["id"], summary)

    followup = None
    if state.get("email_type") == "rdv":
        followup = {
            "type": "reminder",
            "message": "Vérifier la confirmation du rendez-vous dans 48h",
            "due": datetime.utcnow().isoformat(),
        }
    elif state.get("email_type") == "reclamation":
        followup = {
            "type": "follow_up",
            "message": "Relancer le client si pas de réponse sous 72h",
            "due": datetime.utcnow().isoformat(),
        }

    return {
        **state,
        "followup_task": followup,
    }
