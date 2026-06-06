from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Contact(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    company: Optional[str] = None
    last_seen: datetime = None
    email_count: int = 0
    notes: Optional[str] = None


class ContactDetail(Contact):
    history: list[dict] = []
