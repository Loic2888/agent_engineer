import base64
import email as email_lib
from datetime import datetime
from typing import Optional

from backend.gmail.auth import get_gmail_service
from backend.models.email_model import EmailParsed, EmailInbox


def list_unread_emails(max_results: int = 20) -> list[EmailInbox]:
    """Fetch unread emails from Gmail inbox."""
    service = get_gmail_service()
    results = service.users().messages().list(
        userId="me",
        labelIds=["INBOX", "UNREAD"],
        maxResults=max_results,
    ).execute()

    messages = results.get("messages", [])
    inbox = []

    for msg in messages:
        meta = service.users().messages().get(
            userId="me", id=msg["id"], format="metadata",
            metadataHeaders=["From", "Subject", "Date"],
        ).execute()

        headers = {h["name"]: h["value"] for h in meta.get("payload", {}).get("headers", [])}
        snippet = meta.get("snippet", "")
        date_str = headers.get("Date", "")

        try:
            date = email_lib.utils.parsedate_to_datetime(date_str)
        except Exception:
            date = datetime.utcnow()

        from_raw = headers.get("From", "")
        from_name, from_addr = email_lib.utils.parseaddr(from_raw)

        inbox.append(EmailInbox(
            email_id=msg["id"],
            from_address=from_addr or from_raw,
            from_name=from_name or None,
            subject=headers.get("Subject", "(Sans objet)"),
            date=date,
            snippet=snippet,
        ))

    return inbox


def get_email_text(email_id: str) -> Optional[EmailParsed]:
    """Fetch a single email and return its parsed content as plain text."""
    service = get_gmail_service()
    msg = service.users().messages().get(
        userId="me", id=email_id, format="full"
    ).execute()

    payload = msg.get("payload", {})
    headers = {h["name"]: h["value"] for h in payload.get("headers", [])}

    body = _extract_body(payload)

    from_raw = headers.get("From", "")
    from_name, from_addr = email_lib.utils.parseaddr(from_raw)
    date_str = headers.get("Date", "")

    try:
        date = email_lib.utils.parsedate_to_datetime(date_str)
    except Exception:
        date = datetime.utcnow()

    return EmailParsed(
        from_address=from_addr or from_raw,
        from_name=from_name or None,
        subject=headers.get("Subject", "(Sans objet)"),
        body=body,
        date=date,
        message_id=email_id,
    )


def _extract_body(payload: dict) -> str:
    """Recursively extract plain text body from Gmail payload."""
    mime_type = payload.get("mimeType", "")

    if mime_type == "text/plain":
        data = payload.get("body", {}).get("data", "")
        return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")

    if mime_type.startswith("multipart/"):
        for part in payload.get("parts", []):
            result = _extract_body(part)
            if result:
                return result

    return ""
