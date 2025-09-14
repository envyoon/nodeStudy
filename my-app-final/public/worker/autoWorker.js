// public/worker/autoWorker.js
const { parentPort } = require("worker_threads");

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
      node = null; // 여기서부터 prefix 검색
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
