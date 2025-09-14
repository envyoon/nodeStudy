const express = require("express");
const axios = require("axios");
const router = express.Router();

router.get("/", async (req, res, next) => {
    res.render("main");
});


module.exports = router;
