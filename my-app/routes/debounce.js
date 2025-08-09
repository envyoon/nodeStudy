const express = require('express');
const router = express.Router();
const path = require("path"); // 파일 가져오는 모듈
const fs = require("fs"); // 파일 읽는 모듈

router.get('/', (req, res, next) => {
  res.render('debounce');
});

module.exports = router;

