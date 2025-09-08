const express = require("express");
const axios = require("axios");
const router = express.Router();

// 카카오 REAT_API를 사용하기 위한 키와 redirect uri 입니다. (.env 에서 가져옴)
const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;

/**
 * 일반 호출 및 redirect되었을 때 작업을 처리합니다.
 */
router.get("/", async (req, res, next) => {
  try {
    //쿼리 스트링 값(인가토큰)이 있으면 로그인, 없으면 그냥 페이지 표기
    const { code, error, error_description } = req.query;

    if (error) {
      return res.status(400).send("카카오 인증 오류: " + (error_description || error));
    }

    // redirect 값이 없을경우 일반 화면을 호출
    if (!code) {
      return res.render("main");
    }

    // 인가 토큰으로 인증을 하는 과정입니다.
    const tokenRes = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: REST_API_KEY,
        redirect_uri: REDIRECT_URI,
        code,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token, refresh_token } = tokenRes.data;

    const meRes = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const user = meRes.data;

    // 세션에 저장합니다.
    if (req.session) {
      req.session.kakao = {
        access_token,
        refresh_token,
        user,
      };
    }

    return res.redirect(303, "/debounce");
  } catch (err) {
    console.error("[Kakao] error:", err?.response?.data || err);
    return next(err);
  }
});

/**
 * debounce 페이지 로드 시 로그인 세션 정보가 있는지 체크하는 로직입니다.
 * 로그인 정보가 있다면 로그인한 정보를 return 해줍니다.
 */
router.get("/me", function (req, res) {
  const user = req.session && req.session.kakao ? req.session.kakao.user : null;
  if (!user) return res.status(204).send();

  res.json({
    id: user.id,
    email: user.kakao_account && user.kakao_account.email ? user.kakao_account.email : null,
    nickname: user.kakao_account && user.kakao_account.profile ? user.kakao_account.profile.nickname : null,
  });
});

/**
 * 로그아웃 버튼 클릭시 호출되는 부분입니다.
 */
router.post("/logout", (req, res) => {
  if (!req.session) return res.status(204).send(); // 이미 없는 경우
  req.session.destroy((err) => {
    if (err) {
      console.error("[logout] session destroy error:", err);
      return res.status(500).json({ ok: false, message: "세션 삭제 실패" });
    }
    res.clearCookie("sid");
    return res.status(204).send(); // No Content
  });
});

module.exports = router;
