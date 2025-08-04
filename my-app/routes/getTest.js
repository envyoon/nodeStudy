const express = require('express');
const router = express.Router();
const path = require("path"); // 파일 가져오는 모듈
const fs = require("fs"); // 파일 읽는 모듈

router.get('/', (req, res, next) => {
  res.render('getTest');
});

router.post('/getUserData', (req, res, next) => {
  
  // 1. 파일 경로 가져오기 (현재dir + 원하는 파일 경로)
  const getFile = path.join(__dirname,'../public/data/userList.json');

  // 2. 경로에 있는 파일 읽고 앞단으로 던지기
  fs.readFile(getFile, 'utf8', (err, data) => {
    if (err) {
       throw err; 
    }
    res.send(data);
  });

});

module.exports = router;

