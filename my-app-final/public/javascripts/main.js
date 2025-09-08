// ── 설정
const KAKAO_JS_KEY = "74624c9eef1b4a521aa9a2f6c111d9a6";
const TALK_URL     = "/talk";   
const STORAGE_USERS = "users:v1";
const LAST_EMAIL_KEY = "contents:lastEmail";

// ── 유틸
const showError = (msg = "") => {
  const el = document.getElementById("login-error");
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
};
const setLoading = (on) => {
  const btn = document.getElementById("btn-login");
  if (!btn) return;
  btn.disabled = !!on;
  btn.textContent = on ? "로그인 중…" : "로그인";
};
const loadUsers = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};
const findUser = (id, pw) => (loadUsers().find(u => u.id === id && u.pw === pw) || null);

// ── 일반 로그인(세션스토리지 검증 + 서버세션 세팅)
const handleLocalLogin = async () => {
  showError("");
  const id = (document.getElementById("login-id")?.value || "").trim();
  const pw = (document.getElementById("login-pw")?.value || "").trim();

  if (!id) return showError("아이디를 입력하세요.");
  if (!pw) return showError("비밀번호를 입력하세요.");

  const user = findUser(id, pw);
  if (!user) return showError("아이디 또는 비밀번호가 올바르지 않습니다.");

  setLoading(true);
  try {
    // 서버 세션에 로그인 상태만 기록 (DB 없음)
    if (!window.axios) throw new Error("axios not loaded");
    await window.axios.post("/auth/local-login", { id, email: user.email || id });

    // 마지막 로그인 자동 채움 용
    sessionStorage.setItem(LAST_EMAIL_KEY, user.email || id);

    // 이동
    window.location.href = TALK_URL;
  } catch (e) {
    console.error("[local login]", e);
    showError("로그인 처리 중 오류가 발생했습니다.");
  } finally {
    setLoading(false);
  }
};

// ── 카카오 로그인
const handleKakaoLogin = () => {
  const origin = window.location.origin;
  if (!window.Kakao || !KAKAO_JS_KEY) return alert("Kakao SDK 또는 JS 키가 없습니다.");
  if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);

  Kakao.Auth.authorize({
    redirectUri: `${origin}${TALK_URL}`, // 콜백을 /talk 로
    prompt: "login",
  });
};

// ── 엔터 제출
const handleEnterKey = (e) => {
  if (e.key === "Enter") { e.preventDefault(); handleLocalLogin(); }
};

// ── 바인딩
document.addEventListener("DOMContentLoaded", () => {
  // 마지막 로그인 자동 채움
  const last = sessionStorage.getItem(LAST_EMAIL_KEY);
  if (last) { const el = document.getElementById("login-id"); if (el && !el.value) el.value = last; }

  document.getElementById("login-id")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("login-pw")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("btn-login")?.addEventListener("click", handleLocalLogin);
  document.getElementById("btn-kakao-login")?.addEventListener("click", handleKakaoLogin);
});
