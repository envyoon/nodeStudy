document.addEventListener('DOMContentLoaded', () => {
    const btnName = document.getElementById('btnName');
    let num = 0;
    btnName.textContent = `${num}`;
    
    setInterval(() => {
        btnName.textContent = num++;
        console.log(`${num} 3초 마다 실행 됨.`);
    }, 3000);

});