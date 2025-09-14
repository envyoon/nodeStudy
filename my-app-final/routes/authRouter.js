// routes/authRouter.js
const express = require("express");
const router = express.Router();

/**
 * [POST] /auth/local-login
 * - 일반 로컬 로그인: 클라에서 전달한 id/email/paid 를 세션에 심고 결제여부(req.session.paid)에 따라 /pay 또는 /talk 리다이렉트 정보 반환
 * - 관리자 바이패스: id==="admin" && pw==="admin" 이면 req.session.paid = true 로 만들고 바로 /talk
 */
router.post("/local-login", (req, res) => {
  try {
    const { id, email, paid, pw } = req.body || {};

    // ── 1) 관리자 바이패스 ──────────────────────────────────────────────
    if (id === "admin" && pw === "admin") {
      req.session.user = { id: "admin", email: "admin", isAdmin: true };
      req.session.paid = true; // 결제 가드 우회
      return res.json({
        ok: true,
        requiresPayment: false,
        redirect: "/talk",
      });
    }

    // ── 2) 일반 로컬 로그인 (기존 플로우 그대로) ────────────────────────
    // 클라(메인화면)에서 sessionStorage 유저검증을 이미 마친 상태라고 가정.
    // 이 서버 라우트는 세션만 세팅하고 어디로 갈지 알려준다.
    const userId = id || email || "user";
    const userEmail = email || null;

    req.session.user = { id: userId, email: userEmail || undefined, isAdmin: false };
    req.session.paid = !!paid; // 결제 여부는 클라 보관값을 그대로 반영 (정책에 따라 서버검증으로 바꿔도 됨)

    // 결제 필요 여부 판단
    const needPay = !req.session.paid;
    return res.json({
      ok: true,
      requiresPayment: needPay,
      redirect: needPay ? "/pay" : "/talk",
    });
  } catch (e) {
    console.error("[/auth/local-login] error:", e);
    return res.status(500).json({ ok: false, message: "로그인 처리 중 오류" });
  }
});

module.exports = router;
