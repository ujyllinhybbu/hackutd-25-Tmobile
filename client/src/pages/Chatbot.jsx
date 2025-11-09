import { useState } from "react";

function Chatbot() {
  const [messages, setMessages] = useState([
    { sender: "AI-agent", text: "Hello! How can I assist you today?" },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((msgs) => [...msgs, { sender: "user", text: input }]);
    setInput("");

    setTimeout(() => {
      setMessages((msgs) => [
        ...msgs,
        { sender: "AI-agent", text: "You said: " + input },
      ]);
    }, 800);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#fafafa",
      }}
    >
      <h2>Chatbot</h2>
      <div
        style={{ width: "100%", flex: 1, marginBottom: 12, overflowY: "auto" }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              textAlign: msg.sender === "user" ? "right" : "left",
              margin: "6px 0",
            }}
          >
            <b>{msg.sender === "user" ? "You" : "Agent"}:</b> {msg.text}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 600 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type your message..."
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={sendMessage} style={{ padding: "8px 16px" }}>
          Send
        </button>
      </div>
    </div>
  );
}

export default Chatbot;
