
/**
 * localhost:3000/interval 경로로 접근 시
 * 3초마다 roles 이 viewer 인 유저 정보를 불러오는 기능입니다.
 */
document.addEventListener('DOMContentLoaded', async() => {

    const response = await axios.get('/data/userList.json');
    const userJson = response.data.users;
    const getViewer = userJson.filter((user) => user.roles.includes('viewer'));

    const h2Name = document.getElementById('h2Name');
    let num = 0;
    
    setInterval(() => {
        h2Name.innerHTML = getViewer.map(user =>
            `<div>${num++} | ${user.id} | ${user.name} | ${user.email} | ${user.isActive} | ${user.roles}</div>`
        ).join('\n'); 
    }, 3000);

});
