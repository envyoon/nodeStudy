// routes/kcpCancel.js
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const crypto = require("crypto");
const router = express.Router();

const isProd = process.env.KCP_ENV === "prod";
const KCP_CANCEL_API = isProd ? "https://spl.kcp.co.kr/gw/mod/v1/cancel" : "https://stg-spl.kcp.co.kr/gw/mod/v1/cancel";

const SITE_CD = process.env.KCP_SITE_CD; // 예: T0000
const CERT_INFO = process.env.KCP_CERT_INFO; // PEM 직렬화 텍스트
const PRIVATE_KEY = fs.readFileSync(process.env.KCP_PRIVATE_KEY_FILE, "utf8"); // PKCS#8/PKCS#1

router.post("/kcp/cancel", async (req, res) => {
  try {
    const { tno, reason = "merchant_cancel" } = req.body;
    const mod_type = "STSC"; // 전체취소. 부분취소는 STPC

    if (!tno) return res.status(400).json({ ok: false, message: "tno required" });

    // kcp_sign_data = site_cd + "^" + tno + "^" + mod_type
    const toSign = `${SITE_CD}^${tno}^${mod_type}`;
    const kcp_sign_data = crypto.createSign("RSA-SHA256").update(toSign, "utf8").sign(PRIVATE_KEY, "base64");

    const payload = {
      site_cd: SITE_CD,
      kcp_cert_info: CERT_INFO,
      kcp_sign_data,
      mod_type,
      tno,
      mod_desc: reason,
    };

    const { data } = await axios.post(KCP_CANCEL_API, payload, { headers: { "Content-Type": "application/json" } });

    if (data?.res_cd === "0000") return res.json({ ok: true, data });
    return res.status(400).json({ ok: false, message: data?.res_msg || "cancel failed", data });
  } catch (e) {
    console.error("[KCP cancel]", e?.response?.data || e);
    res.status(500).json({ ok: false, message: "server error" });
  }
});

module.exports = router;
