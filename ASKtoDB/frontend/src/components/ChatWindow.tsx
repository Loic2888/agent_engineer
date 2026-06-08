import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

export interface Message {
  role: "user" | "assistant";
  content: string;
  sql?: string;
}

interface Props {
  messages: Message[];
  showSql: boolean;
}

const bubbleStyle = (role: string): CSSProperties => ({
  maxWidth: "75%",
  alignSelf: role === "user" ? "flex-end" : "flex-start",
  background: role === "user" ? "#3b82f6" : "#1e293b",
  padding: "0.75rem 1rem",
  borderRadius: role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
});

const containerStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "1.5rem",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const sqlBlockStyle: CSSProperties = {
  marginTop: "0.75rem",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "0.5rem",
  padding: "0.75rem",
  fontFamily: "monospace",
  fontSize: "0.82rem",
  overflowX: "auto",
  color: "#7dd3fc",
};

const sqlLabelStyle: CSSProperties = {
  fontSize: "0.7rem",
  color: "#64748b",
  marginBottom: "0.3rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export default function ChatWindow({ messages, showSql }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div style={containerStyle}>
      {messages.map((msg, i) => (
        <div key={i} style={bubbleStyle(msg.role)}>
          {msg.content}
          {showSql && msg.sql && (
            <div style={sqlBlockStyle}>
              <div style={sqlLabelStyle}>SQL générée</div>
              {msg.sql}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
