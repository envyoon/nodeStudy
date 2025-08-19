
/**
 * input text에 $p. 에 관한 자동완성을 해 주는 부분입니다.
 */
document.addEventListener("DOMContentLoaded", () => {
    
    const el = document.getElementById("tbx_test");
    
    let debounce = 0;

    // 키보드 이벤트 리스너 디바운스 로직
    const key = (event) => {
        if (debounce) clearTimeout(debounce);

        debounce = setTimeout(async () => {
            // 입력값이 없으면 return 처리합니다.
            if (el.value === '') return;

            // 파싱데이터 받아옴
            const { data: test } = await axios.post('/preview/getData', { key: el.value });
            const result = (test && test.result) || {};
            const keys   = Object.keys(result);

            // !type !doc 초기화 함수
            const clearMeta = () => {
                available_type.innerHTML = '';
                available_doc.innerHTML  = '';
            };

            // case 1 : 사용 가능한 함수가 아예 없을때 
            if (keys.length === 0) {
                availableFuc.innerHTML = '사용가능 함수 : (없음)';
                clearMeta();
                return;
            }

            // case 2 : 사용 가능한 함수가 1개 이상일 때 ,로 구분해서 보여주되 !type과 !doc은 표기안함.
            if (keys.length > 1) {
                availableFuc.innerHTML = '사용가능 함수 : ' + keys.join(', ');
                clearMeta();
                return;
            }

            // case 3 : 사용 가능한 함수가 하나면 (완전 일치로 간주) 함수명 + !type과 !doc 표기.
            const fnName = keys[0];
            const fnInfo = result[fnName] || {};
            console.log("fnName : ",fnName);
            console.log("fnInfo : ",fnInfo);
            availableFuc.innerHTML   = `사용가능 함수 : ${fnName}`;
            available_doc.innerHTML = fnInfo['!doc'] ? renderDoc(fnInfo['!doc']) : '';
            available_type.innerHTML = fnInfo['!type'] ? renderDoc('`' + fnInfo['!type'] + '`') : '';
        }, 300);
    };
  
    // 포커스 시 이벤트 리스너 등록
    el.addEventListener("focus", () => {
        el.addEventListener("keydown", key);
    });
  
    // 포커스 해제 시 이벤트 리스너 제거
    el.addEventListener("blur", () => {
        el.removeEventListener("keydown", key);
    });

});

/**
 * !doc과 !type을 마크다운 형식으로 변환 해 주는 함수입니다.
 * (AI가 해줬어요)
 * @param {*} md 
 * @returns 
 */
const renderDoc = (md = '') => {
  let safe = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  safe = safe.replace(/```(\w+)?\n([\s\S]*?)```/g, (m, lang, code) => {
    const c = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<pre><code class="lang-${lang || ''}">${c}</code></pre>`;
  });

  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');

  safe = safe.replace(/\n/g, '<br>');

  return safe;
}
