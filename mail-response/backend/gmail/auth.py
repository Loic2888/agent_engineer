import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = [
    # gmail.modify englobe la lecture + la mise à la corbeille (trash) + les libellés.
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
]

CREDENTIALS_PATH = "/app/backend/credentials/gmail_credentials.json"
TOKEN_PATH = "/app/backend/credentials/token.json"


def get_gmail_service():
    """Build and return an authenticated Gmail API service."""
    creds = None

    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(TOKEN_PATH, "w") as token:
                token.write(creds.to_json())
        else:
            raise RuntimeError(
                "Autorisation Gmail requise. Le token OAuth2 est absent ou invalide. "
                "Lancez une seule fois la commande suivante depuis le dossier du projet :\n"
                "    docker compose run --rm -p 8765:8765 backend python -m backend.gmail.authorize\n"
                "puis ouvrez l'URL affichée dans votre navigateur pour autoriser l'accès."
            )

    return build("gmail", "v1", credentials=creds)
