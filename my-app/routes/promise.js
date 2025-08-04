var express = require('express');
var router = express.Router();

router.get('/', (req, res, next) => {
  res.render('promise');
});

router.post('/', (req, res, next) => {
  
});

module.exports = router;