/* =================================================================================
 * talk.js — 채팅(소켓) + 세션 동기화 + $p. 자동완성(클래식)
 * ================================================================================= */

/*********************************************************************************
 * ============================ [START] 전역 상수 / 설정 ============================
 *********************************************************************************/

const AUTH_USER_KEY = "auth:user:v1";
/* users:v1 저장소(메인 화면에서 쓰는 로컬 계정 리스트) */
const STORAGE_USERS = "users:v1";

/* axios 존재/설정 */
if (!window.axios) throw new Error("axios not loaded");
window.axios.defaults.withCredentials = true;

/* 공통 HTTP 유틸 */
const httpPost = (url, bodyJSON) => window.axios.post(url, bodyJSON);
const httpGetJSON = async (url) => {
  const res = await window.axios.get(url);
  if (res.status === 204) return null;
  return res.data;
};

/*********************************************************************************
 * ============================= [END] 전역 상수 / 설정 =============================
 *********************************************************************************/

/*********************************************************************************
 * ================================= [START] 공용 유틸 ==============================
 *********************************************************************************/

/** HH:mm 시각 문자열 */
const nowHHMM = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 상단 내 이름 표시 */
const setMeUI = (name) => {
  const meSpan = document.getElementById("me-name");
  if (meSpan) meSpan.textContent = name || "";
};

/** 세션스토리지에 로그인 메타 저장 */
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
  try {
    if (auth.email) sessionStorage.setItem(LAST_EMAIL_KEY, auth.email);
  } catch {}
};

/** ★ 결제 동기화: 서버가 paid:true면 users:v1에도 반영 */
const upsertUserPaid = ({ email, id }, paid = true) => {
  try {
    const list = JSON.parse(sessionStorage.getItem(STORAGE_USERS) || "[]");
    let found = false;
    const norm = (s) =>
      String(s || "")
        .trim()
        .toLowerCase();

    const next = list.map((u) => {
      if (!u) return u;
      const hit = (email && u.email && norm(u.email) === norm(email)) || (id && u.id && norm(u.id) === norm(id));
      if (hit) {
        found = true;
        return { ...u, paid: !!paid };
      }
      return u;
    });

    if (!found && (email || id)) {
      next.push({ email: email || null, id: id || null, pw: "", paid: !!paid });
    }
    sessionStorage.setItem(STORAGE_USERS, JSON.stringify(next));
  } catch {}
};

/*********************************************************************************
 * ================================ [END] 공용 유틸 =================================
 *********************************************************************************/

/*********************************************************************************
 * ===================== [START] 말풍선 Resize 관찰 유틸 ============================
 *********************************************************************************/

// 말풍선 하이라이트(잠깐 색 → 자동 원복)
const __bubbleFlashTimers = new WeakMap();
const flashBubble = (el, color = "#FFF3A6", ms = 350) => {
  if (!el) return;
  el.style.transition = el.style.transition || "background-color 120ms ease";
  el.style.backgroundColor = color;
  const old = __bubbleFlashTimers.get(el);
  if (old) clearTimeout(old);
  __bubbleFlashTimers.set(el, t);
};

