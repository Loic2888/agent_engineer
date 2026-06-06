import json
import os
from pathlib import Path

import google.generativeai as genai

from backend.agent.state import AgentState
from backend.agent.prompt_utils import render_prompt

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "triage.txt"


def triage_node(state: AgentState) -> AgentState:
    """Étape 0 : classifier l'email (type + priorité + requires_human)."""
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))

    parsed = state["email_parsed"]
    prompt_template = _PROMPT_PATH.read_text(encoding="utf-8")
    prompt = render_prompt(
        prompt_template,
        from_address=parsed.get("from_address", ""),
        subject=parsed.get("subject", ""),
        body=parsed.get("body", ""),
    )

    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
        ),
    )

    try:
        result = json.loads(response.text)
    except json.JSONDecodeError:
        result = {"email_type": "hors_scope", "priority": "low", "requires_human": True}

    return {
        **state,
        "email_type": result.get("email_type", "hors_scope"),
        "priority": result.get("priority", "normal"),
        "requires_human": result.get("requires_human", False),
    }
