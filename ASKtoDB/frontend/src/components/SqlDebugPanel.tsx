import { useState } from "react";

interface Props {
  sql: string | null;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    borderTop: "1px solid #1e293b",
    background: "#0a1628",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.5rem 1.5rem",
    cursor: "pointer",
    userSelect: "none",
    color: "#64748b",
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  code: {
    padding: "0.75rem 1.5rem 1rem",
    fontFamily: "monospace",
    fontSize: "0.85rem",
    color: "#7dd3fc",
    whiteSpace: "pre-wrap",
    overflowX: "auto",
  },
};

export default function SqlDebugPanel({ sql }: Props) {
  const [open, setOpen] = useState(false);
  if (!sql) return null;

  return (
    <div style={styles.wrapper}>
      <div style={styles.header} onClick={() => setOpen((o) => !o)}>
        <span>SQL générée</span>
        <span>{open ? "▲" : "▼"}</span>
      </div>
      {open && <pre style={styles.code}>{sql}</pre>}
    </div>
  );
}