const makeBubbleResizable = (bubble) => {
  if (!bubble) return;
  if (bubble.querySelector(".resizer")) return;

  // 버블이 포지셔닝 기준이 되도록 (디자인 깨지지 않음)
  if (!bubble.style.position) bubble.style.position = "relative";
  if (!bubble.style.boxSizing) bubble.style.boxSizing = "border-box";

  // 핸들 추가 + 최소한의 스타일(보더만 보이게)
  const handle = document.createElement("span");
  handle.className = "resizer";
  Object.assign(handle.style, {
    position: "absolute",
    right: "6px",
    bottom: "4px",
    width: "14px",
    height: "14px",
    cursor: "se-resize",
    opacity: "0.35",
    userSelect: "none",
    pointerEvents: "auto",
    // 핸들 표시(대각선) — CSS 없이도 보이도록
    borderRight: "2px solid #bbb",
    borderBottom: "2px solid #bbb",
    borderBottomRightRadius: "2px",
  });
  bubble.appendChild(handle);

  const MIN_W = 120;
  const MIN_H = 40;
  const getMaxWidth = () => {
    const list = document.getElementById("messages");
    const pad = 64;
    return list ? Math.max(160, list.clientWidth - pad) : 600;
  };

  let drag = null;

  const onMove = (e) => {
    if (!drag) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - drag.startX;
    const dy = p.clientY - drag.startY;

    const w = Math.max(MIN_W, Math.min(getMaxWidth(), drag.startW + dx));
    bubble.style.width = w + "px";

    let h;
    if (drag.withHeight) {
      h = Math.max(MIN_H, drag.startH + dy);
      bubble.style.height = h + "px";
    }

    // ▶ 크기 변화 방향에 따라 색 반짝임
    const prevW = drag.prevW ?? drag.startW;
    const prevH = drag.prevH ?? drag.startH;
    const grew = w > prevW || (drag.withHeight && h > prevH);
    const shrank = w < prevW || (drag.withHeight && h < prevH);
    if (grew) flashBubble(bubble, "#FFF3A6"); // 커짐 → 노랑
    if (shrank) flashBubble(bubble, "#C8FFD6"); // 작아짐 → 초록
    drag.prevW = w;
    if (drag.withHeight) drag.prevH = h;

    e.preventDefault();
  };

  const stop = () => {
    if (!drag) return;
    drag = null;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", stop);
    document.removeEventListener("touchmove", onMove, { passive: false });
    document.removeEventListener("touchend", stop);
    document.body.style.userSelect = "";
  };

  const start = (e) => {
    const p = e.touches ? e.touches[0] : e;
    drag = {
      startX: p.clientX,
      startY: p.clientY,
      startW: bubble.offsetWidth,
      startH: bubble.offsetHeight,
      withHeight: e.shiftKey || (e.touches && e.touches.length === 2),
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", stop);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", stop);
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  handle.addEventListener("mousedown", start);
  handle.addEventListener("touchstart", start, { passive: false });

  bubble.addEventListener("dblclick", () => {
    bubble.style.width = "";
    bubble.style.height = "";
  });
};

/*********************************************************************************
 * ====================== [END] 말풍선 Resize 관찰 유틸 =============================
 *********************************************************************************/

/*********************************************************************************
 * ======================= [START] 연결 상태 / 프레즌스 UI ==========================
 *********************************************************************************/

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

/*********************************************************************************
 * ======================== [END] 연결 상태 / 프레즌스 UI ===========================
 *********************************************************************************/

/*********************************************************************************
 * ========================= [START] 메시지 UI / 전송 로직 ==========================
 *********************************************************************************/

/** 메시지 리스트에 하나 추가 */
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
  // observeMessageBubble(bubble);
  makeBubbleResizable(bubble);
};

/** 입력창 자동 높이 */
const autosize = (ta) => {
  if (!ta) return;
  ta.style.height = "auto";
  ta.style.height = Math.min(160, ta.scrollHeight) + "px";
};

/** 소켓 타이핑 알림 */
let socket = null;
let typingTimer = null;
const emitTyping = (on) => socket && socket.emit("chat:typing", !!on);

/** 입력 이벤트(사이즈/타이핑) */
const onInput = () => {
  const input = document.getElementById("message-input");
  autosize(input);

  // typing on
  emitTyping(true);
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => emitTyping(false), 700);
};

/** 전송 버튼/Enter 전송 */
const sendMessage = () => {
  const input = document.getElementById("message-input");
  if (!input) return;

  // 자동완성 패널이 열려 있으면 먼저 확정
  if (AC.visible) {
    const accepted = AC.acceptCurrent(); // ★ 없던 함수 추가
    if (accepted) return; // 한 번 더 Enter 하면 전송
  }

  const text = (input.value || "").trim();
  if (!text) return;

  const meName = window.__ME_NAME__ || "Me";
  appendMessage({ text, me: true, who: meName });

  socket && socket.emit("chat:message", { text });

  input.value = "";
  autosize(input);
};

/*********************************************************************************
 * ========================== [END] 메시지 UI / 전송 로직 ===========================
 *********************************************************************************/

