from typing import TypedDict, Optional


class AgentState(TypedDict):
    # Email source
    email_id: str
    email_raw: str
    email_parsed: dict          # {from_address, from_name, subject, body, date}

    # Classification
    email_type: str             # rdv / reclamation / info / spam / hors_scope
    priority: str               # urgent / normal / low
    requires_human: bool

    # Contact
    contact: Optional[dict]     # Infos expéditeur depuis mémoire
    is_new_contact: bool

    # Extraction
    intent: str
    entities: dict              # date, service, montant, etc.
    missing_info: list[str]

    # Génération
    template_id: str
    draft_response: str
    tone: str                   # formel / semi-formel

    # Review
    human_approved: bool
    human_edits: Optional[str]

    # Post-envoi
    sent: bool
    followup_task: Optional[dict]

    # Erreur
    error: Optional[str]
