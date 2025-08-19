
/**
 * 
 */
document.addEventListener("DOMContentLoaded", () => {
    
    const el = document.getElementById("tbx_test");
    
    let debounce = 0;

    // 키보드 이벤트 리스너 디바운스 로직
    const key = (event) => {
        if (debounce) {
            clearTimeout(debounce);
        }
        debounce = setTimeout( async() => {
            /**
             * 해당 부분에 뒷단으로 el.value(입력한 값)를 던지는 로직은 줘야한다.
             */

            console.log('data : ',el.value);

            const data = {
                key : el.value
            };

            if(el.value === '') return;
            
            const test = await axios.post('/preview/getData',data);
            console.log(test);

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

