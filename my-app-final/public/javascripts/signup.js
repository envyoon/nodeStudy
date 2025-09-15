// 전역 설정
const STORAGE_USERS = "users:v1";
const RETURN_URL = "/main";

/*********************************************************************************
 * ================================= [START]유틸 함수 =============================
 *********************************************************************************/

/**
 * 로그인에 실패 하였을 때 왜 실패 하였는지 보여주는 유틸입니다.
 * @param {*} msg
 * @returns
 */
const showError = (msg = "") => {
  const el = document.getElementById("signup-error");
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
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
 * 로그인 한 정보를 SessionStorage에 저장하는 함수입니다.
 * @param {*} users
 */
const saveUsers = (users) => {
  try {
    sessionStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  } catch {}
};

/**
 * 정상적인 이메일 인지 체크하는 함수입니다.
 * @param {*} v 
 * @returns 
 */
const isEmail = (v) => /^\S+@\S+\.\S+$/.test(v);

/**
 * 회원가입 시 검증하는 로직입니다.
 * @returns 
 */
const handleCreate = () => {
  showError("");

  const id = (document.getElementById("signup-id")?.value || "").trim();
  const email = (document.getElementById("signup-email")?.value || "").trim();
  const pw = (document.getElementById("signup-pw")?.value || "").trim();
  const pw2 = (document.getElementById("signup-pw2")?.value || "").trim();

  if (!id) return showError("아이디를 입력하세요.");
  if (id.length < 3) return showError("아이디는 3자 이상이어야 합니다.");
  if (!email) return showError("이메일을 입력하세요.");
  if (!isEmail(email)) return showError("이메일 형식이 올바르지 않습니다.");
  if (!pw) return showError("비밀번호를 입력하세요.");
  if (pw.length < 6) return showError("비밀번호는 6자 이상이어야 합니다.");
  if (pw !== pw2) return showError("비밀번호가 일치하지 않습니다.");

  const users = loadUsers();
  if (users.some((u) => u.id === id)) return showError("이미 사용 중인 아이디입니다.");
  if (users.some((u) => u.email === email)) return showError("이미 사용 중인 이메일입니다.");

  users.push({ id, email, pw, paid: false, createdAt: new Date().toISOString() });
  saveUsers(users);

  window.location.href = RETURN_URL;
};

/**
 * 엔터키를 누르면 '' 을 클릭하게 하는 함수입니다.
 * @param {*} e
 */
const handleEnterKey = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleCreate();
  }
};

/*********************************************************************************
 * ========================= [START] 이벤트 리스너 관련 ===========================
 *********************************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-create")?.addEventListener("click", handleCreate);
  document.getElementById("btn-cancel")?.addEventListener("click", () => (window.location.href = RETURN_URL));

  document.getElementById("signup-id")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("signup-email")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("signup-pw")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("signup-pw2")?.addEventListener("keydown", handleEnterKey);
});

/*********************************************************************************
 * =========================== [END] 이벤트 리스너 관련 ===========================
 *********************************************************************************/
