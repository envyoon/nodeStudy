document.addEventListener('DOMContentLoaded', () => {
    const btnName = document.getElementById('btnName');
    btnName.textContent = '3초 대기 중...';
    
    setTimeout(() => {
        btnName.textContent = '3초 후 실행됨!';
        console.log('3초 후 실행됨');
    }, 3000);

});