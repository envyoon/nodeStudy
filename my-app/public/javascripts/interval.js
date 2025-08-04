
/**
 * localhost:3000/interval 경로로 접근 시
 * 3초마다 roles 이 viewer 인 유저 정보를 불러오는 기능입니다.
 */
let intervalId;

document.addEventListener('DOMContentLoaded', async() => {

    const response = await axios.get('/data/userList.json');
    const userJson = response.data.users;
    const getViewer = userJson.filter((user) => user.roles.includes('viewer'));

    const h2Name = document.getElementById('h2Name');
    let num = 0;
    
    intervalId = setInterval(() => {
        h2Name.innerHTML = getViewer.map(user =>
            `<div>${num++} | ${user.id} | ${user.name} | ${user.email} | ${user.isActive} | ${user.roles}</div>`
        ).join('\n'); 
    }, 3000);

});

const stopCall = () => {
    console.log('호출 정지 버튼 클릭 됨');

    if(intervalId){
        clearInterval(intervalId);
        intervalId = null;
        console.log("호출 정지 됨.")
    }

    const h2Name = document.getElementById('h2Name');
    h2Name.textContent = '호출이 정지되었습니다.'

};
