// routes/talkRouter.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/talk';

router.get('/', async (req, res, next) => {
  try {
    const { code, error, error_description } = req.query || {};
    if (error) return next(new Error(error_description || error));

    // Kakao OAuth 콜백 처리
    if (code) {
      const tokenRes = await axios.post(
        'https://kauth.kakao.com/oauth/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: REST_API_KEY,
          redirect_uri: REDIRECT_URI, // 반드시 kakao console 과 일치
          code,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const { access_token, refresh_token } = tokenRes.data;
      const meRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const user = meRes.data;
      req.session.kakao = { access_token, refresh_token, user };

      // 쿼리 정리된 /talk 로
      return res.redirect(303, '/talk');
    }

    // 보호 페이지: 서버 세션이 없으면 /main 으로
    const hasLocal = !!req.session.user;
    const hasKakao = !!req.session.kakao;
    if (!hasLocal && !hasKakao) return res.redirect('/main');

    // 여기서 대화 UI 렌더
    return res.render('talk'); // views/talk.ejs
  } catch (err) {
    console.error('[talk] error:', err?.response?.data || err);
    return next(err);
  }
});

module.exports = router;
