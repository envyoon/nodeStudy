
/**
 * 
 */
document.addEventListener('DOMContentLoaded', () => {
    const h2Name = document.getElementById('h2Name');
    let num = 0;
    h2Name.textContent = `${num}`;
    
    setInterval(() => {
        h2Name.textContent = num++;
        console.log(`${num} 3초 마다 실행 됨.`);
    }, 3000);

});