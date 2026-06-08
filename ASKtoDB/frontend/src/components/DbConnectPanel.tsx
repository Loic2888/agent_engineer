import { useState, type CSSProperties } from "react";

interface Props {
  onConnected: (tables: string[]) => void;
  currentUrl: string;
}

interface HistoryEntry {
  url: string;
  label: string;
  connectedAt: string;
}

const HISTORY_KEY = "asktodb_history";
const MAX_HISTORY = 10;

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveToHistory(url: string) {
  const entries = loadHistory().filter((e) => e.url !== url);
  entries.unshift({ url, label: urlLabel(url), connectedAt: new Date().toLocaleDateString("fr-FR") });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

function urlLabel(url: string): string {
  try {
    if (url.startsWith("sqlite")) {
      const path = url.replace(/^sqlite:\/\/\/+/, "");
      return path.split("/").pop() ?? "SQLite";
    }
    const match = url.match(/^(\w+)[+\w]*:\/\/[^@]*@([^/]+)\/(.+)$/);
    if (match) {
      const [, dialect, host, db] = match;
      return `${db} (${dialect} @ ${host})`;
    }
    return url.slice(0, 40);
  } catch {
    return url.slice(0, 40);
  }
}

function maskUrl(url: string): string {
  return url.replace(/:([^:@]+)@/, ":***@");
}

const overlay: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
};

const wrapper: CSSProperties = {
  display: "flex", gap: "1rem",
  width: "min(920px, 95vw)", alignItems: "flex-start",
};

const card: CSSProperties = {
  background: "#1e293b", borderRadius: "1rem", padding: "1.75rem",
  display: "flex", flexDirection: "column", gap: "1.1rem", flex: "0 0 420px",
};

const historyCard: CSSProperties = {
  background: "#1e293b", borderRadius: "1rem", padding: "1.75rem",
  display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1, minWidth: 0,
};

const labelStyle: CSSProperties = { fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.3rem" };

const inputStyle: CSSProperties = {
  width: "100%", background: "#0f172a", border: "1px solid #334155",
  borderRadius: "0.5rem", padding: "0.65rem 0.9rem", color: "#e2e8f0",
  fontSize: "0.85rem", fontFamily: "monospace", outline: "none",
  boxSizing: "border-box",
};

const btnPrimary = (loading: boolean): CSSProperties => ({
  background: loading ? "#1e40af" : "#3b82f6", color: "#fff", border: "none",
  borderRadius: "0.5rem", padding: "0.65rem 1.25rem",
  cursor: loading ? "not-allowed" : "pointer",
  fontWeight: 600, fontSize: "0.9rem", alignSelf: "flex-end",
});

const chipStyle: CSSProperties = {
  background: "#0f172a", border: "1px solid #334155", borderRadius: "0.4rem",
  color: "#94a3b8", padding: "0.2rem 0.55rem", fontSize: "0.73rem", cursor: "pointer",
};

const examples = [
  { label: "SQLite", value: "sqlite:////chemin/vers/ta/base.db" },
  { label: "PostgreSQL", value: "postgresql://user:password@localhost:5432/mydb" },
  { label: "MySQL", value: "mysql+pymysql://user:password@localhost:3306/mydb" },
];

export default function DbConnectPanel({ onConnected, currentUrl }: Props) {
  const [url, setUrl] = useState(currentUrl);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [copied, setCopied] = useState<string | null>(null);

  const handleConnect = async (targetUrl = url) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    if (targetUrl !== url) setUrl(trimmed);
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/config/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database_url: trimmed }),
      });
      const data = await res.json();
      setMessage({ text: data.message, ok: data.success });
      if (data.success) {
        saveToHistory(trimmed);
        setHistory(loadHistory());
        localStorage.setItem("asktodb_url", trimmed);
        setTimeout(() => onConnected(data.tables ?? []), 600);
      }
    } catch {
      setMessage({ text: "Impossible de joindre le backend.", ok: false });
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = (entryUrl: string) => {
    navigator.clipboard.writeText(entryUrl).then(() => {
      setCopied(entryUrl);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  const removeEntry = (entryUrl: string) => {
    const updated = history.filter((h) => h.url !== entryUrl);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    setHistory(updated);
  };

  return (
    <div style={overlay}>
      <div style={wrapper}>

        {/* ── Panneau gauche : formulaire ───────────────────────────────── */}
        <div style={card}>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#7dd3fc", marginBottom: "0.2rem" }}>
              Connexion à la base de données
            </div>
            <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
              L'URL n'est jamais sauvegardée sur disque.
            </div>
          </div>

          <div>
            <div style={labelStyle}>URL de connexion</div>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: "72px" }}
              placeholder="sqlite:////mon/projet/db.sqlite3"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleConnect())}
              spellCheck={false}
            />
          </div>

          <div>
            <div style={labelStyle}>Exemples de format</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {examples.map((ex) => (
                <button key={ex.label} onClick={() => setUrl(ex.value)} style={chipStyle}>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {message && (
            <div style={{
              padding: "0.55rem 0.85rem", borderRadius: "0.5rem",
              background: message.ok ? "#14532d" : "#7f1d1d",
              color: message.ok ? "#86efac" : "#fca5a5",
              fontSize: "0.85rem",
            }}>
              {message.text}
            </div>
          )}

          <button style={btnPrimary(loading)} onClick={() => handleConnect()} disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </div>

        {/* ── Panneau droit : historique ────────────────────────────────── */}
        <div style={historyCard}>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#7dd3fc" }}>
            Connexions récentes
          </div>

          {history.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "#475569", marginTop: "0.5rem" }}>
              Aucune connexion enregistrée pour l'instant.<br />
              Elles apparaîtront ici après chaque connexion réussie.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {history.map((entry) => (
                <div
                  key={entry.url}
                  style={{
                    background: "#0f172a", border: "1px solid #1e293b",
                    borderRadius: "0.6rem", padding: "0.65rem 0.8rem",
                  }}
                >
                  {/* Nom + date */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "#e2e8f0", fontWeight: 500 }}>
                      {entry.label}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#475569", flexShrink: 0, marginLeft: "0.5rem" }}>
                      {entry.connectedAt}
                    </span>
                  </div>

                  {/* URL masquée */}
                  <div style={{
                    fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    marginBottom: "0.5rem",
                  }}>
                    {maskUrl(entry.url)}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      onClick={() => copyUrl(entry.url)}
                      style={{
                        flex: 1, background: copied === entry.url ? "#166534" : "#1e293b",
                        border: "1px solid #334155", borderRadius: "0.4rem",
                        color: copied === entry.url ? "#86efac" : "#94a3b8",
                        padding: "0.3rem 0", fontSize: "0.75rem", cursor: "pointer",
                      }}
                    >
                      {copied === entry.url ? "✓ Copié" : "Copier l'URL"}
                    </button>
                    <button
                      onClick={() => handleConnect(entry.url)}
                      style={{
                        flex: 1, background: "#1e3a5f", border: "1px solid #3b82f6",
                        borderRadius: "0.4rem", color: "#93c5fd",
                        padding: "0.3rem 0", fontSize: "0.75rem", cursor: "pointer",
                      }}
                    >
                      Connecter
                    </button>
                    <button
                      onClick={() => removeEntry(entry.url)}
                      style={{
                        background: "none", border: "1px solid #334155",
                        borderRadius: "0.4rem", color: "#475569",
                        padding: "0.3rem 0.6rem", fontSize: "0.8rem", cursor: "pointer",
                      }}
                      title="Supprimer"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
