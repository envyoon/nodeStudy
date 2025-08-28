/**
 * 해당 부분은 전역으로 사용할 설정 입니다.
 * @KAKAO_JS_KEY : js에서 카카오에 접근하기 위한 KEY
 * @DEFAULT_USER_KEY : 로그인하지 않으면 사용할 user name
 * @STORAGE_KEY : 로컬 세션 스토리지 이름
 * @LAST_EMAIL_KEY : 마지막으로 로그인한 유저 Email
 */
const KAKAO_JS_KEY = "74624c9eef1b4a521aa9a2f6c111d9a6";
const DEFAULT_USER_KEY = "Unknown";
const STORAGE_KEY = "contents:v1";
const LAST_EMAIL_KEY = "contents:lastEmail";

// 현재 로그인한 사용자 이메일(없으면 null)
let currentUserEmail = null;

// 현재 사용할 사용자 키(로그인되어 있으면 이메일, 아니면 기본 키)
const getActiveUserKey = () => currentUserEmail || DEFAULT_USER_KEY;

// 해당 키의 배열이 없으면 생성
const ensureUserKey = (content, userKey) => {
  if (!content[userKey]) content[userKey] = [];
};

/**
 * 해당 부분은 화면을 가지고 왔을때 이벤트 리스너를 등록 해 주는 부분입니다.
 * 우선 화면이 로드되면 textarea(tbx_test)에 마우스 이벤트 리스너를 2개(focus, blur)를 등록합니다.
 * 해당 요소(textarea)에 focus가 되면 키보드 이벤트 리스너를 등록 해 주며
 * 키입력시 0.3초 기준(debounce)으로 windows.contents에 timestamp와 함께 저장합니다.
 * 포커스가 제거되면 blur처리할 때 키보드 이벤트 리스너를 제거합니다.
 * 제거와 동시에 windows.contents에 timestamp와 함께 저장합니다.
 *
 * DOM객체. addEventListener(이벤트명, 실행할 함수명, 옵션)
 */
document.addEventListener("DOMContentLoaded", () => {
  // 리스너 등록
  document.getElementById("kakaoLogin")?.addEventListener("click", kakaoLogin);
  document.getElementById("kakaoLogout")?.addEventListener("click", kakaoLogout);
  document.getElementById("clearStorage")?.addEventListener("click", clearSessionStorageAll);

  // Kakao 초기화 (SDK 가드)
  if (window.Kakao && !Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);

  // 저장소에서 값을 가져옵니다
  const restored = loadContentsFromStorage();
  window.contents = restored || { [DEFAULT_USER_KEY]: [] };

  // 현재 로그인 유저 조회
  axios
    .get("/debounce/me")
    .then((res) => {
      if (res.status === 200 && res.data && res.data.email) {
        currentUserEmail = res.data.email;
        /**
         * 세션 스토리지에서 마지막 이메일을 가지고 옵니다.
         * 만약 세션 스토리지에 이메일이 없으면 로그인한 유저 정보로 window.content 정보를 만들어 놓습니다.
         */
        const lastEmail = sessionStorage.getItem(LAST_EMAIL_KEY);

        if (lastEmail && lastEmail !== currentUserEmail) {
          window.contents[currentUserEmail] = [];
        } else {
          if (!window.contents[currentUserEmail]) {
            window.contents[currentUserEmail] = [];
          }
        }

        // 세션스토리지에 마지막 로그인된 이메일을 저장합니다.
        sessionStorage.setItem(LAST_EMAIL_KEY, currentUserEmail);
        saveContentsToStorage(window.contents);
      }
    })
    .catch(() => {});

  const el = document.getElementById("tbx_test");

  let debounce = 0;

  // 키보드 이벤트 리스너 디바운스 로직
  const key = (event) => {
    if (debounce) {
      clearTimeout(debounce);
    }
    debounce = setTimeout(() => {
      const userKey = getActiveUserKey();
      ensureUserKey(window.contents, userKey);
      valueChk(window.contents, userKey, el.value);
      saveContentsToStorage(window.contents);
    }, 300);
  };

  // 포커스 시 이벤트 리스너 등록
  el.addEventListener("focus", () => {
    el.addEventListener("keydown", key);
  });

  // 포커스 해제 시 이벤트 리스너 제거
  el.addEventListener("blur", () => {
    const userKey = getActiveUserKey();
    ensureUserKey(window.contents, userKey);
    valueChk(window.contents, userKey, el.value);
    saveContentsToStorage(window.contents);
    el.removeEventListener("keydown", key);
  });
});

