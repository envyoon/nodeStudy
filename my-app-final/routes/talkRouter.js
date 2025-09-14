// routes/talkRouter.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

const {
  KAKAO_REST_API_KEY,
  KAKAO_REDIRECT_URI = "http://localhost:3000/talk",
  KAKAO_CLIENT_SECRET,
  SOCKET_URL, // ★ 추가: 클라에 내려줄 소켓 서버 URL
} = process.env;

/** 공통: 세션에서 표시용 meName/provider 뽑기 */
function pickMe(req) {
  // 일반 로그인
  if (req.session?.user) {
    const { email, id } = req.session.user;
    return { provider: "local", meName: email || id || "User" };
  }
  // 카카오 로그인
  const kakao = req.session?.kakao?.user;
  if (kakao) {
    const acc = kakao.kakao_account || {};
    const nickname = acc.profile?.nickname;
    return { provider: "kakao", meName: acc.email || nickname || `K-${kakao.id}` };
  }
  return { provider: null, meName: null };
}

/**
 * GET /talk
 * - code 있으면: 카카오 콜백 → 토큰교환 → 세션저장 → /talk 로 정리 리다이렉트
 * - code 없으면: 보호 라우팅(로그인 없으면 /main), 있으면 talk.ejs 렌더
 */
router.get("/", async (req, res, next) => {
  try {
    const { code, error, error_description } = req.query || {};

    if (error) {
      console.error("[kakao authorize error]", error, error_description);
      return res.status(400).send("카카오 인증 오류: " + (error_description || error));
    }

    // 1) 카카오 콜백 (인가코드 수신) → 토큰 교환
    if (code) {
      try {
        const params = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: KAKAO_REST_API_KEY,
          redirect_uri: KAKAO_REDIRECT_URI,
          code,
        });
        if (KAKAO_CLIENT_SECRET) params.append("client_secret", KAKAO_CLIENT_SECRET);

        const tokenRes = await axios.post(
          "https://kauth.kakao.com/oauth/token",
          params.toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const { access_token, refresh_token } = tokenRes.data;

        const meRes = await axios.get("https://kapi.kakao.com/v2/user/me", {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        // 서버 세션 저장
        req.session.kakao = { access_token, refresh_token, user: meRes.data };

        try {
          const rawState = req.query?.state;
          if (rawState) {
            const parsed = JSON.parse(Buffer.from(rawState, "base64").toString("utf8"));
            const paidEmails = Array.isArray(parsed?.paidEmails) ? parsed.paidEmails : [];
            const acc = meRes.data?.kakao_account || {};
            const email = acc.email;
            if (email && paidEmails.includes(email)) {
              req.session.paid = true;
            }
          }
        } catch (_) {
          // state 파싱 실패는 무시
        }

        // 쿼리 정리 위해 자가 리다이렉트
        return res.redirect(303, "/talk");
      } catch (err) {
        const status = err.response?.status;
        const data = err.response?.data;
        console.error("[kakao token error]", status, data, { used_redirect_uri: KAKAO_REDIRECT_URI });
        return res.status(400).send("Kakao token exchange failed.");
      }
    }

    // 2) 보호 라우팅: 로그인 없으면 /main
    const hasLocal = !!req.session?.user;
    const hasKakao = !!req.session?.kakao;
    if (!hasLocal && !hasKakao) return res.redirect("/main");

    // 2.5) 결제 가드: 미결제면 /pay
    if (!req.session.paid) {
      req.session.payMeta = { from: "talk", reason: "need_payment", next: "/talk" };
      return res.redirect("/pay");
    }

    // 3) 뷰 렌더 + ★ 소켓 URL 주입
    const { provider, meName } = pickMe(req);
    return res.render("talk", {
      provider,
      meName,
      socketUrl: SOCKET_URL || "", // 없으면 같은 오리진으로 붙음
    });
  } catch (err) {
    console.error("[talk error]", err?.response?.data || err);
    return next(err);
  }
});

/** GET /talk/me : 프런트에서 로그인 상태/프로필 확인용 */
router.get("/me", (req, res) => {
  const local = req.session?.user;
  const kakao = req.session?.kakao?.user;

  if (local) {
    const { id, email } = local;
    return res.json({ provider: "local", id, email: email || null, nickname: null, paid: !!req.session.paid });
  }
  if (kakao) {
    const acc = kakao.kakao_account || {};
    return res.json({
      provider: "kakao",
      id: kakao.id,
      email: acc.email || null,
      nickname: acc.profile?.nickname || null,
      paid: !!req.session.paid,
    });
  }
  return res.status(204).send(); // 미로그인
});

/** POST /talk/logout : 서버 세션 파괴 */
router.post("/logout", async (req, res) => {
  try {
    const kakaoAccess = req.session?.kakao?.access_token;
    if (kakaoAccess) {
      try {
        await axios.post("https://kapi.kakao.com/v1/user/logout", null, {
          headers: { Authorization: `Bearer ${kakaoAccess}` },
        });
      } catch (e) {
        console.warn("[kakao logout] failed:", e?.response?.data || e);
      }
    }

    if (!req.session) {
      res.clearCookie("sid");
      return res.status(204).send();
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("[logout] session destroy error:", err);
        res.clearCookie("sid");
        return res.status(500).json({ ok: false, message: "세션 삭제 실패" });
      }
      res.clearCookie("sid");
      return res.status(204).send();
    });
  } catch (e) {
    console.error("[logout] unexpected error:", e);
    res.status(500).json({ ok: false, message: "로그아웃 중 오류" });
  }
});

module.exports = router;
