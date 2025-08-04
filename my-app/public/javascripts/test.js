
/**
 * '어싱크 버튼' 클릭 시 public/data/userList.json에 있는 데이터를 
 * 'async/await' 방식으로 가져오는 기능입니다.
 * id 값이 홀수인 데이터만 가지고 옵니다.
 */
async function btn_async_onclick() {
    
    /**
     * NOTE 
     *  25.08.02
     *      json파일 읽어들이는게 fetch가 기본인 것 같은데,
     *      라인수가 여러 줄 눌어나서이게 맞나 .. 를 생각해 보다가 
     *      axios를 사용하면 좀 더 편하하다고 찾아보았음. (난 여지껏 모르고 쓰고있었군..)
     *      여기에서는 axios 사용해서 진행하는 것으로 하겠음.
     *  25.08.04
     *      생각해보니 파일 읽어들이는게 fetch가 아니라 http 통신 기본이 fetch 였음..
     *      xmlHttpRequest, fetch, axios 이런게 http통신 할 때 사용하는것
     *      파일을 읽어들이는것에 국한되어있지 않음.
     */

    console.log("async click");

    try{
        const response = await axios.get('/data/userList.json');
        const userJson = response.data.users;
        const oddUser = userJson.filter(user => user.id % 2 !== 0);

        console.log('응답값 : ',response);
        console.log('전체값 : ',userJson);
        console.log('홀수값 : ',oddUser);

        const html = oddUser.map(user => 
            `<div>
                ${user.id} : ${user.name} (${user.email})
            </div>`
        ).join('');

        const val = oddUser.map(user =>
            `${user.id} : ${user.name} (${user.email})`
        ).join('\n');

        document.getElementById("userList").innerHTML = html;
        document.getElementById("showInfo").value = val;
        document.getElementById("btnName").innerHTML = 'aysnc/await Button click!';
        }
    catch(e){
        console.error(e);
        console.error('통신 에러');
    }

};

/**
 * '프로미스 버튼' 클릭 시 public/data/userList.json에 있는 데이터를 
 * 'Promise' 방식으로 가져오는 기능입니다.
 * id 값이 홀수인 데이터만 가지고 옵니다.
 */
function btn_promise_onclick() {
    
    console.log("promise click");

    const response = axios.get('/data/userList.json')
        .then(function(res) {
            console.log('응답값 : ',res);

            const userJson = res.data.users;
            const oddUser = userJson.filter(user => user.id % 2 !== 0);

            console.log('전체값 : ',userJson);
            console.log('홀수값 : ',oddUser);

            const html = oddUser.map(user => 
                `<div>
                    ${user.id} : ${user.name} (${user.email})
                </div>`
            ).join('');
        
            const val = oddUser.map(user =>
                `${user.id} : ${user.name} (${user.email})`
            ).join('\n');
        
            document.getElementById("userList").innerHTML = html;
            document.getElementById("showInfo").value = val;
            document.getElementById("btnName").innerHTML = 'Promise Button click!';

        })
        .catch(function(e){
            console.error(e);
            console.error('통신 에러');
        });
    
};