/*********************************************************************************
 * ===================== [START] 서버 세션 → 세션스토리지 동기화 ====================
 *********************************************************************************/

const syncAuthToSessionStorage = async () => {
  try {
    const me = await httpGetJSON("/auth/me");
    if (!me) {
      saveAuthToSession(null);
      return null;
    }
    saveAuthToSession(me);

    if (me.paid) upsertUserPaid({ email: me.email, id: me.id }, true);

    const displayName = me.email || me.nickname || `U-${me.id}`;
    window.__ME_NAME__ = displayName;
    window.__PROVIDER__ = me.provider || "local";
    setMeUI(displayName);
    return me;
  } catch (e) {
    console.warn("[/auth/me] failed:", e);
    return null;
  }
};

/*********************************************************************************
 * ====================== [END] 서버 세션 → 세션스토리지 동기화 =====================
 *********************************************************************************/

/*********************************************************************************
 * =============================== [START] 로그아웃 ================================
 *********************************************************************************/

/**
 * 로그아웃 로직입니다.
 * 해당 버튼을 클릭하면 로그인 세션을 제거합니다.
 */
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
    await httpPost("/auth/logout");
  } catch {}
  try {
    sessionStorage.removeItem(AUTH_USER_KEY);
  } catch {}
  window.location.replace("/main");
};

/*********************************************************************************
 * ================================ [END] 로그아웃 =================================
 *********************************************************************************/

/*********************************************************************************
 * ===================== [START] $p. 자동완성(클래식) 모듈 ==========================
 *********************************************************************************/

/* 모듈 상태 */
let AC = {
  panel: null,
  items: [],
  index: -1,
  visible: false,
  meta: {},
  lastKeys: [],
};

/** 패널 DOM 생성 */
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

/** 패널 숨김 */
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

/** 안전한 마크업 */
const escapeHtml = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 라이트한 마크다운 렌더 */
const renderMarkdownLite = (md = "") => {
  let safe = escapeHtml(md);
  safe = safe.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => `<pre><code class="lang-${lang || ""}">${escapeHtml(code)}</code></pre>`);
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\n/g, "<br>");
  return safe;
};

/** 리스트 하이라이트 */
const highlight = (idx) => {
  const nodes = AC.panel?.querySelectorAll(".ac-item");
  if (!nodes) return;
  nodes.forEach((el, i) => (el.style.background = i === idx ? "#f3f4f6" : "transparent"));
  AC.index = idx;
};

/** 현재 줄의 $p 세그먼트 추출 */
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

/** 타입이 함수형인지 */
const isFnType = (meta) => {
  const t = String(meta?.["!type"] || "");
  return /^fn\s*\(/i.test(t) || t.startsWith("fn(");
};

/** 자동완성 항목 적용 */
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

/** 패널 렌더 */
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

/** 자동완성 쿼리 */
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

/** 입력 연동(자동완성) */
const onInputAC = () => {
  onInput(); // 사이즈/타이핑
  debounceQuery(); // 자동완성 질의
};

/** 키다운(자동완성) */
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

/** 현재 하이라이트 항목 확정(Enter/toggle) */
AC.acceptCurrent = () => {
  if (!AC.visible) return false;
  const key = AC.items[AC.index] || AC.lastKeys[0];
  if (!key) return false;
  applyCompletion(key);
  hidePanel();
  return true;
};

/** 초기 바인딩 */
const initAutocompleteClassic = () => {
  buildClassicPanel();
  const input = document.getElementById("message-input");
  if (!input) return;
  input.addEventListener("input", onInputAC);
  input.addEventListener("keydown", onKeydownAC);
};

/*********************************************************************************
 * ====================== [END] $p. 자동완성(클래식) 모듈 ===========================
 *********************************************************************************/

/*********************************************************************************
 * ============================ [START] 초기화 / 바인딩 ============================
 *********************************************************************************/

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

  try {
    const opts = { withCredentials: true };
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


/*********************************************************************************
 * ============================= [END] 초기화 / 바인딩 =============================
 *********************************************************************************/
