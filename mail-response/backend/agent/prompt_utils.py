def render_prompt(template: str, **values: object) -> str:
    """Substitue uniquement les placeholders `{name}` connus dans un template.

    Contrairement à str.format(), cette fonction ignore toutes les autres
    accolades (ex. les exemples JSON `{ "email_type": ... }` présents dans les
    fichiers de prompt), évitant les KeyError sur les accolades littérales.
    """
    result = template
    for key, value in values.items():
        result = result.replace("{" + key + "}", str(value))
    return result
