const { parentPort, workerData } = require('worker_threads');

parentPort.on('message', (value) => {
    
    const { apiJson, body } = value;
    let result = 0;

    try {
        /**
         * 이 부분에 body에 입력받은 문자열을 가지고
         * apiJson에 해당 값이 있다면,type과 doc을 result에 담아서 
         * 돌려주는 로직을 만들어야 한다.
         */
        // console.log("apiJson : ",apiJson)
        // console.log("body : ",body)

        console.log("워커로직동작")
        result = buildAutoComplete(JSON.parse(apiJson), body.key);
        console.log("result: ",result)

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
 * @param {*} apiJson 
 * @param {*} inputText 
 * @returns 
 */
function buildAutoComplete(apiJson, inputText) {
  // 0) $p 로 시작 안 하면 빈값
  if (!inputText || !inputText.trim().startsWith('$p')) return { result: {} };

  // 1) 문자열 JSON이면 파싱
  const parsed = (typeof apiJson === 'string') ? JSON.parse(apiJson) : apiJson;

  const P = parsed && parsed['$p'];
  if (!P || typeof P !== 'object') return { result: {} };

  const raw = inputText.trim();
  const endsWithDot = raw.endsWith('.');
  // "$p.data." -> ["$p","data"], "$p." -> ["$p"]
  const tokens = raw.replace(/\.$/, '').split('.').filter(Boolean);

  // 2) 경로 따라 최대한 내려가기
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

  const isJustP  = (tokens.length === 1);                                // "$p" or "$p."
  const isExact  = (!!node && !endsWithDot && tokens.length > 1);        // "$p.xxx" 정확 일치
  const lastTok  = tokens.length ? tokens[tokens.length - 1] : '';
  const isPrefix = (!isExact && tokens.length >= 2)
                || (endsWithDot && tokens.length >= 2 && !(node && lastTok in node));

  // 3) 기준 노드/접두어 결정
  let baseNode, prefix = null;
  if (isJustP) {
    baseNode = P;     prefix = '';
  } else if (isExact) {
    baseNode = node;  prefix = '';
  } else if (isPrefix) {
    baseNode = parent; prefix = lastTok || '';
  } else if (endsWithDot && node) {
    baseNode = node;  prefix = '';
  } else {
    baseNode = P;     prefix = '';
  }

  // 접두어 정규화: 영숫자/밑줄만 유지 ("r@@" -> "r")
  if (prefix !== null) prefix = prefix.replace(/[^A-Za-z0-9_]/g, '');

  // 4) 결과 구성
  const result = {};

  // 현재(baseNode)의 메타 항상 포함
  if (baseNode && typeof baseNode === 'object') {
    if (baseNode['!type'] != null) result['!type'] = baseNode['!type'];
    if (baseNode['!doc']  != null) result['!doc']  = baseNode['!doc'];

    // 한 칸 하위 수집 + 각 자식의 메타 포함
    Object.keys(baseNode).forEach(k => {
      if (k === '!type' || k === '!doc') return;
      if (prefix && !k.toLowerCase().startsWith(prefix.toLowerCase())) return;

      const child = baseNode[k];
      const childObj = {};
      if (child && typeof child === 'object') {
        if (child['!type'] != null) childObj['!type'] = child['!type'];
        if (child['!doc']  != null) childObj['!doc']  = child['!doc'];
      }
      result[k] = childObj;
    });
  }

  return result;
}