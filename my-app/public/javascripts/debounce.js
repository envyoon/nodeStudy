// ==== 설정 영역 ====
const KAKAO_JS_KEY = '74624c9eef1b4a521aa9a2f6c111d9a6'; // ← 실제 Kakao JavaScript 키로 교체
const DEFAULT_USER_KEY = 'Unknown';

// 현재 로그인한 사용자 이메일(없으면 null)
let currentUserEmail = null;

// 현재 사용할 사용자 키(로그인 되어 있으면 이메일, 아니면 기본 키)
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
    // 카카오 초기화 (SDK가 로드되었는지 가드)
    if (window.Kakao && !Kakao.isInitialized()) {
      Kakao.init(KAKAO_JS_KEY);
    }

    // 세션에 로그인 유저가 있으면 이메일을 받아서 currentUserEmail에 저장
    axios.get('/debounce/me')
      .then((res) => {
        if (res.status === 200 && res.data && res.data.email) {
          currentUserEmail = res.data.email;
          // console.log('[login] email =', currentUserEmail);
        }
      })
      .catch(() => {
        // 미로그인/에러 시 무시
      });

    /**
     *  NOTE
     *  2025.08.09
     *      window.onload 로 해도 될것같은데 
     *      뭐가더 나은지 뭘 해야하는지는 잘 모르겠음.. 
     *      window.onload
     *          모든컨텐츠(img,css,...) 가 로드가 완료 되었을때 보여짐
     *      DOMContentLoaded
     *          DOM트리를 완성하는 즉시
     *      즉, DOMContentLoaded가 좀더 빠른것같음?
     *      근데 화면 컨텐츠 못가져와서 등록 안될수도 있지 않을까?
     *      타이밍 이슈가 생기면 아무래도 window.onload로 변경하는게 나을 수도 
     * 
     *      0. 시작할때 이벤트 리스너를 등록함
     *      1. textarea를 클릭하면 키보드 이벤트 리스너를 등록함.
     *      2. textarea의 포커스가 빠져나가면 키보드 이벤트 리스너를 제거함. (이때 windows.contents에 저장)
     *      3. textarea에 값이 입력되면 디바운싱 처리를하여 windows.contents에 저장 (0.3초)
     *      
     *      *궁금한점*
     *      근데 타임스탬프 값 말고는 textvalue값이 중첩될텐데 (입력하고 0.3초후에 마우스 커서 빼면..)
     *      이거 뭐 냅둬도 되겠죠..? 음.. 뭔가 중복되는 textvalue찾는거 하면 복잡해질것같음.
     *  2025.0.25
     *      여기에 Kakao Login 기능을 추가하여서, window.contents에 로그인한 정보를 ysheo@inswave.com 대신 넣을 수 있게 처리 하여야 함.
     *      0. 로그인이 되었는지, 안되었는지 체크 (세션이 있는지 없는지)
     *      1. 로그인이 되었으면 디바운싱을 할 때 세션에 유저 정보를 넣어줘야함.
     *      2. 다른 계정으로 로그인 했을 때 디바운싱을 할 때 다른 유저 정보를 넣어줘야함.
     *      3. 이때 그전에 있던 window.contents 정보는 그대로 있어야함.
     */
    window.contents = {}

    const el = document.getElementById("tbx_test");
    
    let debounce = 0;

    // 키보드 이벤트 리스너 디바운스 로직
    const key = (event) => {
        if (debounce) {
            clearTimeout(debounce);
        }
        debounce = setTimeout(() => {
            const userKey = getActiveUserKey();     // ← 로그인 이메일 또는 기본 키
            ensureUserKey(window.contents, userKey); // ← 배열 보장
            valueChk(window.contents, userKey, el.value);
        }, 300);
    };
  
    // 포커스 시 이벤트 리스너 등록
    el.addEventListener("focus", () => {
        console.log("포커스 됨");
        el.addEventListener("keydown", key);
    });
  
    // 포커스 해제 시 이벤트 리스너 제거
    el.addEventListener("blur", () => {
        console.log("포커스 해제됨");
        const userKey = getActiveUserKey();        // ← 로그인 이메일 또는 기본 키
        ensureUserKey(window.contents, userKey);   // ← 배열 보장
        valueChk(window.contents, userKey, el.value);
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
    const timestamp = Date.now();

    // BUGFIX: 암묵적 전역 방지
    const date = new Date(timestamp); 

    const year = date.getFullYear().toString().slice(-2);
    const month = ("0" + (date.getMonth() + 1)).slice(-2); 
    const day = ("0" + date.getDate()).slice(-2); 
    const hour = ("0" + date.getHours()).slice(-2); 
    const minute = ("0" + date.getMinutes()).slice(-2);
    const second = ("0" + date.getSeconds()).slice(-2); 

    const returnDate = `${year}${month}${day}${hour}${minute}${second}`;
    return returnDate;
}

/**
 * 빈값이나 중복된 값이 있는지 체크후 값적재 로직입니다.
 */
const valueChk = (content, userKey, value) => {
    console.log("content : ", content);
    
    // 빈값 return
    if (value === '') return;
    
    const userContents = content[userKey] || [];
    const isDuplicate = userContents.some(item => item.textValue === value);
    
    // 중복 return
    if (isDuplicate) return;
    
    // 값 적재
    window.contents[userKey].push({textValue:value,timeStamp:timeUtil()});
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

// HTML의 onclick="kakaoLogin()"용 전역 노출(환경에 따라 생략 가능)
if (typeof window !== 'undefined') {
  window.kakaoLogin = kakaoLogin;
}
