// routes/talkRouter.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const {
  KAKAO_REST_API_KEY,
  KAKAO_REDIRECT_URI = 'http://localhost:3000/talk',
  KAKAO_CLIENT_SECRET, 
} = process.env;

/** 공통: 세션에서 표시용 meName/provider 뽑기 */
function pickMe(req) {
  // 일반 로그인 (req.session.user 는 /auth/local-login에서 세팅한다고 가정)
  if (req.session?.user) {
    const { email, id } = req.session.user;
    return { provider: 'local', meName: email || id || 'User' };
  }
  // 카카오 로그인
  const kakao = req.session?.kakao?.user;
  if (kakao) {
    const acc = kakao.kakao_account || {};
    const nickname = acc.profile?.nickname;
    return { provider: 'kakao', meName: acc.email || nickname || `K-${kakao.id}` };
  }
  return { provider: null, meName: null };
}

/**
 * GET /talk
 * - code 있으면: 카카오 콜백 → 토큰교환 → 세션저장 → /talk 로 정리 리다이렉트
 * - code 없으면: 보호 라우팅(로그인 없으면 /main), 있으면 talk.ejs 렌더
 */
router.get('/', async (req, res, next) => {
  try {
    const { code, error, error_description } = req.query || {};

    if (error) {
      console.error('[kakao authorize error]', error, error_description);
      return res.status(400).send('카카오 인증 오류: ' + (error_description || error));
    }

    // 1) 카카오 콜백 (인가코드 수신) → 토큰 교환
    if (code) {
      try {
        const params = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: KAKAO_REST_API_KEY,
          redirect_uri: KAKAO_REDIRECT_URI, // 프런트와 콘솔/ENV 모두 동일해야 함
          code,
        });
        if (KAKAO_CLIENT_SECRET) params.append('client_secret', KAKAO_CLIENT_SECRET);

        const tokenRes = await axios.post(
          'https://kauth.kakao.com/oauth/token',
          params.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const { access_token, refresh_token } = tokenRes.data;

        const meRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        // 서버 세션 저장
        req.session.kakao = {
          access_token,
          refresh_token,
          user: meRes.data,
        };

        // 쿼리 정리(코드 제거) 위해 자가 리다이렉트
        return res.redirect(303, '/talk');
      } catch (err) {
        const status = err.response?.status;
        const data = err.response?.data;
        console.error('[kakao token error]', status, data, {
          used_redirect_uri: KAKAO_REDIRECT_URI,
        });
        // 흔한 원인: redirect_uri 불일치, client_secret 누락, code 재사용/만료
        return res.status(400).send('Kakao token exchange failed.');
      }
    }

    // 2) 보호 라우팅: 일반/카카오 세션 모두 없으면 /main 으로
    const hasLocal = !!req.session?.user;
    const hasKakao = !!req.session?.kakao;
    if (!hasLocal && !hasKakao) return res.redirect('/main');

    // 3) 뷰 렌더
    const { provider, meName } = pickMe(req);
    return res.render('talk', { provider, meName });
  } catch (err) {
    console.error('[talk error]', err?.response?.data || err);
    return next(err);
  }
});

/** GET /talk/me : 프런트에서 로그인 상태/프로필 확인용 */
router.get('/me', (req, res) => {
  const local = req.session?.user;
  const kakao = req.session?.kakao?.user;

  if (local) {
    const { id, email } = local;
    return res.json({ provider: 'local', id, email: email || null, nickname: null });
  }
  if (kakao) {
    const acc = kakao.kakao_account || {};
    return res.json({
      provider: 'kakao',
      id: kakao.id,
      email: acc.email || null,
      nickname: acc.profile?.nickname || null,
    });
  }
  return res.status(204).send(); // 미로그인
});

/** POST /talk/logout : 서버 세션 파괴 */
router.post('/logout', async (req, res) => {
  try {
    // 1) 카카오 세션이 있으면 카카오 로그아웃 REST 호출(토큰 무효화)
    const kakaoAccess = req.session?.kakao?.access_token;
    if (kakaoAccess) {
      try {
        await axios.post(
          'https://kapi.kakao.com/v1/user/logout',
          null,
          { headers: { Authorization: `Bearer ${kakaoAccess}` } }
        );
      } catch (e) {
        // 실패해도 서버 세션은 지워야 하므로 로깅만
        console.warn('[kakao logout] failed:', e?.response?.data || e);
      }
    }

    // 2) 서버 세션 파괴 + 쿠키 삭제
    if (!req.session) {
      res.clearCookie('sid'); // 쿠키명 커스텀이면 맞춰서 수정
      return res.status(204).send();
    }

    req.session.destroy(err => {
      if (err) {
        console.error('[logout] session destroy error:', err);
        // 세션 파괴 실패시에도 쿠키는 지워 시도
        res.clearCookie('sid');
        return res.status(500).json({ ok: false, message: '세션 삭제 실패' });
      }
      res.clearCookie('sid'); // 세션 쿠키명과 옵션을 설정과 일치시킬 것
      return res.status(204).send();
    });
  } catch (e) {
    console.error('[logout] unexpected error:', e);
    res.status(500).json({ ok: false, message: '로그아웃 중 오류' });
  }
});

module.exports = router;
