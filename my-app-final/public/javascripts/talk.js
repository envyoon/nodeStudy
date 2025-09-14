/* ==============================
 * 공통 상수/유틸
 * ============================== */
const AUTH_USER_KEY = "auth:user:v1";
const LAST_EMAIL_KEY = "contents:lastEmail";

const nowHHMM = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

// axios 전역 설정 (동일 출처 쿠키 자동 포함)
if (!window.axios) throw new Error("axios not loaded");
window.axios.defaults.withCredentials = true;

const httpPost = async (url, bodyJSON) => window.axios.post(url, bodyJSON);
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
  if (!auth) {
    sessionStorage.removeItem(AUTH_USER_KEY);
    return;
  }
  sessionStorage.setItem(
    AUTH_USER_KEY,
    JSON.stringify({
      provider: auth.provider || null,
      id: auth.id ?? null,
      email: auth.email ?? null,
      nickname: auth.nickname ?? null,
      ts: Date.now(),
    })
  );
  if (auth.email) sessionStorage.setItem(LAST_EMAIL_KEY, auth.email);
};

/* ==============================
 * 연결 상태 표시
 * ============================== */
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

/* ==============================
 * 메시지 UI
 * ============================== */
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

/* ==============================
 * 입력창 사이즈 & 이벤트
 * ============================== */
const autosize = (ta) => {
  if (!ta) return;
  ta.style.height = "auto";
  ta.style.height = Math.min(160, ta.scrollHeight) + "px";
};

const onInput = () => {
  const input = document.getElementById("message-input");
  autosize(input);
  // TODO: socket.emit('chat:typing', true/false)
};

/* ==============================
 * 전송/수신
 * ============================== */
const sendMessage = () => {
  const input = document.getElementById("message-input");
  if (!input) return;
  const text = (input.value || "").trim();
  if (!text) return;

  const meName = window.__ME_NAME__ || "Me";
  appendMessage({ text, me: true, who: meName });

  // TODO: socket.emit('chat:message', { text });

  input.value = "";
  autosize(input);
};

const onIncomingMessage = ({ text, who = "Other", time = nowHHMM() }) => {
  appendMessage({ text, me: false, who, time });
};

/* ==============================
 * 세션 동기화: 서버 → sessionStorage
 * ============================== */
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

/* ==============================
 * 로그아웃
 * ============================== */
const handleLogout = async () => {
  const provider = window.__PROVIDER__ || document.getElementById("chat-app")?.dataset.provider || "local";

  // 1) (클라) Kakao SDK 토큰 정리(있을 때)
  if (provider === "kakao" && window.Kakao) {
    try {
      if (!Kakao.isInitialized() && window.KAKAO_JS_KEY) {
        Kakao.init(window.KAKAO_JS_KEY);
      }
      if (Kakao.Auth?.getAccessToken()) {
        Kakao.Auth.logout(() => {});
      }
    } catch (e) {
      console.warn("[client kakao logout] failed:", e);
    }
  }

  // 2) (서버) 세션 삭제(/talk/logout)
  try {
    await httpPost("/talk/logout");
  } catch (e) {
    console.warn("[server logout] failed:", e);
  }

  // 3) sessionStorage 정리
  try {
    sessionStorage.removeItem(AUTH_USER_KEY);
  } catch {}

  // 4) 메인으로 이동
  window.location.replace("/main");
};

/* ==============================
 * $p 자동완성 모듈
 * ============================== */
