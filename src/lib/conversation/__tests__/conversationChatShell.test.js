// CONV-CHAT-001 ② — 대화 모드 채팅앱 껍데기 계약(notes/conversation-chat-shell.md).
// 화면 배치는 e2e·실기 사진으로 보고, 여기서는 되돌아가면 안 되는 규칙만 고정한다.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  handleConversationKeyDown, CONVERSATION_COMPOSER_MAX_LINES, CONVERSATION_NEAR_BOTTOM_PX,
} from '../../../components/conversation/ConversationThread';
import { sliceBetween } from '../../__tests__/helpers/sliceBetween.js';

const read = (rel) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');
const press = (event, touch) => {
  const send = vi.fn();
  handleConversationKeyDown({ key: 'Enter', keyCode: 13, preventDefault: vi.fn(), ...event }, send, touch);
  return send.mock.calls.length;
};

describe('입력창', () => {
  it('터치 화면의 Enter는 줄바꿈 — 전송은 ➤ 버튼만', () => {
    expect(press({}, true)).toBe(0);
    expect(press({ shiftKey: true }, true)).toBe(0);
  });
  it('PC는 Enter 전송 · Shift+Enter 줄바꿈 · 변환 중 Enter 무시', () => {
    expect(press({}, false)).toBe(1);
    expect(press({ shiftKey: true }, false)).toBe(0);
    expect(press({ isComposing: true }, false)).toBe(0);
    expect(press({ keyCode: 229 }, false)).toBe(0);
  });
  it('한 줄에서 시작해 다섯 줄까지 자라고, 빈칸이면 마이크 · 글자가 있으면 보내기', () => {
    const thread = read('components/conversation/ConversationThread.jsx');
    expect(CONVERSATION_COMPOSER_MAX_LINES).toBe(5);
    expect(thread).toContain('rows={1}');
    expect(thread).toContain('const showMic = sttSupported && (!canSend || listening);');
  });
});

describe('대화 목록', () => {
  it('맨 아래 근처일 때만 따라가고, 위를 보면 「새 메시지 ↓」', () => {
    const thread = read('components/conversation/ConversationThread.jsx');
    const shell = read('components/conversation/useChatShell.js');
    expect(CONVERSATION_NEAR_BOTTOM_PX).toBe(100);
    expect(shell).toContain('if (sentRef.current || nearBottomRef.current) toBottom(true);');
    expect(thread).toContain('useChatScroll(logRef');
    expect(thread).toContain('새 메시지 ↓');
  });
  it('듣기·번역은 말풍선 아래 작은 아이콘 — 문자 칩이 아니다', () => {
    const thread = read('components/conversation/ConversationThread.jsx');
    expect(thread).not.toContain('🔊 듣기');
    expect(thread).toContain('className="conv-act"');
  });
  it('다시 말하기가 열린 피드백만 펼치고, 나머지는 한 줄로 접는다', () => {
    const thread = read('components/conversation/ConversationThread.jsx');
    expect(thread).toContain('const fbOpen = item.openRetry || onlyFixed || openFb.has(item.index);');
  });
});

describe('화면 틀', () => {
  it('대화는 쪽으로 나누지 않고, 읽기 상단바·머리·분석 배너·교재 단원을 그리지 않는다', () => {
    const viewer = read('views/ViewerPage.jsx');
    expect(viewer).toContain("const pagedActive = readerView === 'paged' && !classStudyActive && !conversation;");
    expect(viewer).toContain("data-chat={conversation?'true':undefined}");
    expect(viewer).toContain('{!conversation&&<div className="viewer-topbar">');
    expect(viewer).toContain('{!conversation&&<header className="page-header viewer-header">');
    expect(viewer).toContain('{needsRecovery && user?.id === material?.owner_id && !conversation && (');
    expect(viewer).toContain('{isAnalyzing && !needsRecovery && !conversation && (');
    expect(viewer).toContain('!conversation && <MaterialChapterLinks');
  });
  it('전체 높이 껍데기 — 입력창은 고정 배치가 아니라 맨 아래 줄, 전역 메뉴·하단 탭은 대화에서만 숨긴다', () => {
    const css = read('components/conversation/conversation.css');
    expect(css).toContain('height: var(--conv-vh, 100dvh)');
    expect(css).toMatch(/\.conv__log \{[^}]*overflow-y: auto/);
    expect(css).not.toMatch(/\.conv__input \{[^}]*position: (sticky|fixed)/);
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('.manabi-app:has(.viewer-layout[data-chat="true"]) > .gnb');
  });
  it('viewport 메타는 이 화면에서만 바꾸고 나가면 되돌린다', () => {
    const thread = read('components/conversation/ConversationThread.jsx');
    const shell = read('components/conversation/useChatShell.js');
    expect(shell).toContain('interactive-widget=resizes-content, viewport-fit=cover');
    expect(shell).toContain("if (meta && before != null) meta.setAttribute('content', before);");
    expect(shell).toContain("vv.addEventListener('resize', fit);");
    expect(thread).toContain('useChatViewport(shellRef');
  });
});

