// ==== 설정 ====
const KAKAO_JS_KEY = '74624c9eef1b4a521aa9a2f6c111d9a6'; // 실제 Kakao JS 키로 교체
const DEFAULT_USER_KEY = 'Unknown';                        // 로그인 전 기본 키
const STORAGE_KEY = 'contents:v1';                         // sessionStorage 키

// 현재 로그인한 사용자 이메일(없으면 null)
let currentUserEmail = null;

// 저장소 헬퍼
const loadContentsFromStorage = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY); // 오래 보관하려면 localStorage로 바꿔도 OK
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Failed to parse contents from storage:', e);
    return null;
  }
};

const saveContentsToStorage = (contents) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(contents));
  } catch (e) {
    console.warn('Failed to save contents to storage:', e);
  }
};

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
  // Kakao 초기화 (SDK 가드)
  if (window.Kakao && !Kakao.isInitialized()) {
    Kakao.init(KAKAO_JS_KEY);
  }

  // 1) 저장소에서 복원 (없으면 기본 구조)
  const restored = loadContentsFromStorage();
  window.contents = restored || { [DEFAULT_USER_KEY]: [] };

  // 2) 현재 로그인 유저 조회
  axios.get('/debounce/me')
    .then((res) => {
      if (res.status === 200 && res.data && res.data.email) {
        currentUserEmail = res.data.email;

        // === 포인트 ===
        // 새 로그인은 "빈값부터" 시작하길 원하므로:
        window.contents[currentUserEmail] = [];   // 이전 데이터/Unknown 데이터와 merge하지 않음
        saveContentsToStorage(window.contents);
      }
    })
    .catch(() => {
      // 미로그인/에러 → Unknown 으로 계속 사용
    });

  /**
   *  NOTE
   *  (기존 주석 유지)
   */
  const el = document.getElementById("tbx_test");

  let debounce = 0;

  // 키보드 이벤트 리스너 디바운스 로직
  const key = (event) => {
    if (debounce) {
      clearTimeout(debounce);
    }
    debounce = setTimeout(() => {
      const userKey = getActiveUserKey();      // 로그인 이메일 또는 Unknown
      ensureUserKey(window.contents, userKey); // 배열 보장
      valueChk(window.contents, userKey, el.value);
      saveContentsToStorage(window.contents);  // 저장소 동기화
    }, 300);
  };

  // 포커스 시 이벤트 리스너 등록
  el.addEventListener("focus", () => {
    // console.log("포커스 됨");
    el.addEventListener("keydown", key);
  });

  // 포커스 해제 시 이벤트 리스너 제거
  el.addEventListener("blur", () => {
    // console.log("포커스 해제됨");
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
  const isDuplicate = userContents.some(item => item.textValue === value);
  if (isDuplicate) return;

  // 값 적재
  userContents.push({ textValue: value, timeStamp: timeUtil() });
  content[userKey] = userContents;
};

/**
 * 클라이언트 -> 카카오 인가 코드 요청입니다.
 * 클라이언트가 카카오에 인가 코드를 요청하면
 * 다시 debounce url로 redirect를 진행합니다.
 */
const kakaoLogin = () => {
  const domain = window.location.origin; // 'http://localhost:3000'
  if (!window.Kakao || !KAKAO_JS_KEY) {
    alert('Kakao SDK 또는 JS 키가 설정되지 않았습니다.');
    return;
  }
  if (!Kakao.isInitialized()) {
    Kakao.init(KAKAO_JS_KEY);
  }
  Kakao.Auth.authorize({
    redirectUri: `${domain}/debounce`,
  });
};

// HTML의 onclick="kakaoLogin()"용 전역 노출
if (typeof window !== 'undefined') {
  window.kakaoLogin = kakaoLogin;
}
