// public/javascripts/talk.js  (ES6+, document.getElementById만 사용)

// 시간 표시
const nowHHMM = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

// 연결 상태 표시
const updateConnectionStatus = (state) => {
  const badge = document.getElementById('conn-status');
  if (!badge) return;
  if (state === 'connected') {
    badge.textContent = '연결됨';
    badge.className = 'badge badge--ok';
  } else if (state === 'disconnected') {
    badge.textContent = '연결 끊김';
    badge.className = 'badge badge--error';
  } else {
    badge.textContent = '연결 중…';
    badge.className = 'badge badge--warn';
  }
};

// 메시지 추가
const appendMessage = ({ text, me = false, who = '?', time = nowHHMM() }) => {
  const list = document.getElementById('messages');
  if (!list) return;

  const li = document.createElement('li');
  li.className = `message ${me ? 'message--me' : 'message--other'}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = (who || '?').charAt(0).toUpperCase();

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const txt = document.createElement('div');
  txt.className = 'text';
  txt.textContent = text;

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = time;

  bubble.appendChild(txt);
  bubble.appendChild(meta);
  li.appendChild(avatar);
  li.appendChild(bubble);
  list.appendChild(li);
  list.scrollTop = list.scrollHeight;
};

// 입력창 자동 높이
const autosize = (ta) => {
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
};

// 전송
const sendMessage = () => {
  const input = document.getElementById('message-input');
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text) return;

  const meName = window.__ME_NAME__ || 'Me';
  appendMessage({ text, me: true, who: meName });

  // TODO: socket.emit('chat:message', { text });

  input.value = '';
  autosize(input);
};

// 수신 훅 (소켓에서 이 함수 호출 예정)
const onIncomingMessage = ({ text, who = 'Other', time = nowHHMM() }) => {
  appendMessage({ text, me: false, who, time });
};

// 입력 이벤트
const onInput = () => {
  const input = document.getElementById('message-input');
  autosize(input);
  // TODO: socket.emit('chat:typing', true/false)
};

// 로그아웃
const handleLogout = async () => {
  const root = document.getElementById('chat-app');
  const provider = root?.dataset.provider || 'local';

  // 1) 서버 세션 삭제
  try {
    if (!window.axios) throw new Error('axios not loaded');
    await window.axios.post('/auth/logout');
  } catch (e) {
    // 무시: 어차피 아래에서 클라이언트 정리 후 /main 이동
  }

  // 2) 클라이언트 정리
  try {
    // 일반 로그인: 세션스토리지만 정리(여기서는 마지막 로그인만 제거 — 회원 목록은 보존)
    // 필요 시 전체 초기화하려면 sessionStorage.clear()로 바꿔도 됨.
    sessionStorage.removeItem('contents:lastEmail');

    if (provider === 'kakao' && window.Kakao && window.Kakao.Auth) {
      try {
        // 카카오 SDK 로그아웃 (토큰 폐기)
        window.Kakao.Auth.logout(() => {});
      } catch (e) {
        console.log('[kakao logout] error:', e);
      }
    }
  } finally {
    // 3) 메인으로
    window.location.href = '/main';
  }
};

// 결제 버튼 (자리만)
const handlePayClick = () => {
  alert('결제 모듈은 나중에 연동할게요.');
};

document.addEventListener('DOMContentLoaded', () => {
  // data-*에서 내 이름/프로바이더 읽기
  const root = document.getElementById('chat-app');
  const me = root?.dataset.me || 'User';
  const provider = root?.dataset.provider || 'local';
  window.__ME_NAME__ = me;
  window.__PROVIDER__ = provider;

  const meSpan = document.getElementById('me-name');
  if (meSpan) meSpan.textContent = me;

  // 초기 연결 상태
  updateConnectionStatus('connecting');
  // TODO: socket 연결 시
  // socket.on('connect', () => updateConnectionStatus('connected'));
  // socket.on('disconnect', () => updateConnectionStatus('disconnected'));

  // 버튼/입력 바인딩 (document.getElementById만 사용)
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  const btnPay = document.getElementById('btn-pay');
  if (btnPay) btnPay.addEventListener('click', handlePayClick);

  const btnSend = document.getElementById('btn-send');
  if (btnSend) btnSend.addEventListener('click', sendMessage);

  const input = document.getElementById('message-input');
  if (input) {
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // 환영 메시지(옵션)
  appendMessage({ text: '채팅에 오신 걸 환영합니다!', who: 'System' });
});

// 디버그용(선택)
window.ChatUI = { updateConnectionStatus, appendMessage, onIncomingMessage };
