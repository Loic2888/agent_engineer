from pydantic import BaseModel
from typing import Optional
from enum import Enum


class EmailType(str, Enum):
    rdv = "rdv"
    reclamation = "reclamation"
    info = "info"
    spam = "spam"
    hors_scope = "hors_scope"


class Priority(str, Enum):
    urgent = "urgent"
    normal = "normal"
    low = "low"


class Tone(str, Enum):
    formel = "formel"
    semi_formel = "semi-formel"


class ExtractedIntent(BaseModel):
    intent: str
    entities: dict
    missing_info: list[str]
    email_type: EmailType
    priority: Priority
    tone: Tone
    requires_human: bool = False
