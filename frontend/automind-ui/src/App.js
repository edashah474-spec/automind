import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";

const API = "https://automind-5ygz.onrender.com";

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([{ id: "session_1", name: "Main Chat" }]);
  const [currentSessionId, setCurrentSessionId] = useState("session_1");
  const [memoriesUsed, setMemoriesUsed] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const bottomRef = useRef(null);

  // Memories panel
  const [showMemories, setShowMemories] = useState(false);
  const [allMemories, setAllMemories] = useState([]);

  // New chat modal
  const [showNameModal, setShowNameModal] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const nameInputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (showNameModal) {
      setTimeout(() => nameInputRef.current?.focus(), 60);
    }
  }, [showNameModal]);

  const createNewChat = () => {
    const name = newChatName.trim();
    if (!name) return;
    const newId = "session_" + Date.now();
    setSessions(prev => [...prev, { id: newId, name }]);
    setCurrentSessionId(newId);
    setMessages([]);
    setMemoriesUsed(0);
    setMsgCount(0);
    setNewChatName("");
    setShowNameModal(false);
  };

  const handleModalKey = (e) => {
    if (e.key === "Enter") createNewChat();
    if (e.key === "Escape") { setShowNameModal(false); setNewChatName(""); }
  };

  const switchSession = (id) => {
    setCurrentSessionId(id);
    setMessages([]);
    setMemoriesUsed(0);
    setMsgCount(0);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setMsgCount(prev => prev + 1);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/chat`, {
        session_id: currentSessionId,
        message: userMsg
      });
      setMemoriesUsed(res.data.memories_used || 0);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.data.response,
        memoriesUsed: res.data.memories_used || 0
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Connection error. Make sure the backend is running.",
        memoriesUsed: 0
      }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearMemory = async () => {
    if (!window.confirm("Clear all memory for this session?")) return;
    await axios.delete(`${API}/memories/${currentSessionId}`);
    setMessages([]);
    setMemoriesUsed(0);
    setMsgCount(0);
  };

  const viewMemories = async () => {
    try {
      const res = await axios.get(`${API}/memories/${currentSessionId}`);
      setAllMemories(res.data);
      setShowMemories(true);
    } catch {
      alert("Could not load memories");
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="shell">

      {/* ── NEW CHAT MODAL ── */}
      {showNameModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowNameModal(false); setNewChatName(""); } }}>
          <div className="modal-box">
            <div className="modal-title">Name this conversation</div>
            <div className="modal-sub">Give it a short topic so you can find it later in your sessions.</div>
            <input
              ref={nameInputRef}
              className="modal-input"
              value={newChatName}
              onChange={e => setNewChatName(e.target.value)}
              onKeyDown={handleModalKey}
              placeholder="e.g. London job search, AutoMind ideas..."
            />
            <div className="modal-btns">
              <button className="modal-cancel" onClick={() => { setShowNameModal(false); setNewChatName(""); }}>
                Cancel
              </button>
              <button className="modal-create" onClick={createNewChat} disabled={!newChatName.trim()}>
                Create chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MEMORIES PANEL ── */}
      {showMemories && (
        <div className="memories-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowMemories(false); }}>
          <div className="memories-panel">
            <div className="memories-header">
              <div className="memories-title">Memory bank — {currentSession?.name}</div>
              <button className="close-btn" onClick={() => setShowMemories(false)}>×</button>
            </div>
            <div className="memories-list">
              {allMemories.length === 0
                ? <div className="no-memories">no memories stored yet</div>
                : allMemories.map((m, i) => (
                  <div key={i} className="memory-item">
                    <div className={`memory-role ${m.role}`}>{m.role}</div>
                    <div className="memory-content">{m.content}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      <div className="sidebar">
        <div className="logo-wrap">
          <div className="logo-mark">🧠</div>
          <div className="logo-text-block">
            <div className="logo-name">AutoMind</div>
            <div className="logo-tagline">persistent memory ai</div>
          </div>
        </div>

        <button className="new-chat-btn" onClick={() => setShowNameModal(true)}>
          <span>+</span> New conversation
        </button>

        <div className="section-label">Sessions</div>
        <div className="session-list">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${currentSessionId === session.id ? "active" : ""}`}
              onClick={() => switchSession(session.id)}
            >
              <div className="session-name">{session.name}</div>
            </div>
          ))}
        </div>

        <div className="section-label">Live stats</div>
        <div className="memory-stats">
          <div className="stat-row">
            <div className="stat-dot" style={{ background: "#7c6fcd" }}></div>
            <div className="stat-label">active session</div>
            <div className="stat-val" style={{ color: "#7c6fcd" }}>●</div>
          </div>
          <div className="stat-row">
            <div className="stat-dot" style={{ background: "#4ecdc4" }}></div>
            <div className="stat-label">memories used</div>
            <div className="stat-val">{memoriesUsed}</div>
          </div>
          <div className="stat-row">
            <div className="stat-dot" style={{ background: "#f6c90e" }}></div>
            <div className="stat-label">messages sent</div>
            <div className="stat-val">{msgCount}</div>
          </div>
        </div>

        <button className="sidebar-btn" onClick={viewMemories}>
          <span>👁</span> View memory bank
        </button>
        <button className="sidebar-btn danger" onClick={clearMemory}>
          <span>🗑</span> Clear memory
        </button>
      </div>

      {/* ── MAIN CHAT ── */}
      <div className="main">

        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-avatar">🧠</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="topbar-name">{currentSession?.name || "AutoMind"}</div>
            <div className="topbar-status">
              <div className="live-dot"></div>
              online — memory active
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        <div className="messages-area">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-glyph">🧠</div>
              <div className="empty-title">Welcome to AutoMind</div>
              <div className="empty-sub">
                I remember everything you tell me across all conversations.
                Tell me about yourself — I will never forget.
              </div>
              <div className="chips-row">
                {[
                  "Let me introduce myself...",
                  "What can you help me with?",
                  "Do you remember anything about me?"
                ].map((s, i) => (
                  <button key={i} className="chip-btn" onClick={() => setInput(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`msg-row ${msg.role === "user" ? "user" : ""}`}>
              <div className={`msg-avatar ${msg.role === "user" ? "user-av" : "ai"}`}>
                {msg.role === "user" ? "S" : "🧠"}
              </div>
              <div className="bubble-wrap">
                <div className={`bubble ${msg.role === "user" ? "user" : "ai"}`}>
                  {msg.content}
                </div>
                {msg.role === "assistant" && msg.memoriesUsed > 0 && (
                  <div className="mem-badge">
                    ◈ {msg.memoriesUsed} memories retrieved
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="thinking-wrap">
              <div className="msg-avatar ai">🧠</div>
              <div className="thinking-bubble">
                <div className="think-dot"></div>
                <div className="think-dot"></div>
                <div className="think-dot"></div>
                <span className="thinking-label">searching memories...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <div className="input-area">
          <div className="input-row">
            <textarea
              className="input-box"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Tell me anything — I will remember it forever..."
              rows={1}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              ➤
            </button>
          </div>
          <div className="input-hint">enter to send · shift+enter for new line</div>
        </div>
      </div>
    </div>
  );
}