// routes/payRouter.js
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const DEFAULT_AMOUNT = 990;

/** 로그인 여부 */
function ensureAuthed(req, res, next) {
  if (req.session?.user || req.session?.kakao) return next();
  return res.redirect("/main");
}

/** 결제 플로우 토큰(payMeta) 필수 + 이미 결제면 /talk */
function ensurePayFlow(req, res, next) {
  if (req.session?.paid) return res.redirect("/auth");
  const meta = req.session?.payMeta;
  const TTL_MS = 5 * 60 * 1000; // 5분
  const now = Date.now();
  if (!meta || !meta.from || (meta.ts && now - meta.ts > TTL_MS)) {
    delete req.session.payMeta;
    return res.redirect("/main");
  }
  next();
}

/** 표시용 이름 */
function whoAmI(req) {
  return req.session?.user?.email || req.session?.user?.id || req.session?.kakao?.user?.kakao_account?.email || "사용자";
}

/** 환경설정 */
const isProd = process.env.KCP_ENV === "prod";
const KCP_JS_URL = isProd ? "https://spay.kcp.co.kr/plugin/kcp_spay_hub.js" : "https://testspay.kcp.co.kr/plugin/kcp_spay_hub.js";
const KCP_PAYMENT_API = isProd ? "https://spl.kcp.co.kr/gw/enc/v1/payment" : "https://stg-spl.kcp.co.kr/gw/enc/v1/payment";
const KCP_SITE_CD = process.env.KCP_SITE_CD || "T0000";
const KCP_CERT_INFO = (() => {
  const p = process.env.KCP_CERT_INFO_FILE;
  try {
    return fs.readFileSync(path.resolve(p), "utf8");
  } catch (e) {
    console.warn("[KCP] CERT file read failed:", e?.message || e);
  }
})();

/** 주문번호(서버 생성) */
function genOrderId() {
  const t = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `ORD${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}${t.getTime()}`;
}

/** GET /pay : 결제 페이지 */
router.get("/", ensureAuthed, ensurePayFlow, (req, res) => {
  const meta = req.session.payMeta || {};
  const amount = String(meta.amount ?? DEFAULT_AMOUNT);
  const goodName = meta.goodName || "채팅 이용권";

  // 서버에서 주문번호 발급(없으면)
  if (!meta.ordr_idxx) {
    req.session.payMeta.ordr_idxx = genOrderId();
  }

  const buyer = {
    name: whoAmI(req),
    email: req.session?.user?.email || req.session?.kakao?.user?.kakao_account?.email || "",
    tel: req.session?.kakao?.user?.kakao_account?.phone_number || "",
  };

  if (process.env.DEBUG_KCP) {
    console.log("[KCP] env:", process.env.KCP_ENV);
    console.log("[KCP] site_cd:", KCP_SITE_CD);
  }

  res.render("pay", {
    who: buyer.name,
    meta,
    kcpJsUrl: KCP_JS_URL,
    kcpSiteCd: KCP_SITE_CD,
    order: {
      id: req.session.payMeta.ordr_idxx,
      name: goodName,
      amount,
    },
    buyer,
  });
});

/** GET /pay/leave : 돌아가기(플로우 종료) */
router.get("/leave", async (req, res) => {
  // 결제 플로우 흔적 제거
  delete req.session?.payMeta;

  try {
    const kakaoAccess = req.session?.kakao?.access_token;
    if (kakaoAccess) {
      await axios.post("https://kapi.kakao.com/v1/user/logout", null, { headers: { Authorization: `Bearer ${kakaoAccess}` } });
    }
  } catch (e) {
    console.warn("[pay/leave] kakao logout failed:", e?.response?.data || e);
  }

  // 서버 세션 파괴 + sid 쿠키 삭제
  if (!req.session) {
    res.clearCookie("sid");
    return res.redirect("/main");
  }
  req.session.destroy((err) => {
    // 세션 파괴 실패해도 sid 쿠키는 지워서 강제 로그아웃 상태로
    res.clearCookie("sid");
    return res.redirect("/main");
  });
});

/** POST /pay/kcp/pay : 결제 승인 API */
router.post("/kcp/pay", ensureAuthed, ensurePayFlow, async (req, res) => {
  try {
    const { tran_cd, enc_info, enc_data, good_mny, use_pay_method } = req.body || {};

    // 기본 필드 체크
    if (!tran_cd || !enc_info || !enc_data) {
      req.session.payMeta.error = "결제 인증 정보가 없습니다. 다시 시도해 주세요.";
      return res.redirect("/pay");
    }

    // 금액/주문번호 서버 검증
    const meta = req.session.payMeta || {};
    const expectedAmount = String(meta.amount ?? DEFAULT_AMOUNT);

    if (String(good_mny || "") !== expectedAmount) {
      return res.status(400).render("pay_result", {
        error: "결제 금액 불일치",
        data: { good_mny, expectedAmount },
      });
    }

    // 결제 타입 확인
    const maskToPayType = (mask = "") => {
      switch (String(mask).trim()) {
        case "100000000000":
          return "PACA"; // 신용카드
        case "010000000000":
          return "PABK"; // 계좌이체
        case "001000000000":
          return "PAVC"; // 가상계좌
        case "000010000000":
          return "PAMC"; // 휴대폰
        default:
          if (/^PA[A-Z]{2}$/i.test(mask)) return mask.toUpperCase();
          return undefined;
      }
    };

    const pay_type = maskToPayType(use_pay_method);

    console.log("pay_type >>> ", pay_type);

    const reqData = {
      tran_cd,
      site_cd: KCP_SITE_CD,
      kcp_cert_info: KCP_CERT_INFO,
      enc_data,
      enc_info,
      ordr_mony: expectedAmount,
      pay_type: pay_type,
    };

    if (process.env.DEBUG_KCP) {
      console.log("[KCP] request summary:", {
        endpoint: KCP_PAYMENT_API,
        site_cd: reqData.site_cd,
        ordr_mony: reqData.ordr_mony,
        tran_cd: reqData.tran_cd,
        enc_info_len: (enc_info || "").length,
        enc_data_len: (enc_data || "").length,
      });
    }

    const { data } = await axios.post(KCP_PAYMENT_API, reqData, {
      headers: { "Content-Type": "application/json" },
      timeout: 1000 * 30,
    });

    if (process.env.DEBUG_KCP) {
      console.log("[KCP] res_cd:", data?.res_cd, "res_msg:", data?.res_msg);
    }

    if (data?.res_cd === "0000" && data?.tno) {
      req.session.paid = true;
      const next = meta.next || "/talk";
      delete req.session.payMeta;
      return res.redirect(next);
    }

    // 실패 → 에러 메시지 저장 후 /pay
    req.session.payMeta.error = data?.res_msg || "결제가 실패했습니다. 다른 수단으로 다시 시도해주세요.";
    return res.redirect("/pay");
  } catch (e) {
    console.error("[/pay/kcp/pay] error:", e?.response?.data || e);
    req.session.payMeta.error = "결제 처리 중 오류가 발생했습니다.";
    return res.redirect("/pay");
  }
});

module.exports = router;