const initAutocomplete = (inputSelector = "#message-input") => {
  const ta = document.querySelector(inputSelector);
  if (!ta) return;

  // 패널 생성
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

  // 상태
  let items = [];
  let focused = -1;
  let lastKeys = [];
  let suggestMap = {};

  const hidePanel = () => {
    panel.style.display = "none";
    panel.innerHTML = "";
    items = [];
    focused = -1;
    lastKeys = [];
    suggestMap = {};
  };

  const escapeHtml = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const renderMarkdownLite = (md = "") => {
    let safe = escapeHtml(md);
    safe = safe.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => {
      return `<pre><code class="lang-${lang || ""}">${escapeHtml(code)}</code></pre>`;
    });
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
    safe = safe.replace(/\n/g, "<br>");
    return safe;
  };

  const highlight = (idx) => {
    items.forEach((el, i) => {
      el.style.background = i === idx ? "#f3f4f6" : "transparent";
    });
    focused = idx;
  };

  const isFunctionMeta = (meta) => {
    const t = String(meta?.["!type"] || "");
    return /^fn\s*\(/i.test(t) || t.startsWith("fn(");
  };

  const applySuggestion = (word, { send = false } = {}) => {
    const meta = suggestMap[word] || {};
    const addParens = isFunctionMeta(meta);

    const v = ta.value;
    const caret = ta.selectionStart;
    const left = v.slice(0, caret);
    const idxP = left.lastIndexOf("$p");
    if (idxP < 0) return hidePanel();

    const seg = left.slice(idxP);
    const lastDot = seg.lastIndexOf(".");
    const replaceStart = lastDot >= 0 ? idxP + lastDot + 1 : idxP + 2;

    const before = v.slice(0, replaceStart);
    const after = v.slice(caret);
    const mid = addParens ? `${word}()` : word;

    const next = before + mid + after;
    ta.value = next;

    // 커서: 함수면 괄호 안
    const newCaret = addParens ? before.length + word.length + 1 : before.length + mid.length;
    ta.setSelectionRange(newCaret, newCaret);

    hidePanel();
    ta.focus();

    if (send && typeof sendMessage === "function") {
      sendMessage();
    }
  };

  const renderPanel = (resultObj) => {
    const keys = Object.keys(resultObj || {});
    lastKeys = keys.slice();
    suggestMap = resultObj || {};

    if (keys.length === 0) return hidePanel();

    if (keys.length > 1) {
      panel.innerHTML = `
        <div style="margin-bottom:6px;color:#6b7280">사용가능 함수</div>
        <div id="ac-list"></div>
      `;
      const list = panel.querySelector("#ac-list");
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
        item.onclick = () => applySuggestion(k);
        item.onmouseenter = () => highlight(idx);
        list.appendChild(item);
      });
      items = Array.from(panel.querySelectorAll(".ac-item"));
      focused = -1;
    } else {
      const k = keys[0];
      const meta = resultObj[k] || {};
      panel.innerHTML = `
        <div style="margin-bottom:6px;color:#6b7280">사용가능 함수</div>
        <div class="ac-item" role="option" style="padding:6px 8px;border-radius:8px;cursor:pointer;font-weight:700">${k}</div>
        <div style="margin-top:8px;color:#374151">${meta["!doc"] ? renderMarkdownLite(meta["!doc"]) : ""}</div>
        <div style="margin-top:8px;color:#111827">${meta["!type"] ? "<code>" + escapeHtml(meta["!type"]) + "</code>" : ""}</div>
      `;
      const it = panel.querySelector(".ac-item");
      it.onclick = () => applySuggestion(k);
      items = [it];
      focused = -1;
    }
    panel.style.display = "block";
  };

  // 입력 → 디바운스 요청
  let timer = 0;
  const debounce =
    (fn, ms = 250) =>
    (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };

  const fetchSuggest = async () => {
    const val = ta.value || "";
    if (!val.trim().startsWith("$p")) return hidePanel();
    try {
      const { data } = await window.axios.post("/auto/suggest", { key: val });
      renderPanel((data && data.result) || {});
    } catch {
      hidePanel();
    }
  };

  ta.addEventListener("input", debounce(fetchSuggest, 250));

  // 자동완성 키 처리 핸들러 — true를 리턴하면 “소비됨”
  const handleAcKeydown = (e) => {
    if (panel.style.display === "none") return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!items.length) return true;
      const next = focused < 0 ? 0 : Math.min(focused + 1, items.length - 1);
      highlight(next);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return true;
      const prev = focused < 0 ? items.length - 1 : Math.max(focused - 1, 0);
      highlight(prev);
      return true;
    }
    if (e.key === "Tab") {
      if (focused >= 0) {
        e.preventDefault();
        applySuggestion(items[focused].textContent.trim());
        return true;
      }
      return false;
    }
    if (e.key === "Enter") {
      if (focused >= 0) {
        e.preventDefault();
        applySuggestion(items[focused].textContent.trim(), {
          send: e.ctrlKey || e.metaKey,
        });
        return true;
      } else if (lastKeys.length === 1) {
        e.preventDefault();
        applySuggestion(lastKeys[0], { send: e.ctrlKey || e.metaKey });
        return true;
      }
      return false;
    }
    if (e.key === "Escape") {
      hidePanel();
      return true;
    }
    return false;
  };

  // 외부에서도 접근 가능(필요 시)
  ta.__acHandleKeydown = handleAcKeydown;

  // 포커스 아웃 시 패널 닫기
  ta.addEventListener("blur", () => setTimeout(hidePanel, 100));
};

/* ==============================
 * 초기화
 * ============================== */
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

  updateConnectionStatus("connecting");
  // TODO: socket.on('connect', () => updateConnectionStatus('connected'));
  // TODO: socket.on('disconnect', () => updateConnectionStatus('disconnected'));

  // 바인딩
  document.getElementById("btn-logout")?.addEventListener("click", handleLogout);
  document.getElementById("btn-send")?.addEventListener("click", sendMessage);

  const input = document.getElementById("message-input");
  if (input) {
    // 자동완성 초기화
    initAutocomplete("#message-input");

    input.addEventListener("input", onInput);

    input.addEventListener("keydown", (e) => {
      // 1) 자동완성 패널이 처리할 키면 여기서 끝
      if (typeof input.__acHandleKeydown === "function") {
        const consumed = input.__acHandleKeydown(e);
        if (consumed) return;
      }
      // 2) 기본 엔터 동작 유지: Enter=전송 / Shift+Enter=줄바꿈
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    autosize(input);
  }

  // 환영 메시지(옵션)
  appendMessage({ text: "채팅에 오신 걸 환영합니다!", who: "System" });
});

// 디버그용(선택)
window.ChatUI = {
  updateConnectionStatus,
  appendMessage,
  onIncomingMessage,
  syncAuthToSessionStorage,
};
