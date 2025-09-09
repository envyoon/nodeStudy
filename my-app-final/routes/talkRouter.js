// routes/talkRouter.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const {
  KAKAO_REST_API_KEY,
  KAKAO_REDIRECT_URI = 'http://localhost:3000/talk',
  KAKAO_CLIENT_SECRET, 
} = process.env;

router.get('/', async (req, res, next) => {
  try {
    const { code, error, error_description } = req.query || {};
    if (error) {
      console.error('[kakao authorize error]', error, error_description);
      return next(new Error(error_description || error));
    }

    // 1) 카카오 콜백: 토큰 교환
    if (code) {
      try {
        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: KAKAO_REST_API_KEY,    
          redirect_uri: KAKAO_REDIRECT_URI, 
          code,
        });
        if (KAKAO_CLIENT_SECRET) {
          body.append('client_secret', KAKAO_CLIENT_SECRET); 
        }

        const tokenRes = await axios.post(
          'https://kauth.kakao.com/oauth/token',
          body.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token, refresh_token } = tokenRes.data;

        const meRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        req.session.kakao = {
          access_token,
          refresh_token,
          user: meRes.data,
        };

        // 쿼리 정리
        return res.redirect(303, '/talk');
      } catch (err) {
        // 🔎 에러 본문을 그대로 로그로 확인
        const status = err.response?.status;
        const data = err.response?.data;
        console.error('[kakao token error]', status, data, {
          used_redirect_uri: KAKAO_REDIRECT_URI,
        });
        // 흔한 원인 힌트
        // - mismatched_redirect: redirect_uri 불일치
        // - invalid_client: 키/시크릿 문제
        // - invalid_grant: code 재사용/만료
        return res.status(400).send('Kakao token exchange failed.');
      }
    }

    // 2) 보호 라우팅
    const hasLocal = !!req.session.user;
    const hasKakao = !!req.session.kakao;
    if (!hasLocal && !hasKakao) return res.redirect('/main');

    // 3) 뷰 데이터
    let meName = 'User';
    let provider = 'local';
    if (hasLocal) {
      const { email, id } = req.session.user || {};
      meName = email || id || meName;
      provider = 'local';
    } else {
      const acc = req.session.kakao?.user?.kakao_account;
      meName = acc?.email || acc?.profile?.nickname || meName;
      provider = 'kakao';
    }

    return res.render('talk', { meName, provider });
  } catch (err) {
    console.error('[talk error]', err?.response?.data || err);
    return next(err);
  }
});

module.exports = router;
