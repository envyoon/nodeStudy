// 세션스토리지 키들
const STORAGE_USERS = "users:v1"; // 가입 사용자 목록 [{id, email, pw, createdAt}]
const LAST_EMAIL_KEY = "contents:lastEmail";
const RETURN_URL = "/main"; // 가입 후 돌아갈 곳(메인)

// 유틸
const showError = (msg = "") => {
  const el = document.getElementById("signup-error");
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
};
const loadUsers = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_USERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveUsers = (users) => {
  try {
    sessionStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  } catch {}
};

// 검증
const isEmail = (v) => /^\S+@\S+\.\S+$/.test(v);

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

  // 메인으로 복귀
  window.location.href = RETURN_URL;
};

const handleEnterKey = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleCreate();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-create")?.addEventListener("click", handleCreate);
  document.getElementById("btn-cancel")?.addEventListener("click", () => (window.location.href = RETURN_URL));

  document.getElementById("signup-id")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("signup-email")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("signup-pw")?.addEventListener("keydown", handleEnterKey);
  document.getElementById("signup-pw2")?.addEventListener("keydown", handleEnterKey);
});
