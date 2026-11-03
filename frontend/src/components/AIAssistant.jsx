import { useState, useEffect, useRef } from "react";
import API from "../services/api";
import { useAuth } from "../hooks/useAuth";

const AIAssistant = ({ courseName = "", lessonContent = "" }) => {
    const { user, isStaff } = useAuth();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState(() => [{
        role: "ai",
        text: isStaff
            ? `Hi! I can generate quiz questions for "${courseName}". Just ask me like: "Generate 3 questions about variables"`
            : `How can I help with "${courseName}"?`
    }]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const send = async () => {
        const text = input.trim();
        if (!text || loading) return;
        setInput("");
        setMessages(prev => [...prev, { role: "user", text }]);
        setLoading(true);
        try {
            const res = await API.post("/ai/ask", {
                message: text,
                role: user?.role,
                context: { courseName, lessonContent }
            });
            setMessages(prev => [...prev, { role: "ai", text: res.data.reply }]);
        } catch (error) {
            setMessages(prev => [...prev, {
                role: "ai",
                text: error.response?.data?.message || (
                    error.code === "ECONNABORTED" || error.code === "ERR_NETWORK"
                        ? "Unable to connect to SmartCampus. Check that the backend is running and try again."
                        : "Sorry, I couldn't respond. Please try again."
                )
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating button — always visible on every page */}
            <button
                onClick={() => setOpen(o => !o)}
                title="AI Assistant"
                style={{
                    position: "fixed", bottom: 24, right: 24, zIndex: 1000,
                    width: 58, height: 58, borderRadius: "50%",
                    background: open ? "var(--theme-bg)" : "var(--theme-accent)",
                    border: "2px solid var(--theme-accent)",
                    fontSize: "1.5rem", cursor: "pointer",
                    boxShadow: "0 4px 24px rgba(var(--theme-accent-rgb),0.4)",
                    color: open ? "var(--theme-accent)" : "var(--theme-active-text)",
                    transition: "all 0.2s", display: "flex",
                    alignItems: "center", justifyContent: "center"
                }}>
                {open ? "✕" : "🤖"}
            </button>

            {/* Chat window */}
            {open && (
                <div style={{
                    position: "fixed", bottom: 94, right: 24, zIndex: 999,
                    width: "min(400px, calc(100vw - 32px))",
                    background: "var(--theme-panel)", borderRadius: 16,
                    boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                    border: "1px solid var(--theme-border)",
                    display: "flex", flexDirection: "column",
                    maxHeight: "65vh"
                }}>
                    {/* Header */}
                    <div style={{
                        padding: "14px 18px", background: "var(--theme-panel-raised)",
                        borderBottom: "1px solid var(--theme-border)",
                        borderRadius: "16px 16px 0 0"
                    }}>
                        <p style={{ color: "var(--theme-accent)", fontWeight: 700, fontSize: "0.95rem" }}>
                            🤖 AI {isStaff ? "Quiz Generator" : "Learning Assistant"}
                        </p>
                        <p style={{ color: "var(--theme-muted)", fontSize: "0.75rem", marginTop: 2 }}>
                            {isStaff
                                ? "Generates quiz questions from your course materials"
                                : "Helps you understand — won't give direct answers"}
                        </p>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1, overflowY: "auto", padding: 16,
                        display: "flex", flexDirection: "column", gap: 10
                    }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                                background: msg.role === "user" ? "var(--theme-accent)" : "var(--theme-panel-raised)",
                                color: msg.role === "user" ? "var(--theme-active-text)" : "var(--theme-text)",
                                padding: "10px 14px",
                                borderRadius: msg.role === "user"
                                    ? "12px 12px 2px 12px"
                                    : "12px 12px 12px 2px",
                                maxWidth: "88%", fontSize: "0.88rem",
                                lineHeight: 1.6, whiteSpace: "pre-wrap"
                            }}>
                                {msg.text}
                            </div>
                        ))}
                        {loading && (
                            <div style={{ color: "var(--theme-muted)", fontSize: "0.82rem", padding: "4px 0" }}>
                                AI is thinking...
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div style={{
                        padding: "10px 12px", borderTop: "1px solid var(--theme-border)",
                        display: "flex", gap: 8
                    }}>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                            placeholder={isStaff
                                ? "e.g. Generate 5 questions about loops..."
                                : "Ask about this course..."}
                            style={{
                                flex: 1, padding: "10px 12px",
                                background: "var(--theme-panel-raised)", border: "1px solid var(--theme-border)",
                                borderRadius: 8, color: "var(--theme-text)", fontSize: "0.88rem"
                            }}
                        />
                        <button onClick={send} disabled={loading || !input.trim()}
                                style={{
                                    padding: "10px 14px",
                                    background: loading || !input.trim() ? "var(--theme-panel-raised)" : "var(--theme-accent)",
                                    border: "none", borderRadius: 8,
                                    color: loading || !input.trim() ? "var(--theme-muted)" : "var(--theme-active-text)",
                                    fontWeight: 700, cursor: "pointer", fontSize: "1rem"
                                }}>
                            ➤
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIAssistant;