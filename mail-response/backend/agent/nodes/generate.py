import json
import os
from pathlib import Path

import google.generativeai as genai

from backend.agent.state import AgentState
from backend.agent.prompt_utils import render_prompt

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "generate.txt"


def generate_node(state: AgentState) -> AgentState:
    """Étapes 4-5 : sélectionner le ton et générer la réponse."""
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))

    parsed = state["email_parsed"]
    contact = state.get("contact") or {}
    contact_history = contact.get("notes", "") or ""

    prompt_template = _PROMPT_PATH.read_text(encoding="utf-8")
    prompt = render_prompt(
        prompt_template,
        intent=state.get("intent", ""),
        email_type=state.get("email_type", ""),
        entities=json.dumps(state.get("entities", {}), ensure_ascii=False),
        tone=state.get("tone", "formel"),
        missing_info=", ".join(state.get("missing_info", [])) or "aucune",
        contact_history=contact_history or "Premier contact",
        from_address=parsed.get("from_address", ""),
        subject=parsed.get("subject", ""),
        body=parsed.get("body", ""),
    )

    response = model.generate_content(prompt)
    draft = response.text.strip()

    return {
        **state,
        "draft_response": draft,
        "human_approved": False,
        "human_edits": None,
    }
