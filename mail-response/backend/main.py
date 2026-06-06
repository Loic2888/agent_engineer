import os
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.agent.pipeline import pipeline
from backend.agent.nodes.followup import followup_node
from backend.agent.state import AgentState
from backend.gmail.reader import list_unread_emails, get_email_text
from backend.gmail.sender import send_email, trash_email
from backend.memory.contacts import list_all_contacts, get_contact_detail
from backend.models.email_model import ApproveRequest, RegenerateRequest

app = FastAPI(title="Email Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for processed email states (keyed by email_id)
_email_states: dict[str, AgentState] = {}


@app.get("/emails/inbox")
async def get_inbox():
    """Liste les emails non traités depuis Gmail."""
    try:
        emails = list_unread_emails(max_results=20)
        return [
            {
                "email_id": e.email_id,
                "from_address": e.from_address,
                "from_name": e.from_name,
                "subject": e.subject,
                "date": e.date.isoformat(),
                "snippet": e.snippet,
                "processed": e.email_id in _email_states,
                "email_type": _email_states.get(e.email_id, {}).get("email_type"),
            }
            for e in emails
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/emails/{email_id}/process")
async def process_email(email_id: str):
    """Lance le pipeline agentique sur un email."""
    initial_state: AgentState = {
        "email_id": email_id,
        "email_raw": "",
        "email_parsed": {},
        "email_type": "",
        "priority": "normal",
        "requires_human": False,
        "contact": None,
        "is_new_contact": False,
        "intent": "",
        "entities": {},
        "missing_info": [],
        "template_id": "",
        "draft_response": "",
        "tone": "formel",
        "human_approved": False,
        "human_edits": None,
        "sent": False,
        "followup_task": None,
        "error": None,
    }

    try:
        result = await pipeline.ainvoke(initial_state)
        _email_states[email_id] = result
        return {
            "email_id": email_id,
            "email_type": result.get("email_type"),
            "priority": result.get("priority"),
            "intent": result.get("intent"),
            "requires_human": result.get("requires_human"),
            "has_draft": bool(result.get("draft_response")),
            "error": result.get("error"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/emails/{email_id}/draft")
async def get_draft(email_id: str):
    """Récupère le brouillon généré pour un email."""
    state = _email_states.get(email_id)
    if not state:
        raise HTTPException(status_code=404, detail="Email non traité ou introuvable")

    parsed = state.get("email_parsed", {})
    return {
        "email_id": email_id,
        "original_subject": parsed.get("subject", ""),
        "original_from": parsed.get("from_address", ""),
        "original_body": parsed.get("body", ""),
        "draft_response": state.get("draft_response", ""),
        "tone": state.get("tone", "formel"),
        "intent": state.get("intent", ""),
        "email_type": state.get("email_type", ""),
        "missing_info": state.get("missing_info", []),
        "contact": state.get("contact"),
    }


@app.post("/emails/{email_id}/approve")
async def approve_email(email_id: str, body: ApproveRequest):
    """Valide et envoie le brouillon (avec édition optionnelle)."""
    state = _email_states.get(email_id)
    if not state:
        raise HTTPException(status_code=404, detail="Email non traité ou introuvable")

    final_response = body.edited_response or state.get("draft_response", "")
    parsed = state.get("email_parsed", {})
    to = parsed.get("from_address", "")
    subject = parsed.get("subject", "")

    try:
        sent_id = send_email(
            to=to,
            subject=f"Re: {subject}" if not subject.startswith("Re:") else subject,
            body=final_response,
            reply_to_id=email_id,
        )

        sent_state = {
            **state,
            "human_approved": True,
            "human_edits": body.edited_response,
            "draft_response": final_response,
            "sent": True,
        }

        # Étape 7 : mise à jour mémoire + tâches de suivi (appel direct du nœud).
        _email_states[email_id] = followup_node(sent_state)

        return {"success": True, "sent_message_id": sent_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/emails/{email_id}/regenerate")
async def regenerate_email(email_id: str, body: RegenerateRequest):
    """Régénère la réponse avec une instruction supplémentaire."""
    state = _email_states.get(email_id)
    if not state:
        raise HTTPException(status_code=404, detail="Email non traité ou introuvable")

    import os
    import google.generativeai as genai
    from pathlib import Path

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))

    prompt = (
        f"Voici un brouillon de réponse email :\n\n{state.get('draft_response', '')}\n\n"
        f"Instruction de modification : {body.instruction}\n\n"
        "Génère une nouvelle version du brouillon en appliquant cette instruction. "
        "RÈGLE ABSOLUE : utilise toujours le vouvoiement."
    )

    response = model.generate_content(prompt)
    new_draft = response.text.strip()

    _email_states[email_id] = {**state, "draft_response": new_draft}

    return {"draft_response": new_draft}


@app.delete("/emails/{email_id}")
async def delete_email(email_id: str):
    """Déplace l'email vers la corbeille Gmail et l'oublie de l'état local."""
    try:
        trash_email(email_id)
        _email_states.pop(email_id, None)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/contacts")
async def get_contacts():
    """Liste tous les contacts en mémoire."""
    try:
        contacts = list_all_contacts()
        return [c.model_dump() for c in contacts]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/contacts/{contact_id}")
async def get_contact(contact_id: str):
    """Détail d'un contact avec son historique."""
    contact = get_contact_detail(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact introuvable")
    return contact.model_dump()


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
