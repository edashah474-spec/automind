import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const API = "https://automind-5ygz.onrender.com";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState("user_" + Date.now());
  const [memoriesUsed, setMemoriesUsed] = useState(0);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/chat`, {
        session_id: sessionId,
        message: userMsg
      });
      setMemoriesUsed(res.data.memories_used);
      setMessages(prev => [...prev, { role: "assistant", content: res.data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Make sure the backend is running!" }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearMemory = async () => {
    await axios.delete(`${API}/memories/${sessionId}`);
    setMessages([]);
    setMemoriesUsed(0);
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Segoe UI', sans-serif", background: "#0f172a" }}>
      
      {/* SIDEBAR */}
      <div style={{ width: 260, background: "#1e293b", padding: 24, display: "flex", flexDirection: "column", borderRight: "1px solid #334155" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 24, fontWeight: "bold", color: "#38bdf8" }}>🧠 AutoMind</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>AI with Persistent Memory</div>
        </div>

        <div style={{ background: "#0f172a", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Session Info</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
            <span style={{ color: "#38bdf8" }}>●</span> Active Session
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
            💬 {messages.filter(m => m.role === "user").length} messages sent
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            🧠 {memoriesUsed} memories retrieved
          </div>
        </div>

        <div style={{ background: "#0f172a", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>How it works</div>
          <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
            AutoMind remembers everything you tell it — across all conversations. It uses vector search to retrieve relevant memories and give personalised responses.
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={clearMemory} style={{ background: "#dc2626", color: "white", border: "none", padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: "bold" }}>
          🗑️ Clear Memory
        </button>
      </div>

      {/* MAIN CHAT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* HEADER */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e293b", background: "#0f172a", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #38bdf8, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧠</div>
          <div>
            <div style={{ fontWeight: "bold", color: "#f1f5f9", fontSize: 15 }}>AutoMind</div>
            <div style={{ fontSize: 12, color: "#22c55e" }}>● Online — Memory Active</div>
          </div>
        </div>

        {/* MESSAGES */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", marginTop: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
              <div style={{ fontSize: 20, fontWeight: "bold", color: "#f1f5f9", marginBottom: 8 }}>Welcome to AutoMind</div>
              <div style={{ fontSize: 14, color: "#64748b", maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
                I remember everything you tell me across all conversations. Tell me about yourself, your projects, your goals — I will never forget.
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
                {["My name is Safa and I study AI Engineering", "I am building a project called AutoMind", "What do you remember about me?"].map((s, i) => (
                  <button key={i} onClick={() => setInput(s)} style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", padding: "8px 16px", borderRadius: 20, cursor: "pointer", fontSize: 13 }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-start" }}>
              {msg.role === "assistant" && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #38bdf8, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🧠</div>
              )}
              <div style={{
                maxWidth: "70%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: msg.role === "user" ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "#1e293b",
                color: "#f1f5f9", fontSize: 14, lineHeight: 1.6
              }}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>👤</div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #38bdf8, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🧠</div>
              <div style={{ background: "#1e293b", padding: "12px 16px", borderRadius: "18px 18px 18px 4px", color: "#64748b", fontSize: 14 }}>
                Thinking and searching memories...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #1e293b", background: "#0f172a" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Tell me anything — I will remember it forever..."
              rows={1}
              style={{
                flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 12,
                color: "#f1f5f9", padding: "12px 16px", fontSize: 14, resize: "none",
                outline: "none", fontFamily: "inherit", lineHeight: 1.5
              }}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()} style={{
              background: loading || !input.trim() ? "#334155" : "linear-gradient(135deg, #3b82f6, #6366f1)",
              color: "white", border: "none", padding: "12px 20px", borderRadius: 12,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer", fontSize: 18
            }}>➤</button>
          </div>
          <div style={{ fontSize: 11, color: "#334155", marginTop: 8, textAlign: "center" }}>Press Enter to send • Shift+Enter for new line</div>
        </div>
      </div>
    </div>
  );
}