/* ==============================
 * talk.js — socket + $p. 자동완성(클래식)
 * ============================== */
const AUTH_USER_KEY = "auth:user:v1";
const LAST_EMAIL_KEY = "contents:lastEmail";

/* ------------ 공용 유틸 ------------ */
const nowHHMM = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};
if (!window.axios) throw new Error("axios not loaded");
window.axios.defaults.withCredentials = true;
const httpPost = (url, bodyJSON) => window.axios.post(url, bodyJSON);
const httpGetJSON = async (url) => {
  const res = await window.axios.get(url);
  if (res.status === 204) return null;
  return res.data;
};
const setMeUI = (name) => {
  const meSpan = document.getElementById("me-name");
  if (meSpan) meSpan.textContent = name || "";
};
const saveAuthToSession = (auth) => {
  if (!auth) return sessionStorage.removeItem(AUTH_USER_KEY);
  sessionStorage.setItem(
    AUTH_USER_KEY,
    JSON.stringify({
      provider: auth.provider || null,
      id: auth.id ?? null,
      email: auth.email ?? null,
      nickname: auth.nickname ?? null,
      paid: !!auth.paid,
      ts: Date.now(),
    })
  );
};

/* ------------ 연결 상태/프레즌스 ------------ */
const updateConnectionStatus = (state) => {
  const badge = document.getElementById("conn-status");
  if (!badge) return;
  if (state === "connected") {
    badge.textContent = "연결됨";
    badge.className = "badge badge--ok";
  } else if (state === "disconnected") {
    badge.textContent = "연결 끊김";
    badge.className = "badge badge--error";
  } else {
    badge.textContent = "연결 중…";
    badge.className = "badge badge--warn";
  }
};
const updatePresence = (n) => {
  const el = document.getElementById("online-count");
  if (el) el.textContent = `온라인 ${n}`;
};

