// routes/payRouter.js
const express = require("express");
const router = express.Router();

/** 로그인 여부 */
function ensureAuthed(req, res, next) {
  if (req.session?.user || req.session?.kakao) return next();
  return res.redirect("/main");
}

/** 결제 플로우 토큰(payMeta) 필수 + 이미 결제면 /talk */
function ensurePayFlow(req, res, next) {
  if (req.session?.paid) return res.redirect("/talk");

  const meta = req.session?.payMeta;

  // (선택) TTL: payMeta 생성 5분 이후엔 무효화
  const TTL_MS = 5 * 60 * 1000;
  const now = Date.now();
  if (!meta || !meta.from || (meta.ts && now - meta.ts > TTL_MS)) {
    // 만료되거나 직접 접근 → 차단
    delete req.session.payMeta;
    return res.redirect("/main");
  }
  next();
}

/** 표시용 이름 */
function whoAmI(req) {
  return req.session?.user?.email || req.session?.user?.id || req.session?.kakao?.user?.kakao_account?.email || "사용자";
}

/** GET /pay : 결제 안내 */
router.get("/", ensureAuthed, ensurePayFlow, (req, res) => {
  const meta = req.session.payMeta || {};
  res.render("pay", { who: whoAmI(req), meta });
});

/** GET /pay/leave : 돌아가기(플로우 정리) */
router.get("/leave", ensureAuthed, (req, res) => {
  delete req.session.payMeta; // ← 핵심: payMeta 제거
  return res.redirect("/main");
});

/** (모의) 결제 성공 */
router.post("/mock/success", ensureAuthed, ensurePayFlow, (req, res) => {
  req.session.paid = true; // 실제 KCP 승인 후 true
  const next = req.session.payMeta?.next || "/talk";
  delete req.session.payMeta; // 플로우 컨텍스트 정리
  return res.redirect(next);
});

/** (모의) 결제 실패 */
router.post("/mock/fail", ensureAuthed, ensurePayFlow, (req, res) => {
  // 실패 시에도 URL은 깨끗하게 유지, 화면은 그대로 /pay
  return res.redirect("/pay");
});

module.exports = router;
