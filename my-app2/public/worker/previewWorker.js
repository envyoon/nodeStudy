const { parentPort, workerData } = require('worker_threads');

/**
 * 워커 작업 내용입니다.
 * apiJson과 입력받은 text로 파싱하여 넘겨줍니다.
 */
parentPort.on('message', (value) => {
    
    const { apiJson, body } = value;
    let result = 0;

    try {
        // WebSquareAPI.json과 입력받은 문자열로 결과값을 생성합니다.
        result = buildAutoComplete(JSON.parse(apiJson), body.key);
    } catch (e) {
        result = { error: e.message };
    }

    // 부모에게 결과 전달
    parentPort.postMessage(result);

    // 워커 종료
    parentPort.close();
});

/**
 * 해당 부분은 AI 가 해줌.. 내 머리로는 파싱로직을 시간내에 해낼 수 없다고 생각했음 ;
 * 요은누나 대단해..
 * @param {*} apiJson 
 * @param {*} inputText 
 * @returns 
 */
const buildAutoComplete = (apiJson, inputText) =>{
  // $p 로 시작 안 하면 빈값
  if (!inputText || !inputText.trim().startsWith('$p')) return { result: {} };

  // 문자열 JSON이면 파싱
  const parsed = (typeof apiJson === 'string') ? JSON.parse(apiJson) : apiJson;
  const P = parsed && parsed['$p'];
  if (!P || typeof P !== 'object') return { result: {} };

  const raw = inputText.trim();
  const endsWithDot = raw.endsWith('.');
  const tokens = raw.replace(/\.$/, '').split('.').filter(Boolean);

  // 경로 따라 최대한 내려가기
  let node = P, parent = null;
  for (let i = 1; i < tokens.length; i++) {
    const key = tokens[i];
    if (node && typeof node === 'object' && key in node) {
      parent = node;
      node = node[key];
    } else {
      parent = parent ?? P;
      node = null; // 여기서부터 접두어 모드
      break;
    }
  }

  const isJustP  = (tokens.length === 1);                        // "$p" or "$p."
  const isExact  = (!!node && !endsWithDot && tokens.length > 1); // "$p.xxx" 완전일치
  const lastTok  = tokens.length ? tokens[tokens.length - 1] : '';
  const isPrefix = (!isExact && tokens.length >= 2)
                || (endsWithDot && tokens.length >= 2 && !(node && lastTok in node));

  let baseNode, prefix = null;
  if (isJustP) {
    baseNode = P; prefix = '';
  } else if (isExact) {
    // 완전 일치: 마지막 노드가 기준
    baseNode = node; prefix = null;
  } else if (isPrefix) {
    baseNode = parent; prefix = lastTok || '';
  } else if (endsWithDot && node) {
    baseNode = node; prefix = '';
  } else {
    baseNode = P; prefix = '';
  }

  if (prefix !== null) prefix = prefix.replace(/[^A-Za-z0-9_]/g, '');

  // 메타 추출 헬퍼
  const pickMeta = (obj) => {
    const o = {};
    if (obj && typeof obj === 'object') {
      if (obj['!type'] != null) o['!type'] = obj['!type'];
      if (obj['!doc']  != null) o['!doc']  = obj['!doc'];
    }
    return o;
  };

  // 결과 구성
  const out = {};

  if (isExact) {
    // 완전 일치: 해당 키만 감싸서 반환
    const exactKey = tokens[tokens.length - 1];
    out[exactKey] = pickMeta(baseNode);
    return { result: out };
  }

  // 접두어/최상위: 한 칸 하위 나열 (각 자식의 메타 포함)
  Object.keys(baseNode || {}).forEach(k => {
    if (k === '!type' || k === '!doc') return;
    if (prefix && !k.toLowerCase().startsWith(prefix.toLowerCase())) return;
    out[k] = pickMeta(baseNode[k]);
  });

  return { result: out };
}