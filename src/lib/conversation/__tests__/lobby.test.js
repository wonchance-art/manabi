// 모두의 대화방(CONV-LOBBY-001) — 순수 규칙과 화면 계약. 접근 규칙(RLS)은 supabase/tests/conversation-lobby.mjs.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  LOBBY_MAX_CHARS, LOBBY_PAGE, cleanLobbyText, isLobbyMissing, lobbyErrorText, lobbyHref, lobbyMessages,
  lobbyRateGate, lobbyThread, LOBBY_SOON_TEXT,
} from '../lobby';
import { clockLabel } from '../chatView';

const read = (rel) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');
const T = Date.parse('2026-10-15T06:07:10Z'); // 15:07 KST
const row = (id, user, at, body = `말 ${id}`, extra = {}) => ({
  id, user_id: user, body, created_at: new Date(at).toISOString(), hidden_at: null, author: { display_name: user === 'me' ? '나' : `이름${user}` }, ...extra,
});

describe('보낼 말 다듬기', () => {
  it('공백만이면 보내지 않고, 300자에서 자르고, 빈 줄은 하나까지만', () => {
    expect(cleanLobbyText('   ')).toBe(null);
    expect(cleanLobbyText(null)).toBe(null);
    expect(cleanLobbyText(' こんにちは ')).toBe('こんにちは');
    expect(cleanLobbyText('a\n\n\n\nb')).toBe('a\n\nb');
    expect(cleanLobbyText('あ'.repeat(400))).toHaveLength(LOBBY_MAX_CHARS);
  });
  it('10초에 5건까지만 — 서버 거절과 같은 기준', () => {
    let recent = [];
    for (let i = 0; i < 5; i++) {
      const g = lobbyRateGate(recent, T + i);
      expect(g.allowed).toBe(true);
      recent = g.recent;
    }
    expect(lobbyRateGate(recent, T + 9000).allowed).toBe(false);
    expect(lobbyRateGate(recent, T + 10001).allowed).toBe(true);
  });
});

describe('말 목록', () => {
  it('오래된 말이 위, 음소거한 사람은 빼되 내 말은 남긴다, 이름이 없으면 「학습자」', () => {
    const rows = [row(3, 'b', T), row(2, 'me', T - 1000), row(1, 'a', T - 2000, 'x', { author: null })];
    const list = lobbyMessages(rows, { me: 'me', isMuted: (id) => id === 'b' || id === 'me' });
    expect(list.map((m) => m.id)).toEqual(['1', '2']);
    expect(list[0].name).toBe('학습자');
    expect(list[1].mine).toBe(true);
  });
  it('같은 사람·같은 분은 한 묶음 — 이름은 첫 말, 시각은 마지막 말에만', () => {
    const list = lobbyThread(lobbyMessages([
      row(1, 'a', T), row(2, 'a', T + 20000), row(3, 'b', T + 25000), row(4, 'a', T + 90000),
    ], { me: 'me' }));
    expect(list.map((m) => [m.first, m.last])).toEqual([[true, false], [false, true], [true, true], [true, true]]);
    expect(list[1].time).toBe('오후 3:07');
  });
  it('날이 바뀌면(KST) 구분선', () => {
    const night = Date.parse('2026-10-14T14:59:00Z'); // 23:59 KST
    const list = lobbyThread(lobbyMessages([row(1, 'a', night), row(2, 'a', night + 120000)], {}));
    expect(list.map((m) => m.dateSep)).toEqual([true, true]);
    expect(list[1].first).toBe(true);
  });
});

describe('표 적용 전에는 오류 대신 「곧 열려요」', () => {
  it('표 없음 오류를 알아본다', () => {
    expect(isLobbyMissing({ code: 'PGRST205', message: "Could not find the table 'public.conversation_lobby_messages' in the schema cache" })).toBe(true);
    expect(isLobbyMissing({ code: '42P01' })).toBe(true);
    expect(isLobbyMissing({ code: '23505' })).toBe(false);
    expect(isLobbyMissing(null)).toBe(false);
    expect(lobbyErrorText({ code: 'PGRST205' })).toBe(LOBBY_SOON_TEXT);
    expect(lobbyErrorText({ message: 'lobby_rate_limited' })).toMatch(/천천히/);
  });
});

describe('화면 계약', () => {
  const page = read('views/ConversationLobbyPage.jsx');
  const list = read('views/NewConversationPage.jsx');
  const css = read('components/conversation/conversation.css');
  it('대화방 목록 맨 위에 모두의 대화방이 고정된다', () => {
    expect(list.indexOf('conv-rooms__row--lobby')).toBeGreaterThan(-1);
    expect(list.indexOf('conv-rooms__row--lobby')).toBeLessThan(list.indexOf('{rooms.map('));
    expect(lobbyHref('Japanese')).toBe('/conversation/lobby?lang=Japanese');
  });
  it('튜터 대화방과 같은 껍데기·부품 — 전역 메뉴를 숨기고, 키보드·스크롤 규칙을 공유한다', () => {
    expect(page).toContain('<div className="conv-page" data-chat="true">');
    expect(css).toContain('.manabi-app:has(.conv-page[data-chat="true"]) > .gnb');
    expect(page).toContain('useChatViewport(shellRef');
    expect(page).toContain('useChatScroll(logRef');
    expect(page).toContain('handleConversationKeyDown(e, send)');
  });
  it('지난 말 100개 · 실시간 + 30초 따라잡기 · 지우기/신고/가리기', () => {
    expect(LOBBY_PAGE).toBe(100);
    expect(page).toContain('subscribeLobby(supabase, language, refresh)');
    expect(page).toContain('30000');
    for (const label of ['>지우기<', '>신고<', '>이 사람 가리기<']) expect(page).toContain(label);
    expect(page).toContain('toggleMute(m.userId)');
  });
  it('표가 없으면 입력창을 닫는다(저장 오류 0)', () => {
    expect(page).toContain('disabled={missing}');
    expect(list).toContain("lobbySoon ? '곧 열려요'");
  });
});
