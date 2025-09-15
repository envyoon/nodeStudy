const express = require("express");
const router = express.Router();

/**
 * [GET] /auth/signup
 * - 회원가입 페이지 렌더
 */
router.get("/signup", (req, res) => {
  try {
    return res.render("signup"); // views/signup.ejs
  } catch (e) {
    console.error("[/auth/signup GET] error:", e);
    return res.status(500).send("Signup page error");
  }
});

/**
 * [POST] /auth/local-login
 * - 일반 + admin/admin 바이패스
 * - 세션을 regenerate → 값 세팅 → save 후 응답 (세션 저장 보장)
 * - 미결제면 payMeta도 심어서 /pay 바로 진입 가능
 */
router.post("/local-login", (req, res) => {
  const { id, email, paid, pw } = req.body || {};
  const respond = () => {
    const needPay = !req.session.paid;

    // ★ 결제 필요하면 payMeta 심어둠 (payRouter.ensurePayFlow용)
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
      // 관리자 바이패스
      req.session.user = { id: "admin", email: "admin", isAdmin: true };
      req.session.paid = true; // 결제 가드 우회
      return respond();
    }

    // 일반 사용자
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
