import json
import uuid
from datetime import datetime
from typing import Optional

from backend.memory.chroma_client import get_contacts_collection
from backend.models.contact import Contact, ContactDetail


def find_contact_by_email(email: str) -> Optional[Contact]:
    """Look up a contact by exact email address."""
    collection = get_contacts_collection()
    results = collection.get(where={"email": email}, limit=1)

    if not results["ids"]:
        return None

    meta = results["metadatas"][0]
    return Contact(
        id=results["ids"][0],
        email=meta["email"],
        name=meta.get("name"),
        company=meta.get("company"),
        last_seen=datetime.fromisoformat(meta["last_seen"]) if meta.get("last_seen") else None,
        email_count=meta.get("email_count", 0),
        notes=meta.get("notes"),
    )


def add_contact(email: str, name: Optional[str] = None, company: Optional[str] = None) -> Contact:
    """Add a new contact to ChromaDB memory."""
    collection = get_contacts_collection()
    contact_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()

    metadata = {
        "email": email,
        "name": name or "",
        "company": company or "",
        "last_seen": now,
        "email_count": 1,
        "notes": "",
        "history": json.dumps([]),
    }

    document = f"{name or ''} {email} {company or ''}".strip()
    collection.add(ids=[contact_id], documents=[document], metadatas=[metadata])

    return Contact(id=contact_id, email=email, name=name, company=company,
                   last_seen=datetime.utcnow(), email_count=1)


def update_contact_last_seen(contact_id: str, email_summary: dict) -> None:
    """Update last_seen timestamp and append to interaction history."""
    collection = get_contacts_collection()
    results = collection.get(ids=[contact_id])

    if not results["ids"]:
        return

    meta = results["metadatas"][0]
    history = json.loads(meta.get("history", "[]"))
    history.append(email_summary)

    collection.update(
        ids=[contact_id],
        metadatas=[{
            **meta,
            "last_seen": datetime.utcnow().isoformat(),
            "email_count": meta.get("email_count", 0) + 1,
            "history": json.dumps(history[-50:]),
        }],
    )


def list_all_contacts() -> list[Contact]:
    """Return all contacts stored in ChromaDB."""
    collection = get_contacts_collection()
    results = collection.get()

    contacts = []
    for i, cid in enumerate(results["ids"]):
        meta = results["metadatas"][i]
        contacts.append(Contact(
            id=cid,
            email=meta["email"],
            name=meta.get("name") or None,
            company=meta.get("company") or None,
            last_seen=datetime.fromisoformat(meta["last_seen"]) if meta.get("last_seen") else None,
            email_count=meta.get("email_count", 0),
        ))
    return contacts


def get_contact_detail(contact_id: str) -> Optional[ContactDetail]:
    """Return a contact with full interaction history."""
    collection = get_contacts_collection()
    results = collection.get(ids=[contact_id])

    if not results["ids"]:
        return None

    meta = results["metadatas"][0]
    history = json.loads(meta.get("history", "[]"))

    return ContactDetail(
        id=contact_id,
        email=meta["email"],
        name=meta.get("name") or None,
        company=meta.get("company") or None,
        last_seen=datetime.fromisoformat(meta["last_seen"]) if meta.get("last_seen") else None,
        email_count=meta.get("email_count", 0),
        notes=meta.get("notes") or None,
        history=history,
    )
