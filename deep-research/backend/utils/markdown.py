def format_references(sources: list[dict]) -> str:
    lines = ["## References\n"]
    for i, source in enumerate(sources, 1):
        title = source.get("title", "Untitled")
        url = source.get("url", "")
        lines.append(f"[{i}] [{title}]({url})")
    return "\n".join(lines)
