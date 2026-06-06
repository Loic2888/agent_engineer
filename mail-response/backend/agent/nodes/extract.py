import json
import os
from datetime import date
from pathlib import Path

import google.generativeai as genai

from backend.agent.state import AgentState
from backend.agent.prompt_utils import render_prompt

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "extract.txt"


def extract_node(state: AgentState) -> AgentState:
    """Étape 3 : extraire l'intention, les entités et les infos manquantes."""
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))

    parsed = state["email_parsed"]
    prompt_template = _PROMPT_PATH.read_text(encoding="utf-8")
    prompt = render_prompt(
        prompt_template,
        current_date=date.today().isoformat(),
        from_address=parsed.get("from_address", ""),
        from_name=parsed.get("from_name", ""),
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
        result = {
            "intent": "Demande non déterminée",
            "entities": {},
            "missing_info": [],
            "tone": "formel",
        }

    return {
        **state,
        "intent": result.get("intent", ""),
        "entities": result.get("entities", {}),
        "missing_info": result.get("missing_info", []),
        "tone": result.get("tone", "formel"),
    }