/**
 * 현재 시간을 문자열 형식으로 반환합니다.
 * 형식은 YYMMDDHHmmss (예: 250809154700) 입니다.
 *
 * @function timeUtil
 * @returns {string} 현재 시간 문자열 (YYMMDDHHmmss)
 */
const timeUtil = () => {
  const date = new Date();

  const year = date.getFullYear().toString().slice(-2);
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  const hour = ("0" + date.getHours()).slice(-2);
  const minute = ("0" + date.getMinutes()).slice(-2);
  const second = ("0" + date.getSeconds()).slice(-2);

  return `${year}${month}${day}${hour}${minute}${second}`;
};

/**
 * 빈값이나 중복된 값이 있는지 체크후 값적재 로직입니다.
 */
const valueChk = (content, userKey, value) => {
  // 빈값이면 스킵
  if (!value) return;

  const userContents = content[userKey] || [];

  // 같은 텍스트가 이미 있으면 스킵 (가벼운 중복 방지)
  const isDuplicate = userContents.some((item) => item.textValue === value);
  if (isDuplicate) return;

  // 값 적재
  userContents.push({ textValue: value, timeStamp: timeUtil() });
  content[userKey] = userContents;
};

/************************************************************************
 * 로그인/로그아웃 로직 관련 함수입니다.
 ************************************************************************/

/**
 * 로그인 로직입니다.
 * 클라이언트 -> 카카오 인가 코드 요청입니다.
 * 클라이언트가 카카오에 인가 코드를 요청하면
 * 다시 debounce url로 redirect를 진행합니다.
 */
const kakaoLogin = () => {
  // http://localhost:3000
  const domain = window.location.origin;
  if (!window.Kakao || !KAKAO_JS_KEY) {
    alert("Kakao SDK 또는 JS 키가 설정되지 않았습니다.");
    return;
  }

  // 카카오 init이 안되었으면 init처리 해줍니다.
  if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);

  // 카카오 인가토큰을 받는 과정입니다. (prompt : login 은 매번 강제로그인임.)
  Kakao.Auth.authorize({
    redirectUri: `${domain}/debounce`,
    prompt: "login",
  });
};

/**
 * 로그아웃 로직입니다.
 * */
const kakaoLogout = async () => {
  try {
    await axios.post("/debounce/logout");
    if (window.Kakao && Kakao.Auth && Kakao.Auth.getAccessToken()) {
      try {
        Kakao.Auth.logout(() => {});
      } catch (e) {
        console.log(e);
      }
    }

    //세션 스토리지에서 마지막 로그인 메일을 제거후 전역메일도 null처리합니다.
    sessionStorage.removeItem(LAST_EMAIL_KEY);
    currentUserEmail = null;

    // 페이지를 재 호출합니다.
    window.location.href = "/debounce";
  } catch (e) {
    console.error("[logout] failed:", e);
    window.location.href = "/debounce";
  }
};

/************************************************************************
 * 세션 스토리지 관련 지원 함수입니다.
 ************************************************************************/

/**
 * 세션스토리지에 있는 정보를 모두 없에주는 지원 함수입니다.
 */
const clearSessionStorageAll = () => {
  try {
    sessionStorage.clear();
    window.contents = { [DEFAULT_USER_KEY]: [] };
    currentUserEmail = null;
    alert("세션 스토리지 전체 삭제 완료");
    location.reload();
  } catch (e) {
    console.warn(e);
  }
};

/**
 * 세션 스토리지에서 값을 가져옵니다. (자바로치면 getter?)
 * @returns
 */
const loadContentsFromStorage = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("Failed to parse contents from storage:", e);
    return null;
  }
};

/**
 * 세션 스토리지에 window.contents 값을 저장합니다(자바로치면 setter?)
 * @param {*} contents
 */
const saveContentsToStorage = (contents) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(contents));
  } catch (e) {
    console.warn("Failed to save contents to storage:", e);
  }
};
