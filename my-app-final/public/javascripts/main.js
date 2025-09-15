// 전역 설정
const KAKAO_JS_KEY = "74624c9eef1b4a521aa9a2f6c111d9a6";
const TALK_URL = "/talk";
const STORAGE_USERS = "users:v1";

/*********************************************************************************
 * ================================= [START]유틸 함수 =============================
 *********************************************************************************/

/**
 * 결제가 되었는지 되지 않았는지 SessionStorage 에서 가져오는 유틸입니다.
 * @returns
 */
const getPaidEmails = () => {
  try {
    const list = JSON.parse(sessionStorage.getItem(STORAGE_USERS) || "[]");
    return list.filter((u) => u && u.paid && u.email).map((u) => String(u.email));
  } catch {
    return [];
  }
};

/**
 * 로그인에 실패 하였을 때 왜 실패 하였는지 보여주는 유틸입니다.
 * @param {*} msg
 * @returns
 */
const showError = (msg = "") => {
  const el = document.getElementById("login-error");
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
};

/**
 * 로그인 버튼을 눌렀을 때 로그인/ 로그인 중... 으로 보여지게 하는 유틸입니다.
 * @param {*} on
 * @returns
 */
const setLoading = (on) => {
  const btn = document.getElementById("btn-login");
  if (!btn) return;
  btn.disabled = !!on;
  btn.textContent = on ? "로그인 중…" : "로그인";
};

/**
 * SessionStorage 에서 로그인 정보를 가져옵니다.
 * (users:v1 / DB 구성을 하지 않아서 SessionSorage에서 가져옴.)
 * @returns
 */
const loadUsers = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * 로그인 시 id/pw 검증을 해 주는 유틸입니다.
 * @param {*} s
 * @returns
 */
const findUser = (idOrEmail, pw) => {
  const normalize = (s) =>
    String(s ?? "")
      .trim()
      .toLowerCase();
  const needle = normalize(idOrEmail);

  return loadUsers().find((u) => u?.pw && (normalize(u.id) === needle || normalize(u.email) === needle) && u.pw === pw) || null;
};

/**
 * 엔터키를 누르면 '로그인 버튼' 을 클릭하게 하는 함수입니다.
 * @param {*} e
 */
const handleEnterKey = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleLocalLogin();
  }
};

/*********************************************************************************
 * ============================== [END]유틸 함수 =================================
 *********************************************************************************/


/*********************************************************************************
 * ============================= [START] 로그인 관련 함수 =========================
 *********************************************************************************/

/**
 * 일반 로그인 시 검증하는 로직 입니다.
 * @returns
 */
const handleLocalLogin = async () => {
  showError("");
  const id = (document.getElementById("login-id")?.value || "").trim();
  const pw = (document.getElementById("login-pw")?.value || "").trim();

  if (!id) return showError("아이디를 입력하세요.");
  if (!pw) return showError("비밀번호를 입력하세요.");

  // 관리자 바이패스
  const isAdminBypass = id === "admin" && pw === "admin";

  // 세션 스토리지에 일치하지 않는 정보가 있으면 리턴처리 해 줍니다.
  let user = null;
  if (!isAdminBypass) {
    user = findUser(id, pw);
    if (!user) return showError("아이디 또는 비밀번호가 올바르지 않습니다.");
  }

  setLoading(true);
  
  // 서버로 로그인 요청을 보냅니다. (이때, 관리자는 결제를 하지 않아도 통과합니다.)
  try {
    const res = await axios.post("/auth/local-login", isAdminBypass ? { id, email: "admin", paid: true, pw } : { id, email: user.email || id, paid: !!user.paid, pw: "" });
    const data = res.data || {};

    // paid 값 체크 후 리다이렉트 페이지를 정해줍니다.
    location.href = data.redirect || (data.requiresPayment ? "/pay" : "/talk");
  } catch (e) {
    console.error("[local login]", e);
    showError("로그인 처리 중 오류가 발생했습니다.");
  } finally {
    setLoading(false);
  }
};

/**
 * 카카오 API로 로그인 할 때 처리하는 로직입니다.
 * @returns
 */
const handleKakaoLogin = () => {
  //기본 경로
  const origin = location.origin;
  if (!Kakao || !KAKAO_JS_KEY) return alert("Kakao SDK 또는 JS 키가 없습니다.");
  if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);

  // users:v1에서 결제된 이메일들만 추출하여 state로 전달합니다.
  const statePayload = { v: 1, paidEmails: getPaidEmails() };
  const state = btoa(JSON.stringify(statePayload));

  Kakao.Auth.authorize({
    redirectUri: `${origin}${TALK_URL}`,
    prompt: "login",
    state,
  });
};

/*********************************************************************************
 * ============================= [END] 로그인 관련 함수 ===========================
 *********************************************************************************/


/*********************************************************************************
 * ========================= [START] 이벤트 리스너 관련 ===========================
 *********************************************************************************/

/**
 * 이벤트 리스너를 등록/삭제하는 부분입니다.
 */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("login-id")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("login-pw")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("btn-login")?.addEventListener("click", handleLocalLogin);
  document.getElementById("btn-kakao-login")?.addEventListener("click", handleKakaoLogin);

  window.addEventListener("beforeunload", () => {
    document.getElementById("login-id")?.removeEventListener("keydown", handleEnterKey);
    document.getElementById("login-pw")?.removeEventListener("keydown", handleEnterKey);
    document.getElementById("btn-login")?.removeEventListener("click", handleLocalLogin);
    document.getElementById("btn-kakao-login")?.removeEventListener("click", handleKakaoLogin);
  });
});

/*********************************************************************************
 * =========================== [END] 이벤트 리스너 관련 ===========================
 *********************************************************************************/
