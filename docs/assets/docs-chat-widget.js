(() => {
  if (document.getElementById("docs-chat-root")) return;

  const apiBase = window.DOCS_CHAT_API_URL || "http://localhost:3001";

  const style = document.createElement("style");
  style.textContent = `
#docs-chat-root { position: fixed; right: 20px; bottom: 20px; z-index: 9999; font-family: inherit; }
#docs-chat-root.docs-chat-expanded { right: 0; bottom: 0; }
:root {
  --docs-chat-accent: #FF5A36;
  --docs-chat-text: #121212;
  --docs-chat-muted: #4b4b4b;
  --docs-chat-panel: rgba(255, 255, 255, 0.78);
  --docs-chat-panel-border: rgba(17, 17, 17, 0.08);
  --docs-chat-surface: rgba(255, 255, 255, 0.6);
  --docs-chat-shadow: 0 18px 50px rgba(0,0,0,0.18);
}
html[data-theme="dark"] {
  --docs-chat-text: #ececec;
  --docs-chat-muted: #b7b7b7;
  --docs-chat-panel: rgba(20, 20, 20, 0.78);
  --docs-chat-panel-border: rgba(255, 255, 255, 0.1);
  --docs-chat-surface: rgba(24, 24, 24, 0.65);
  --docs-chat-shadow: 0 18px 50px rgba(0,0,0,0.45);
}
#docs-chat-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(140deg, rgba(255,90,54,0.25), rgba(255,90,54,0.06));
  color: var(--docs-chat-text);
  border: 1px solid rgba(255,90,54,0.4);
  border-radius: 999px;
  padding: 10px 14px;
  cursor: pointer;
  box-shadow: 0 8px 30px rgba(255,90,54, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
#docs-chat-button span { font-weight: 600; letter-spacing: 0.2px; }
.docs-chat-logo { width: 20px; height: 20px; }
#docs-chat-panel {
  width: 360px;
  height: 460px;
  background: var(--docs-chat-panel);
  color: var(--docs-chat-text);
  border-radius: 16px;
  border: 1px solid var(--docs-chat-panel-border);
  box-shadow: var(--docs-chat-shadow);
  display: none;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
#docs-chat-root.docs-chat-expanded #docs-chat-panel {
  width: min(520px, 100vw);
  height: 100vh;
  border-radius: 18px 0 0 18px;
}
#docs-chat-header {
  padding: 12px 14px;
  font-weight: 600;
  border-bottom: 1px solid var(--docs-chat-panel-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
#docs-chat-header-title { display: inline-flex; align-items: center; gap: 8px; }
#docs-chat-header-title span { color: var(--docs-chat-text); }
#docs-chat-header-actions { display: inline-flex; align-items: center; gap: 6px; }
.docs-chat-icon-button {
  border: 1px solid var(--docs-chat-panel-border);
  background: transparent;
  color: inherit;
  border-radius: 8px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
#docs-chat-messages { flex: 1; padding: 12px 14px; overflow: auto; background: transparent; }
#docs-chat-input {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--docs-chat-panel-border);
  background: var(--docs-chat-surface);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
#docs-chat-input textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--docs-chat-panel-border);
  border-radius: 10px;
  padding: 9px 10px;
  font-size: 13px;
  color: var(--docs-chat-text);
  background: rgba(255,255,255,0.7);
}
html[data-theme="dark"] #docs-chat-input textarea { background: rgba(15,15,15,0.7); }
#docs-chat-send {
  background: var(--docs-chat-accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
}
.docs-chat-bubble {
  margin-bottom: 10px;
  padding: 9px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  max-width: 90%;
}
.docs-chat-user {
  background: var(--docs-chat-accent);
  color: #fff;
  align-self: flex-end;
}
.docs-chat-assistant {
  background: rgba(255, 255, 255, 0.7);
  color: var(--docs-chat-text);
  border: 1px solid var(--docs-chat-panel-border);
}
html[data-theme="dark"] .docs-chat-assistant { background: rgba(20, 20, 20, 0.7); }
`;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "docs-chat-root";

  const button = document.createElement("button");
  button.id = "docs-chat-button";
  button.type = "button";
  button.innerHTML =
    `<img class="docs-chat-logo" src="/assets/pixel-lobster.svg" alt="OpenClaw">` +
    `<span>Ask Molty</span>`;

  const panel = document.createElement("div");
  panel.id = "docs-chat-panel";
  panel.style.display = "none";

  const header = document.createElement("div");
  header.id = "docs-chat-header";
  header.innerHTML =
    `<div id="docs-chat-header-title">` +
    `<img class="docs-chat-logo" src="/assets/pixel-lobster.svg" alt="OpenClaw">` +
    `<span>OpenClaw Docs</span>` +
    `</div>` +
    `<div id="docs-chat-header-actions"></div>`;
  const headerActions = header.querySelector("#docs-chat-header-actions");
  const expand = document.createElement("button");
  expand.type = "button";
  expand.className = "docs-chat-icon-button";
  expand.setAttribute("aria-label", "Expand");
  expand.textContent = "⤢";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "docs-chat-icon-button";
  clear.setAttribute("aria-label", "Clear chat");
  clear.textContent = "⌫";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "docs-chat-icon-button";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  headerActions.appendChild(expand);
  headerActions.appendChild(clear);
  headerActions.appendChild(close);

  const messages = document.createElement("div");
  messages.id = "docs-chat-messages";

  const inputWrap = document.createElement("div");
  inputWrap.id = "docs-chat-input";
  const textarea = document.createElement("textarea");
  textarea.rows = 2;
  textarea.placeholder = "Ask about OpenClaw Docs...";
  const send = document.createElement("button");
  send.id = "docs-chat-send";
  send.type = "button";
  send.textContent = "Send";

  inputWrap.appendChild(textarea);
  inputWrap.appendChild(send);

  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(inputWrap);

  root.appendChild(button);
  root.appendChild(panel);
  document.body.appendChild(root);

  const addBubble = (text, role) => {
    const bubble = document.createElement("div");
    bubble.className =
      "docs-chat-bubble " +
      (role === "user" ? "docs-chat-user" : "docs-chat-assistant");
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  };

  let isExpanded = false;
  const setOpen = (isOpen) => {
    panel.style.display = isOpen ? "flex" : "none";
    button.style.display = isOpen ? "none" : "inline-flex";
    root.classList.toggle("docs-chat-expanded", isOpen && isExpanded);
    if (isOpen) textarea.focus();
  };

  const setExpanded = (next) => {
    isExpanded = next;
    expand.textContent = isExpanded ? "⤡" : "⤢";
    expand.setAttribute("aria-label", isExpanded ? "Collapse" : "Expand");
    if (panel.style.display !== "none") {
      root.classList.toggle("docs-chat-expanded", isExpanded);
    }
  };

  button.addEventListener("click", () => setOpen(true));
  expand.addEventListener("click", () => setExpanded(!isExpanded));
  clear.addEventListener("click", () => {
    messages.innerHTML = "";
  });
  close.addEventListener("click", () => {
    setOpen(false);
    root.classList.remove("docs-chat-expanded");
  });

  const sendMessage = async () => {
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = "";
    addBubble(text, "user");
    const assistantBubble = addBubble("...", "assistant");
    assistantBubble.textContent = "";

    try {
      const response = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!response.body) {
        assistantBubble.textContent = await response.text();
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        assistantBubble.textContent = fullText;
        messages.scrollTop = messages.scrollHeight;
      }
    } catch (err) {
      assistantBubble.textContent = "Failed to reach docs chat API.";
    }
  };

  send.addEventListener("click", sendMessage);
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
})();
