import base64
import os
from email.mime.text import MIMEText

from backend.gmail.auth import get_gmail_service


def trash_email(email_id: str) -> None:
    """Move an email to the Gmail trash (recoverable for 30 days)."""
    service = get_gmail_service()
    service.users().messages().trash(userId="me", id=email_id).execute()


def send_email(to: str, subject: str, body: str, reply_to_id: str = None) -> str:
    """Send an email via Gmail API. Returns the sent message ID."""
    service = get_gmail_service()

    message = MIMEText(body, "plain", "utf-8")
    message["to"] = to
    message["from"] = os.environ.get("GMAIL_USER", "me")
    message["subject"] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    body_payload = {"raw": raw}

    if reply_to_id:
        body_payload["threadId"] = reply_to_id

    sent = service.users().messages().send(userId="me", body=body_payload).execute()
    return sent["id"]


def create_draft(to: str, subject: str, body: str, thread_id: str = None) -> str:
    """Create a Gmail draft. Returns the draft ID."""
    service = get_gmail_service()

    message = MIMEText(body, "plain", "utf-8")
    message["to"] = to
    message["from"] = os.environ.get("GMAIL_USER", "me")
    message["subject"] = f"Re: {subject}" if not subject.startswith("Re:") else subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    msg_body = {"raw": raw}
    if thread_id:
        msg_body["threadId"] = thread_id

    draft = service.users().drafts().create(
        userId="me", body={"message": msg_body}
    ).execute()
    return draft["id"]
