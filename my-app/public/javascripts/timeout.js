
/**
 * localhost:3000/timeout 경로로 접근 시 
 * 3초뒤에 '이영희' 라는 이름을 가진 사람의 정보를 불러오는 기능입니다.
 */
document.addEventListener('DOMContentLoaded', async() => {    
    
    const response = await axios.post('/timeout/getUserData');
    const userJson = response.data.users;
    const zeroHe = userJson.filter(user => user.name === '이영희');
    const h2Name = document.getElementById('h2Name');

    setTimeout(() => {
        h2Name.textContent = zeroHe.map(user =>
            `${user.id} | ${user.name} | ${user.email} | ${user.isActive} | ${user.roles}`
        );
    }, 3000);

});
