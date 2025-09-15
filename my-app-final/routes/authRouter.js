const express = require("express");
const router = express.Router();

/**
 * 회원 가입페이지를 렌더링 합니다.
 */
router.get("/signup", (req, res) => {
  try {
    return res.render("signup");
  } catch (e) {
    console.error("[/auth/signup GET] error:", e);
    return res.status(500).send("Signup page error");
  }
});

/**
 * 일반 로그인 시 처리되는 로직입니다
 * 결제했는지 안했는지처리 단계에 따라 결제를 진행할지, 채팅창으로 갈지 처리합니다.
 * admin의 경우는 by-pass 처리됩니다.
 */
router.post("/local-login", (req, res) => {
  const { id, email, paid, pw } = req.body || {};
  const respond = () => {
    const needPay = !req.session.paid;

    if (needPay) {
      req.session.payMeta = {
        from: "auth",
        reason: "need_payment",
        next: "/talk",
        ts: Date.now(),
      };
    }

    return req.session.save(() =>
      res.json({
        ok: true,
        requiresPayment: needPay,
        redirect: needPay ? "/pay" : "/talk",
      })
    );
  };

  const setUserSession = () => {
    if (id === "admin" && pw === "admin") {
      req.session.user = { id: "admin", email: "admin", isAdmin: true };
      req.session.paid = true;
      return respond();
    }

    const userId = id || email || "user";
    const userEmail = email || null;
    req.session.user = { id: userId, email: userEmail || undefined, isAdmin: false };
    req.session.paid = !!paid;
    return respond();
  };

  req.session.regenerate((err) => {
    if (err) {
      console.error("[local-login] regenerate error:", err);
      return res.status(500).json({ ok: false, message: "세션 생성 실패" });
    }
    setUserSession();
  });
});

module.exports = router;
