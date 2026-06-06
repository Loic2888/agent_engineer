"""Génération unique du token OAuth2 Gmail (token.json).

À lancer UNE SEULE FOIS, depuis le conteneur backend avec le port 8765 publié :

    docker compose run --rm -p 8765:8765 backend python -m backend.gmail.authorize

Le script affiche une URL. Ouvrez-la dans votre navigateur, autorisez l'accès
au compte Gmail, et le token sera enregistré automatiquement dans
credentials/token.json (monté en volume, donc persistant).
"""
from google_auth_oauthlib.flow import InstalledAppFlow

from backend.gmail.auth import SCOPES, CREDENTIALS_PATH, TOKEN_PATH


def main() -> None:
    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)

    # bind_addr=0.0.0.0 pour écouter dans le conteneur, host=localhost pour
    # que l'URL de redirection reste joignable depuis le navigateur de l'hôte.
    creds = flow.run_local_server(
        host="localhost",
        bind_addr="0.0.0.0",
        port=8765,
        open_browser=False,
    )

    with open(TOKEN_PATH, "w", encoding="utf-8") as token:
        token.write(creds.to_json())

    print("\n✅ token.json créé avec succès dans credentials/")
    print("   Vous pouvez maintenant relancer l'application (start.bat).")


if __name__ == "__main__":
    main()
