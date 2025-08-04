document.addEventListener('DOMContentLoaded', async() => {
    console.log("timeout 실행됨");
    
    const response = await axios.get('/data/userList.json');
    const userJson = response.data.users;
    const zeroHe = userJson.filter(user => user.name === '이영희');
    const h2Name = document.getElementById('h2Name');

    setTimeout(() => {
        h2Name.textContent = zeroHe.map(user =>
            `${user.id} | ${user.name} | ${user.email} | ${user.isActive} | ${user.roles}`
        );
    }, 3000);

});