// CONV-CHAT-001 6차 — 글꼴 한 벌 · 앱 같은 움직임(오너 2026-10-16). 화면은 실제 글꼴 빌드 사진으로 보고, 여기서는 되돌아가면 안 되는 규칙만.
describe('글꼴', () => {
  const css = read('components/conversation/conversation.css');
  it('두 대화방 화면 글자는 Noto Sans KR 한 벌', () => {
    expect(css).toMatch(/\.conv \{[^}]*font-family: var\(--font-noto-kr, 'Noto Sans KR'\), sans-serif;/);
  });
  it('font: inherit을 쓰는 입력창·모두의 대화방 말풍선도 학습 언어 글꼴로 — 일본어가 한국어 글꼴로 그려지지 않게', () => {
    expect(css).toContain(".conv :is(.conv-lobby__bubble, .conv-bubble--pending, .conv__textarea):lang(ja) { font-family: var(--font-noto-jp, 'Noto Sans JP')");
    expect(css).toContain(".conv :is(.conv-lobby__bubble, .conv-bubble--pending, .conv__textarea):lang(zh) { font-family: var(--font-noto-sc, 'Noto Sans SC')");
    for (const file of ['components/conversation/ConversationThread.jsx', 'views/ConversationLobbyPage.jsx']) {
      expect(read(file)).toMatch(/className="conv__textarea"\s+lang=\{/);
    }
  });
  it('모두의 대화방 말풍선 글자 크기도 튜터 방과 같다', () => {
    expect(css).toMatch(/\.conv-lobby__bubble \{[^}]*font: inherit; font-size: 0\.97rem;/);
  });
});

describe('앱 같은 움직임', () => {
  const css = read('components/conversation/conversation.css');
  const motion = sliceBetween(css, '@keyframes conv-enter');
  const reduce = sliceBetween(motion, '@media (prefers-reduced-motion: reduce)');
  it('짧게(0.25초 이하) · transform/opacity만 움직인다', () => {
    const secs = [...motion.matchAll(/animation: [\w-]+ (\d?\.\d+)s/g)].map((m) => Number(m[1]));
    expect(secs.length).toBeGreaterThanOrEqual(4);
    for (const sec of secs) expect(sec).toBeLessThanOrEqual(0.25);
    const frames = [...motion.matchAll(/^@keyframes ([\w-]+) \{(.*)\}$/gm)];
    expect(frames.map((m) => m[1])).toEqual(['conv-enter', 'conv-pop', 'conv-fade', 'conv-jump-in']);
    for (const [, , body] of frames) expect(body.replace(/opacity|transform/g, '')).not.toMatch(/[a-z-]+:/);
  });
  it('「움직임 줄이기」에서는 모두 멈춘다 — 부드러운 스크롤 포함', () => {
    for (const sel of ['.conv,', '.conv-anim-in', '.conv-anim-fade', '.conv__jump']) expect(reduce).toContain(sel);
    expect(reduce).toContain('animation: none;');
    expect(reduce).toContain('transition: none;');
    expect(read('components/conversation/useChatShell.js')).toContain("behavior: smooth && !reducedMotion() ? 'smooth' : 'auto'");
  });
  it('새로 도착한 말만 떠오른다 — 방을 열 때 지난 말은 그대로, 내 말은 보내는 중 말풍선만', () => {
    const thread = read('components/conversation/ConversationThread.jsx');
    const lobby = read('views/ConversationLobbyPage.jsx');
    expect(thread).toContain("useArrivals(items.map((item) => item.index), { resetKey: materialId })");
    expect(thread).toContain("conv__row--tutor${arrived(item.index) ? ' conv-anim-in' : ''}");
    expect(thread).toContain('<div className="conv__row conv__row--me conv-anim-in">');
    expect(lobby).toContain('useArrivals(messages.map((m) => m.id), { resetKey: language, ready: query.isSuccess })');
    expect(lobby).toContain('<div className="conv-lobby__row conv-lobby__row--me conv-anim-in">');
  });
});

describe('PC 휴대폰 틀(9차)', () => {
  const css = read('components/conversation/conversation.css');
  const frame = sliceBetween(css, '.phone-stage, .phone-stage__device, .phone-stage__screen');
  it('틀은 마우스로 쓰는 키 큰 화면에서만 켜지고, 폰·태블릿(터치)에서는 사라진다 — 폭 브레이크포인트를 새로 쓰지 않는다', () => {
    expect(frame.startsWith('.phone-stage, .phone-stage__device, .phone-stage__screen { display: contents; }')).toBe(true);
    expect(frame).toContain('.phone-stage__status, .phone-stage__home { display: none; }');
    expect(frame).toContain('@media (hover: hover) and (pointer: fine) and (min-height: 700px) {');
    expect(frame).not.toMatch(/@media[^{]*(max|min)-width/);
  });
  it('화면 폭은 폰 그대로 390px, 틀 윗변은 메뉴 높이와 상관없이 같은 자리 — 방을 오가도 휴대폰이 움직이지 않는다', () => {
    expect(frame).toContain('width: min(410px, calc(100vw - 32px));');
    expect(frame).toContain('border: 10px solid var(--phone-bezel);');
    expect(frame).toContain('padding: max(16px, calc(var(--phone-top) - var(--gnb-height, 64px))) 16px 20px;');
    expect(frame).toContain('.phone-stage__screen .conv { height: 100%; top: 0; padding-top: var(--phone-status-h); }');
  });
  it('방 목록·모두의 대화방·튜터 대화방이 같은 틀을 쓴다', () => {
    expect(read('views/NewConversationPage.jsx').match(/<PhoneFrame>/g)).toHaveLength(3);
    expect(read('views/ConversationLobbyPage.jsx').match(/<PhoneFrame>/g)).toHaveLength(3);
    expect(read('views/ViewerPage.jsx')).toMatch(/<PhoneFrame>\s*<ConversationThread/);
    const phone = read('components/conversation/PhoneFrame.jsx');
    expect(phone).toContain('<div className="phone-stage__status" aria-hidden="true">');
    expect(phone).toContain("timeZone: 'Asia/Seoul'");
  });
});
