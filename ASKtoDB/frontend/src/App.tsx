import { useState } from "react";
import type { CSSProperties } from "react";
import ChatWindow, { Message } from "./components/ChatWindow";
import QueryInput from "./components/QueryInput";
import SqlDebugPanel from "./components/SqlDebugPanel";
import DbConnectPanel from "./components/DbConnectPanel";

const SHOW_SQL = import.meta.env.VITE_SHOW_SQL !== "false";

const appStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  maxWidth: "860px",
  margin: "0 auto",
};

const headerStyle: CSSProperties = {
  padding: "1rem 1.5rem",
  borderBottom: "1px solid #1e293b",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const titleStyle: CSSProperties = { fontSize: "1.15rem", fontWeight: 700, color: "#7dd3fc" };
const subtitleStyle: CSSProperties = { fontSize: "0.8rem", color: "#475569" };

const errorBannerStyle: CSSProperties = {
  margin: "0.5rem 1.5rem",
  padding: "0.6rem 1rem",
  background: "#7f1d1d",
  borderRadius: "0.5rem",
  color: "#fca5a5",
  fontSize: "0.9rem",
};

const dbBadgeStyle = (connected: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  fontSize: "0.78rem",
  color: connected ? "#86efac" : "#94a3b8",
  background: "#0f172a",
  border: `1px solid ${connected ? "#166534" : "#334155"}`,
  borderRadius: "2rem",
  padding: "0.3rem 0.75rem",
  cursor: "pointer",
});

const dot = (connected: boolean): CSSProperties => ({
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: connected ? "#22c55e" : "#475569",
});

export default function App() {
  const savedUrl = localStorage.getItem("asktodb_url") ?? "";
  const [connected, setConnected] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [showDbPanel, setShowDbPanel] = useState(!connected);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSql, setLastSql] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnected = (t: string[]) => {
    setConnected(true);
    setTables(t);
    setShowDbPanel(false);
  };

  const sendMessage = async (question: string) => {
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    setLastSql(null);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sql: data.sql_query ?? undefined },
      ]);
      if (data.sql_query) setLastSql(data.sql_query);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setError(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: `Erreur : ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={appStyle}>
      {showDbPanel && (
        <DbConnectPanel onConnected={handleConnected} currentUrl={savedUrl} />
      )}

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>ASKtoDB</div>
          <div style={subtitleStyle}>Posez vos questions en langage naturel</div>
        </div>
        <div style={dbBadgeStyle(connected)} onClick={() => setShowDbPanel(true)}>
          <span style={dot(connected)} />
          {connected ? `${tables.length} table(s)` : "Non connecté"}
        </div>
      </header>

      {error && <div style={errorBannerStyle}>{error}</div>}

      <ChatWindow messages={messages} showSql={SHOW_SQL} />

      {SHOW_SQL && <SqlDebugPanel sql={lastSql} />}

      <QueryInput onSend={sendMessage} loading={loading || !connected} />
    </div>
  );
}
