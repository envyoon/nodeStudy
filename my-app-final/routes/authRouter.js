// routes/authRouter.js
const express = require("express");
const router = express.Router();

router.get("/signup", (req, res) => {
  res.render("signup"); // views/signup.ejs
});

// DB 없이: 클라이언트에서 이미 검증됨. 서버는 세션만 세팅.
router.post("/local-login", (req, res) => {
  const { id, email } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, message: "id required" });

  req.session.user = { id, email: email || id, provider: "local" };
  // 결제 전 단계 정보(세션에 저장) → URL에는 노출 X
  req.session.payMeta = { from: "login", reason: "need_payment", next: "/talk" };
  return res.json({ ok: true, redirect: "/pay" });
});

router.post("/logout", (req, res) => {
  if (!req.session) return res.status(204).send();
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ ok: false });
    res.clearCookie("sid");
    res.status(204).send();
  });
});

module.exports = router;
