// KCP 콜백 — 반드시 전역에 있어야 하므로 window에 심는다.
const m_Completepayment = (FormOrJson, closeEvent) => {
  const frm = document.kcpForm;
  if (!frm) return;

  // KCP가 내려준 필드를 폼에 주입 (GetField는 KCP 스크립트에서 제공)
  try {
    if (typeof GetField === "function") {
      GetField(frm, FormOrJson);
    }
  } catch (e) {
    console.warn("[KCP] GetField error:", e);
  }

  if (frm.res_cd.value === "0000") {
    // 승인 API 호출(서버 /pay/kcp/pay)이 최종 판정을 내림
    frm.submit();
  } else {
    alert("[" + frm.res_cd.value + "] " + frm.res_msg.value);
    if (typeof closeEvent === "function") closeEvent();
  }
};
window.m_Completepayment = m_Completepayment; // 전역 등록 (KCP가 이 이름을 콜백으로 호출)

// 결제창 오픈 헬퍼
const jsf__pay = (form) => {
  try {
    if (typeof KCP_Pay_Execute_Web !== "function") {
      alert("결제 모듈이 준비되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    KCP_Pay_Execute_Web(form);
  } catch (e) {
    console.warn("[KCP] execute error:", e);
  }
};
window.jsf__pay = jsf__pay; // 전역 등록

// 페이지 바인딩
const bindPayPage = () => {
  // URL 정리 (?from=... 제거)
  if (location.search) history.replaceState(null, "", location.pathname);

  // "결제하기" 클릭 → 결제창 실행
  const btn = document.getElementById("btn-kcp");
  const form = document.getElementById("kcpForm");
  if (btn && form) {
    btn.addEventListener("click", () => jsf__pay(form));
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindPayPage);
} else {
  bindPayPage();
}
