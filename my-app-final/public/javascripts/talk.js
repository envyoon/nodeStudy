/* ==============================
 * 공통 상수/유틸
 * ============================== */
const AUTH_USER_KEY = "auth:user:v1"; // 세션스토리지에 로그인 사용자 정보 저장
const LAST_EMAIL_KEY = "contents:lastEmail"; // 자동 채움 등에 쓰던 키 (선택)
const STORAGE_USERS = "users:v1";
const loadUsers = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_USERS) || "[]");
  } catch {
    return [];
  }
};
const saveUsers = (arr) => {
  try {
    sessionStorage.setItem(STORAGE_USERS, JSON.stringify(arr));
  } catch {}
};

const nowHHMM = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

// axios 전역 설정 (동일 출처 쿠키 자동 포함)
if (!window.axios) throw new Error("axios not loaded");
window.axios.defaults.withCredentials = true;

// axios-only POST/GET
const httpPost = async (url, bodyJSON) => {
  // 204도 정상(axios는 2xx OK로 처리)
  return window.axios.post(url, bodyJSON);
};

const httpGetJSON = async (url) => {
  const res = await window.axios.get(url);
  if (res.status === 204) return null; // 미로그인 등 No Content
  return res.data; // JSON 본문
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
 * (카카오 / 일반 공통)
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

    const users = loadUsers();
    const idx = users.findIndex((u) => (me.email && u.email === me.email) || (!me.email && u.id === me.id));
    if (idx >= 0) {
      users[idx].paid = !!me.paid;
      if (!users[idx].email && me.email) users[idx].email = me.email;
    } else {
      users.push({
        id: me.id || me.email || "user",
        email: me.email || null,
        pw: null,
        paid: !!me.paid,
        provider: me.provider,
        createdAt: new Date().toISOString(),
      });
    }
    sessionStorage.setItem("users:v1", JSON.stringify(users));

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
    // sessionStorage.removeItem(LAST_EMAIL_KEY); // 필요 시 함께 제거
  } catch {}

  // 4) 메인으로 이동
  window.location.replace("/main");
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

  // 서버 세션 기준으로 sessionStorage 동기화
  await syncAuthToSessionStorage();

  // 연결 상태 (소켓 연동 전까지 임시)
  updateConnectionStatus("connecting");
  // TODO: socket.on('connect', () => updateConnectionStatus('connected'));
  // TODO: socket.on('disconnect', () => updateConnectionStatus('disconnected'));

  // 바인딩
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) btnLogout.addEventListener("click", handleLogout);

  const btnPay = document.getElementById("btn-pay");
  if (btnPay) btnPay.addEventListener("click", handlePayClick);

  const btnSend = document.getElementById("btn-send");
  if (btnSend) btnSend.addEventListener("click", sendMessage);

  const input = document.getElementById("message-input");
  if (input) {
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", (e) => {
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
