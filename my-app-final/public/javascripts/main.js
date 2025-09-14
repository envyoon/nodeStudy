// ── 설정
const KAKAO_JS_KEY = "74624c9eef1b4a521aa9a2f6c111d9a6";
const TALK_URL = "/talk";
const STORAGE_USERS = "users:v1";
const LAST_EMAIL_KEY = "contents:lastEmail";

// ── 유틸
const getPaidEmails = () => {
  try {
    const list = JSON.parse(sessionStorage.getItem(STORAGE_USERS) || "[]");
    return list.filter((u) => u && u.paid && u.email).map((u) => String(u.email));
  } catch {
    return [];
  }
};
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
  } catch {
    return [];
  }
};
const normalize = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase();
const findUser = (idOrEmail, pw) => {
  const needle = normalize(idOrEmail);
  return (
    loadUsers().find(
      (u) =>
        u?.pw && // 로컬 가입자만
        (normalize(u.id) === needle || normalize(u.email) === needle) &&
        u.pw === pw
    ) || null
  );
};

// ── 일반 로그인(세션스토리지 검증 + 서버세션 세팅)
const handleLocalLogin = async () => {
  showError("");
  const id = (document.getElementById("login-id")?.value || "").trim();
  const pw = (document.getElementById("login-pw")?.value || "").trim();

  if (!id) return showError("아이디를 입력하세요.");
  if (!pw) return showError("비밀번호를 입력하세요.");

  // ★ 관리자 바이패스 허용
  const isAdminBypass = id === "admin" && pw === "admin";

  // 일반 유저 검증 (sessionStorage 기반) — 관리자면 건너뜀
  let user = null;
  if (!isAdminBypass) {
    user = findUser(id, pw);
    if (!user) return showError("아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  setLoading(true);
  try {
    // 서버로 로그인 요청
    // - 관리자: pw도 함께 보냄 → 서버가 admin/admin 확인
    // - 일반: 기존과 동일
    const res = await window.axios.post(
      "/auth/local-login",
      isAdminBypass
        ? { id, email: "admin", paid: true, pw } // 관리자 바이패스: paid=true로 바로 /talk
        : { id, email: user.email || id, paid: !!user.paid, pw: "" } // pw는 사용 안하지만 필드 통일
    );

    const data = res.data || {};

    // 최근 로그인 이메일 저장(관리자도 형태 맞춰 저장)
    sessionStorage.setItem(LAST_EMAIL_KEY, isAdminBypass ? "admin" : user.email || id);

    // 서버가 내려준 redirect 로 이동(알림창 없음)
    window.location.href = data.redirect || (data.requiresPayment ? "/pay" : "/talk");
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

  // users:v1에서 결제된 이메일들만 추출 → state로 전달
  const statePayload = { v: 1, paidEmails: getPaidEmails() };
  const state = btoa(JSON.stringify(statePayload)); // ASCII만 있으니 btoa로 충분

  Kakao.Auth.authorize({
    redirectUri: `${origin}${TALK_URL}`, // 콜백을 /talk 로
    prompt: "login",
    state,
  });
};

// ── 엔터 제출
const handleEnterKey = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleLocalLogin();
  }
};

// ── 바인딩
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("login-id")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("login-pw")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("btn-login")?.addEventListener("click", handleLocalLogin);
  document.getElementById("btn-kakao-login")?.addEventListener("click", handleKakaoLogin);
});
