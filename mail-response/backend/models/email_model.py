from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class EmailParsed(BaseModel):
    from_address: str
    from_name: Optional[str] = None
    subject: str
    body: str
    date: datetime
    message_id: str


class EmailInbox(BaseModel):
    email_id: str
    from_address: str
    from_name: Optional[str] = None
    subject: str
    date: datetime
    snippet: str
    processed: bool = False


class DraftResponse(BaseModel):
    email_id: str
    original_subject: str
    original_from: str
    draft_response: str
    tone: str
    intent: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class ApproveRequest(BaseModel):
    edited_response: Optional[str] = None


class RegenerateRequest(BaseModel):
    instruction: str