/* ------------ 메시지 UI ------------ */
const appendMessage = ({ text, me = false, who = "?", time = nowHHMM() }) => {
  const list = document.getElementById("messages");
  if (!list) return;

  const li = document.createElement("li");
  li.className = `message ${me ? "message--me" : "message--other"}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = (who || "?").charAt(0).toUpperCase();

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const txt = document.createElement("div");
  txt.className = "text";
  txt.textContent = text;

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = time;

  bubble.appendChild(txt);
  bubble.appendChild(meta);
  li.appendChild(avatar);
  li.appendChild(bubble);
  list.appendChild(li);
  list.scrollTop = list.scrollHeight;
};

/* ------------ 소켓 ------------ */
let socket = null;
let typingTimer = null;
const emitTyping = (on) => socket && socket.emit("chat:typing", !!on);

/* ------------ 입력 UX / 전송 ------------ */
const autosize = (ta) => {
  if (!ta) return;
  ta.style.height = "auto";
  ta.style.height = Math.min(160, ta.scrollHeight) + "px";
};
const onInput = () => {
  const input = document.getElementById("message-input");
  autosize(input);

  // typing on
  emitTyping(true);
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => emitTyping(false), 700);
};
const sendMessage = () => {
  const input = document.getElementById("message-input");
  if (!input) return;

  // 자동완성 패널이 열려 있으면 먼저 확정
  if (AC.visible) {
    AC.acceptCurrent();
    return; // 한 번 더 Enter 하면 전송
  }

  const text = (input.value || "").trim();
  if (!text) return;

  const meName = window.__ME_NAME__ || "Me";
  appendMessage({ text, me: true, who: meName });

  socket && socket.emit("chat:message", { text });

  input.value = "";
  autosize(input);
};

/* ------------ 서버-세션 → 세션스토리지 ------------ */
const syncAuthToSessionStorage = async () => {
  try {
    const me = await httpGetJSON("/talk/me");
    if (!me) {
      saveAuthToSession(null);
      return null;
    }
    saveAuthToSession(me);
    const displayName = me.email || me.nickname || `U-${me.id}`;
    window.__ME_NAME__ = displayName;
    window.__PROVIDER__ = me.provider || "local";
    setMeUI(displayName);
    return me;
  } catch (e) {
    console.warn("[/talk/me] failed:", e);
    return null;
  }
};

/* ------------ 로그아웃 ------------ */
const handleLogout = async () => {
  const provider = window.__PROVIDER__ || document.getElementById("chat-app")?.dataset.provider || "local";
  if (provider === "kakao" && window.Kakao) {
    try {
      if (!Kakao.isInitialized() && window.KAKAO_JS_KEY) Kakao.init(window.KAKAO_JS_KEY);
      if (Kakao.Auth?.getAccessToken()) Kakao.Auth.logout(() => {});
    } catch (e) {
      console.warn("[client kakao logout] failed:", e);
    }
  }
  try {
    await httpPost("/talk/logout");
  } catch {}
  try {
    sessionStorage.removeItem(AUTH_USER_KEY);
  } catch {}
  window.location.replace("/main");
};

/* ==================================================================
 *                 ⬇⬇⬇  $p. 자동완성 (클래식)  ⬇⬇⬇
 * ================================================================== */
let AC = {
  panel: null,
  items: [],
  index: -1,
  visible: false,
  meta: {},
  lastKeys: [],
};

const buildClassicPanel = () => {
  if (AC.panel) return;

  const chatCard = document.getElementById("chat-app");
  if (!chatCard) return;
  chatCard.style.position = chatCard.style.position || "relative";

  const panel = document.createElement("div");
  panel.id = "ac-panel";
  Object.assign(panel.style, {
    display: "none",
    position: "absolute",
    left: "10px",
    right: "10px",
    bottom: "64px",
    background: "#fff",
    border: "1px solid var(--line)",
    borderRadius: "10px",
    boxShadow: "0 8px 24px rgba(0,0,0,.06)",
    padding: "8px",
    fontSize: "13px",
    zIndex: 5,
  });
  panel.setAttribute("role", "listbox");
  chatCard.appendChild(panel);

  AC.panel = panel;
};

const hidePanel = () => {
  if (!AC.panel) return;
  AC.panel.style.display = "none";
  AC.panel.innerHTML = "";
  AC.visible = false;
  AC.items = [];
  AC.meta = {};
  AC.index = -1;
  AC.lastKeys = [];
};

const escapeHtml = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const renderMarkdownLite = (md = "") => {
  let safe = escapeHtml(md);
  safe = safe.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => `<pre><code class="lang-${lang || ""}">${escapeHtml(code)}</code></pre>`);
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\n/g, "<br>");
  return safe;
};

const highlight = (idx) => {
  const nodes = AC.panel?.querySelectorAll(".ac-item");
  if (!nodes) return;
  nodes.forEach((el, i) => (el.style.background = i === idx ? "#f3f4f6" : "transparent"));
  AC.index = idx;
};

const getSegmentContext = () => {
  const ta = document.getElementById("message-input");
  if (!ta) return null;
  const pos = ta.selectionStart ?? ta.value.length;
  const lastNL = ta.value.lastIndexOf("\n", pos - 1);
  const lineStart = lastNL < 0 ? 0 : lastNL + 1;
  const line = ta.value.slice(lineStart, pos);
  const pIndex = line.lastIndexOf("$p");
  if (pIndex < 0) return null;
  const segment = line.slice(pIndex);
  const absStart = lineStart + pIndex;
  return { segment, absStart, caret: pos, ta };
};

const isFnType = (meta) => {
  const t = String(meta?.["!type"] || "");
  return /^fn\s*\(/i.test(t) || t.startsWith("fn(");
};

const applyCompletion = (word) => {
  const ctx = getSegmentContext();
  if (!ctx) return hidePanel();
  const { segment, absStart, caret, ta } = ctx;

  const endsWithDot = segment.endsWith(".");
  const lastDot = segment.lastIndexOf(".");
  let replaceFrom = caret;

  if (lastDot >= 0) {
    const prefixStart = absStart + lastDot + 1;
    replaceFrom = prefixStart;
  } else {
    if (!endsWithDot) {
      ta.setRangeText(".", caret, caret, "end");
    }
    replaceFrom = ta.selectionStart;
  }

  const meta = AC.meta?.[word] || {};
  const needParens = isFnType(meta);
  const insert = needParens ? `${word}()` : word;

  const before = ta.value.slice(0, replaceFrom);
  const after = ta.value.slice(caret);
  ta.value = before + insert + after;

  const newCaret = before.length + (needParens ? word.length + 1 : insert.length);
  ta.setSelectionRange(newCaret, newCaret);

  autosize(ta);
};

const renderPanel = (resultObj) => {
  if (!AC.panel) return;
  const keys = Object.keys(resultObj || {}).filter((k) => k !== "!type" && k !== "!doc");
  AC.lastKeys = keys.slice();
  AC.meta = resultObj || {};

  if (keys.length === 0) return hidePanel();

  if (keys.length > 1) {
    AC.panel.innerHTML = `
      <div style="margin-bottom:6px;color:#6b7280">사용가능 함수</div>
      <div id="ac-list"></div>
    `;
    const list = AC.panel.querySelector("#ac-list");
    keys.forEach((k, idx) => {
      const item = document.createElement("div");
      item.className = "ac-item";
      item.textContent = k;
      Object.assign(item.style, {
        padding: "6px 8px",
        borderRadius: "8px",
        cursor: "pointer",
      });
      item.setAttribute("role", "option");
      item.onclick = () => {
        applyCompletion(k);
        hidePanel();
      };
      item.onmouseenter = () => highlight(idx);
      list.appendChild(item);
    });
  } else {
    const k = keys[0];
    const meta = resultObj[k] || {};
    AC.panel.innerHTML = `
      <div style="margin-bottom:6px;color:#6b7280">사용가능 함수</div>
      <div class="ac-item" role="option" style="padding:6px 8px;border-radius:8px;cursor:pointer;font-weight:700">${k}</div>
      <div style="margin-top:8px;color:#374151">${meta["!doc"] ? renderMarkdownLite(meta["!doc"]) : ""}</div>
      <div style="margin-top:8px;color:#111827">${meta["!type"] ? "<code>" + escapeHtml(meta["!type"]) + "</code>" : ""}</div>
    `;
    const it = AC.panel.querySelector(".ac-item");
    it.onclick = () => {
      applyCompletion(k);
      hidePanel();
    };
  }

  AC.items = keys;
  AC.index = keys.length ? 0 : -1;
  AC.panel.style.display = "block";
  AC.visible = true;
};

let acDebounce = 0;
const queryAutocomplete = async () => {
  const ctx = getSegmentContext();
  if (!ctx) return hidePanel();
  try {
    const { data } = await window.axios.post("/auto/suggest", { key: ctx.ta.value });
    renderPanel((data && data.result) || {});
  } catch {
    hidePanel();
  }
};

const debounceQuery = () => {
  if (acDebounce) clearTimeout(acDebounce);
  acDebounce = setTimeout(queryAutocomplete, 200);
};

const onInputAC = () => {
  onInput(); // 사이즈/타이핑
  debounceQuery(); // 자동완성 질의
};

const onKeydownAC = (e) => {
  if (!AC.visible) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    AC.index = Math.min(AC.index + 1, AC.items.length - 1);
    highlight(AC.index);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    AC.index = Math.max(AC.index - 1, 0);
    highlight(AC.index);
  } else if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
    e.preventDefault();
    const key = AC.items[AC.index] || AC.lastKeys[0];
    if (key) applyCompletion(key);
    hidePanel();
  } else if (e.key === "Escape") {
    e.preventDefault();
    hidePanel();
  }
};

const initAutocompleteClassic = () => {
  buildClassicPanel();
  const input = document.getElementById("message-input");
  if (!input) return;
  input.addEventListener("input", onInputAC);
  input.addEventListener("keydown", onKeydownAC);
};
/* ============================== 자동완성 끝 ============================== */

/* ------------ 초기화 ------------ */
document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("chat-app");
  const ssrMe = root?.dataset.me || null;
  const ssrProvider = root?.dataset.provider || null;

  if (ssrMe) {
    window.__ME_NAME__ = ssrMe;
    setMeUI(ssrMe);
  }
  if (ssrProvider) window.__PROVIDER__ = ssrProvider;

  await syncAuthToSessionStorage();

  // ★ socket.io: 원격 소켓 URL이 있으면 그쪽으로, 없으면 같은 오리진
  try {
    const opts = { withCredentials: true };
    // 필요시 강제 웹소켓만: opts.transports = ['websocket'];
    socket = window.SOCKET_URL ? io(window.SOCKET_URL, opts) : io(opts);

    updateConnectionStatus("connecting");
    socket.on("connect", () => updateConnectionStatus("connected"));
    socket.on("disconnect", () => updateConnectionStatus("disconnected"));
    socket.on("connect_error", () => updateConnectionStatus("disconnected"));
    socket.on("presence", ({ online }) => updatePresence(online));
    socket.on("chat:message", (payload) => appendMessage({ ...payload, me: false }));

    const typingEl = document.getElementById("typing-indicator");
    let hideTimer = null;
    socket.on("chat:typing", ({ who, typing }) => {
      if (!typingEl) return;
      if (typing) {
        typingEl.style.display = "block";
        typingEl.textContent = `${who || "상대"}가 입력 중…`;
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => (typingEl.style.display = "none"), 1200);
      } else {
        typingEl.style.display = "none";
      }
    });
  } catch (e) {
    console.warn("[socket] init failed:", e);
  }

  // 자동완성
  initAutocompleteClassic();

  // 바인딩
  document.getElementById("btn-logout")?.addEventListener("click", handleLogout);
  document.getElementById("btn-send")?.addEventListener("click", sendMessage);

  // 초기 입력창 사이즈
  const input = document.getElementById("message-input");
  if (input) autosize(input);

  appendMessage({ text: "채팅에 오신 걸 환영합니다!", who: "System" });
});

// 디버그
window.ChatUI = {
  updateConnectionStatus,
  appendMessage,
  syncAuthToSessionStorage,
};
