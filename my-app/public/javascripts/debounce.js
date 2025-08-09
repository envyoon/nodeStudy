
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
     *  0. 시작할때 이벤트 리스너를 등록함
     *  1. textarea를 클릭하면 키보드 이벤트 리스너를 등록함.
     *  2. textarea의 포커스가 빠져나가면 키보드 이벤트 리스너를 제거함. (이때 windows.contents에 저장)
     *  3. textarea에 값이 입력되면 디바운싱 처리를하여 windows.contents에 저장 (0.3초)
     */
    window.contents = {
        "ysheo@inswave.com" : []
    }

    const el = document.getElementById("tbx_test");
    
    let debounce = 0;

    // 키보드 이벤트 리스너 디바운스 로직
    const key = (event) => {
        if (debounce) {
            clearTimeout(debounce);
        }
        debounce = setTimeout(() => {
            // 입력끝나면 window.contents에 값 등록 해 주면 됨.
            // console.log(el.value);        
            window.contents["ysheo@inswave.com"].push({textValue:el.value,timeStamp:timeUtil()});
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
        // 포커스 해제되면 window.contents에 값 등록 해 주면 됨.
        // console.log(el.value);
        window.contents["ysheo@inswave.com"].push({textValue:el.value,timeStamp:timeUtil()});
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
    //역시 티스토리에서 가져다 쓰는게 짱이긴함 잘만들어놨네
    const timestamp = new Date().getTime();

    date = new Date(timestamp); 

    const year = date.getFullYear().toString().slice(-2);
    const month = ("0" + (date.getMonth() + 1)).slice(-2); 
    const day = ("0" + date.getDate()).slice(-2); 
    const hour = ("0" + date.getHours()).slice(-2); 
    const minute = ("0" + date.getMinutes()).slice(-2);
    const second = ("0" + date.getSeconds()).slice(-2); 

    const returnDate = `${year}${month}${day}${hour}${minute}${second}`;

    return returnDate;
}
