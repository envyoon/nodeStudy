var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.render('interval');
});

module.exports = router;