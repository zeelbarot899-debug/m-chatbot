/* ============================================================
   CONFIG — point this at your deployed Flask backend
   ============================================================ */
const MW_CONFIG = {
  apiUrl: "https://m-chatbot-seven.vercel.app/webhook/chat", // <-- change this
  welcomeMessage:
    "Hi! I'm the Meesho Assistant. Ask me about a product, its availability, pricing, delivery time, or your order — I'll do my best to help.",
};

(function () {
  "use strict";

  const widget   = document.getElementById("meesho-widget");
  const launcher = document.getElementById("mw-launcher");
  const closeBtn = document.getElementById("mw-close");
  const panel    = document.getElementById("mw-panel");
  const thread   = document.getElementById("mw-thread");
  const form     = document.getElementById("mw-form");
  const input    = document.getElementById("mw-input");
  const sendBtn  = document.getElementById("mw-send");
  const quickrow = document.getElementById("mw-quickrow");

  let hasOpenedOnce = false;
  let isSending = false;

  /* ---------- session id (persisted per browser) ---------- */
  function getSessionId() {
    const key = "mw_session_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, id);
    }
    return id;
  }

  /* ---------- open / close ---------- */
  function openPanel() {
    widget.classList.add("mw-open");
    launcher.setAttribute("aria-expanded", "true");
    panel.setAttribute("aria-hidden", "false");
    if (!hasOpenedOnce) {
      hasOpenedOnce = true;
      addBotMessage(MW_CONFIG.welcomeMessage);
    }
    setTimeout(() => input.focus(), 200);
  }

  function closePanel() {
    widget.classList.remove("mw-open");
    launcher.setAttribute("aria-expanded", "false");
    panel.setAttribute("aria-hidden", "true");
  }

  launcher.addEventListener("click", () => {
    widget.classList.contains("mw-open") ? closePanel() : openPanel();
  });
  closeBtn.addEventListener("click", closePanel);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && widget.classList.contains("mw-open")) closePanel();
  });

  /* ---------- rendering helpers ---------- */

  // Escape raw HTML so user/bot text can never inject markup.
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Convert Markdown-style [text](url) links into safe <a> tags.
  // Only http(s) URLs are allowed through.
  function renderMarkdownLinks(escapedText) {
    return escapedText.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (match, label, url) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );
  }

  // Optional convention: backend can prefix a line with [[IN_STOCK]] or
  // [[OUT_OF_STOCK]] to render a small availability chip above the message.
  function extractStockTag(rawText) {
    const match = rawText.match(/^\[\[(IN_STOCK|OUT_OF_STOCK)\]\]\s*/);
    if (!match) return { tag: null, text: rawText };
    return { tag: match[1], text: rawText.slice(match[0].length) };
  }

  function addRow(role) {
    const row = document.createElement("div");
    row.className = "mw-row mw-row--" + role;

    if (role === "bot") {
      const avatar = document.createElement("div");
      avatar.className = "mw-avatar";
      row.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "mw-bubble";
    row.appendChild(bubble);

    thread.appendChild(row);
    thread.scrollTop = thread.scrollHeight;
    return bubble;
  }

  function addUserMessage(text) {
    const bubble = addRow("user");
    bubble.textContent = text;
    thread.scrollTop = thread.scrollHeight;
  }

  function addBotMessage(rawText) {
    const { tag, text } = extractStockTag(rawText);
    const bubble = addRow("bot");

    let html = "";
    if (tag === "IN_STOCK") {
      html += `<span class="mw-stock mw-stock--in">In stock</span><br/>`;
    } else if (tag === "OUT_OF_STOCK") {
      html += `<span class="mw-stock mw-stock--out">Out of stock</span><br/>`;
    }
    html += renderMarkdownLinks(escapeHtml(text)).replace(/\n/g, "<br/>");

    bubble.innerHTML = html;
    thread.scrollTop = thread.scrollHeight;
  }

  function showTyping() {
    const row = document.createElement("div");
    row.className = "mw-row mw-row--bot";
    row.id = "mw-typing-row";

    const avatar = document.createElement("div");
    avatar.className = "mw-avatar";

    const bubble = document.createElement("div");
    bubble.className = "mw-bubble";
    bubble.innerHTML = '<div class="mw-typing"><span></span><span></span><span></span></div>';

    row.appendChild(avatar);
    row.appendChild(bubble);
    thread.appendChild(row);
    thread.scrollTop = thread.scrollHeight;
  }

  function hideTyping() {
    const row = document.getElementById("mw-typing-row");
    if (row) row.remove();
  }

  /* ---------- sending messages ---------- */
  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    isSending = true;
    sendBtn.disabled = true;
    addUserMessage(trimmed);
    input.value = "";
    showTyping();

    try {
      const response = await fetch(MW_CONFIG.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatInput: trimmed,
          sessionId: getSessionId(),
        }),
      });

      if (!response.ok) throw new Error("Request failed with status " + response.status);

      const data = await response.json();
      hideTyping();
      addBotMessage(data.output || "Sorry, I didn't get a response. Please try again.");
    } catch (err) {
      hideTyping();
      addBotMessage(
        "Sorry, I'm having trouble connecting right now. Please try again in a moment."
      );
      console.error("Meesho Assistant error:", err);
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });

  quickrow.addEventListener("click", (e) => {
    const chip = e.target.closest(".mw-chip");
    if (!chip) return;
    sendMessage(chip.dataset.prompt);
  });
})();
