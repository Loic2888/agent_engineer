import { useState, KeyboardEvent } from "react";
import type { CSSProperties } from "react";

interface Props {
  onSend: (question: string) => void;
  loading: boolean;
}

const containerStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  padding: "1rem 1.5rem",
  borderTop: "1px solid #1e293b",
  background: "#0f172a",
};

const inputStyle: CSSProperties = {
  flex: 1,
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "0.75rem",
  padding: "0.75rem 1rem",
  color: "#e2e8f0",
  fontSize: "0.95rem",
  outline: "none",
  resize: "none",
  fontFamily: "inherit",
  lineHeight: 1.5,
};

const buttonStyle = (loading: boolean): CSSProperties => ({
  background: loading ? "#1e40af" : "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: "0.75rem",
  padding: "0 1.25rem",
  cursor: loading ? "not-allowed" : "pointer",
  fontSize: "0.95rem",
  fontWeight: 600,
  minWidth: "6rem",
  transition: "background 0.2s",
});

export default function QueryInput({ onSend, loading }: Props) {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const q = value.trim();
    if (!q || loading) return;
    onSend(q);
    setValue("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={containerStyle}>
      <textarea
        style={inputStyle}
        rows={2}
        placeholder="Posez votre question en français ou en anglais…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={loading}
      />
      <button style={buttonStyle(loading)} onClick={handleSend} disabled={loading}>
        {loading ? "…" : "Envoyer"}
      </button>
    </div>
  );
}
