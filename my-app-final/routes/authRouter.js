const express = require("express");
const axios = require("axios");
const router = express.Router();

const { KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI, SOCKET_URL } = process.env;

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
        next: "/auth",
        ts: Date.now(),
      };
    }

    return req.session.save(() =>
      res.json({
        ok: true,
        requiresPayment: needPay,
        redirect: needPay ? "/pay" : "/auth",
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

/**
 * 카카오 로그인 시 동작하는 함수입니다.
 */
router.get("/", async (req, res, next) => {
  try {
    const { code, error, error_description } = req.query || {};

    if (error) {
      console.error("[kakao authorize error]", error, error_description);
      return res.status(400).send("카카오 인증 오류: " + (error_description || error));
    }

    if (code) {
      try {
        const params = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: KAKAO_REST_API_KEY,
          redirect_uri: KAKAO_REDIRECT_URI,
          code,
        });

        const tokenRes = await axios.post("https://kauth.kakao.com/oauth/token", params.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

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
        } catch (_) {}
        return res.redirect(303, "/auth");
      } catch (err) {
        const status = err.response?.status;
        const data = err.response?.data;
        console.error("[kakao token error]", status, data, { used_redirect_uri: KAKAO_REDIRECT_URI });
        return res.status(400).send("Kakao token exchange failed.");
      }
    }

    const hasLocal = !!req.session?.user;
    const hasKakao = !!req.session?.kakao;
    if (!hasLocal && !hasKakao) return res.redirect("/main");

    if (!req.session.paid) {
      req.session.payMeta = { from: "talk", reason: "need_payment", next: "/auth" };
      return res.redirect("/pay");
    }

    const { provider, meName } = pickMe(req);
    return res.render("talk", {
      provider,
      meName,
      socketUrl: SOCKET_URL,
    });
  } catch (err) {
    console.error("[talk error]", err?.response?.data || err);
    return next(err);
  }
});

/**
 * 어떤 계정으로 로그인 하였는지 세션을 확인하는 함수입니다.
 */
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

/**
 * 로그아웃 시 동작하는 로직입니다.
 * 카카오 세션이 있으면 삭제 해 주고,
 * 일반 세션도 삭제 해 줍니다.
 */
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

/**
 * 세션에 표기하기 위한 값을 추출하는 함수입니다.
 * @param {*} req
 * @returns
 */
const pickMe = (req) => {
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
};

module.exports = router;
