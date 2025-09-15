const { parentPort } = require("worker_threads");

/**
 * $p 관련 자동완성을 해 주는 기능입니다.
 * 해당 기능은 자식 worker 쓰레드 에서 동작합니다.
 * 동작 순서는 아래와 같습니다.
 * 1. 안전 처리 & 전처리
 * 2. 토큰화 & 탐색
 * 3. 상황 판정 
 * 4. 출력 구성 
 * 5. 워커 통신
 * @param {*} apiJson 
 * @param {*} inputText 
 * @returns 
 */
const buildAutoComplete = (apiJson, inputText) => {
  const src = typeof apiJson === "string" ? JSON.parse(apiJson) : apiJson;
  const text = String(inputText || "").trim();
  if (!text.startsWith("$p")) return { result: {} };

  const P = src && src["$p"];
  if (!P || typeof P !== "object") return { result: {} };

  const endsWithDot = text.endsWith(".");
  const tokens = text.replace(/\.$/, "").split(".").filter(Boolean);

  let node = P;
  let parent = null;

  for (let i = 1; i < tokens.length; i++) {
    const key = tokens[i];
    if (node && typeof node === "object" && key in node) {
      parent = node;
      node = node[key];
    } else {
      parent = parent ?? P;
      node = null;
      break;
    }
  }

  const isJustP = tokens.length === 1;
  const isExact = !!node && !endsWithDot && tokens.length > 1;
  const lastTok = tokens.length ? tokens[tokens.length - 1] : "";
  const isPrefix = (!isExact && tokens.length >= 2) || (endsWithDot && tokens.length >= 2 && !(node && lastTok in node));

  let baseNode;
  let prefix = null;

  if (isJustP) {
    baseNode = P;
    prefix = "";
  } else if (isExact) {
    baseNode = node;
    prefix = null;
  } else if (isPrefix) {
    baseNode = parent;
    prefix = lastTok || "";
  } else if (endsWithDot && node) {
    baseNode = node;
    prefix = "";
  } else {
    baseNode = P;
    prefix = "";
  }

  if (prefix !== null) {
    prefix = prefix.replace(/[^A-Za-z0-9_]/g, "");
  }

  const pickMeta = (obj) => {
    const o = {};
    if (obj && typeof obj === "object") {
      if (obj["!type"] != null) o["!type"] = obj["!type"];
      if (obj["!doc"] != null) o["!doc"] = obj["!doc"];
    }
    return o;
  };

  const out = {};
  if (isExact) {
    const exactKey = tokens[tokens.length - 1];
    out[exactKey] = pickMeta(baseNode);
    return { result: out };
  }

  Object.keys(baseNode || {}).forEach((k) => {
    if (k === "!type" || k === "!doc") return;
    if (prefix && !k.toLowerCase().startsWith(prefix.toLowerCase())) return;
    out[k] = pickMeta(baseNode[k]);
  });

  return { result: out };
};

parentPort.on("message", (value) => {
  try {
    const { apiJson, body } = value || {};
    const result = buildAutoComplete(apiJson, body && body.key);
    parentPort.postMessage(result);
  } catch (e) {
    parentPort.postMessage({ error: e.message, result: {} });
  } finally {
    parentPort.close();
  }
});
