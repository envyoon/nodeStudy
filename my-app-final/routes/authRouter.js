// routes/authRouter.js
const express = require("express");
const router = express.Router();

router.get("/signup", (req, res) => {
  res.render("signup"); // views/signup.ejs
});

// DB 없이: 클라이언트에서 이미 검증됨. 서버는 세션만 세팅.
router.post("/local-login", (req, res) => {
  const { id, email, paid } = req.body || {};

  // 세션에 로그인 사용자 기록
  req.session.user = { id, email: email || id, provider: "local" };
  req.session.paid = !!paid;

  // 미결제면 결제 플로우로 유도
  if (!req.session.paid) {
    req.session.payMeta = {
      from: "login",
      reason: "need_payment",
      next: "/talk",
      amount: 990, // 기본 금액
      goodName: "채팅 이용권",
      ts: Date.now(),
    };
    return res.json({
      ok: true,
      requiresPayment: true,
      redirect: "/pay",
    });
  }

  // 결제자면 바로 토크 페이지로
  return res.json({ ok: true, redirect: "/talk" });
});

router.post("/logout", (req, res) => {
  if (!req.session) return res.status(204).send();
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ ok: false });
    res.clearCookie("sid");
    return res.status(204).send();
  });
});

module.exports = router;
