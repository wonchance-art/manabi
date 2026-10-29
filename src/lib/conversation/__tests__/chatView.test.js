// CONV-CHAT-001 2차 — 방 목록·날짜 구분선 표시 규칙(KST).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chatDateLabel, conversationRooms, kstDateKey, PROFILE_ANIMALS, PROFILE_TONES, profileLook, roomLastAt, roomPreview, roomTimeLabel, ROOM_PREVIEW_CHARS, TUTOR_LOOK } from '../chatView';

const read = (rel) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');
// 2026-10-15 15:07 KST = 06:07Z
const NOW = Date.parse('2026-10-15T06:07:00Z');

describe('시각 표시(KST)', () => {
  it('날짜 열쇠·구분선은 한국 날짜로 끊는다', () => {
    expect(kstDateKey(Date.parse('2026-10-14T15:30:00Z'))).toBe('2026-10-15'); // KST 00:30
    expect(chatDateLabel(NOW)).toBe('2026년 10월 15일 목요일');
    expect(kstDateKey(null)).toBe(null);
  });
  it('목록 시각 — 오늘은 시각, 어제는 「어제」, 그 전은 날짜', () => {
    expect(roomTimeLabel(NOW, NOW)).toBe('오후 3:07');
    expect(roomTimeLabel(Date.parse('2026-10-14T23:05:00Z'), NOW)).toBe('오전 8:05');
    expect(roomTimeLabel(NOW - 86400e3, NOW)).toBe('어제');
    expect(roomTimeLabel(Date.parse('2026-10-12T03:00:00Z'), NOW)).toBe('10월 12일');
    expect(roomTimeLabel(Date.parse('2025-03-01T03:00:00Z'), NOW)).toBe('2025. 3. 1.');
  });
});

describe('방 목록', () => {
  const rows = [
    { id: '3', topic: '여행', language: 'Japanese', turns: [{ who: 'tutor', at: NOW - 5000 }], preview: 'どこに行きたいですか？' },
    { id: '2', topic: '여행', language: 'Japanese', turns: [{ who: 'tutor', at: NOW - 900000 }], preview: '古い' },
    { id: '1', topic: '오늘 하루', language: 'Japanese', turns: [{ who: 'me', text: '映画を見ました', at: NOW - 100 }] },
    { id: '9', topic: '여행', language: 'Chinese', turns: [{ who: 'tutor', at: NOW }] },
    { id: '7', title: '走れメロス', topic: '走れメロス', parentId: '55', language: 'Japanese', turns: [{ who: 'tutor', at: NOW - 60000 }] },
  ];
  const rooms = conversationRooms(rows, { language: 'Japanese', topics: ['오늘 하루', '여행', '음식'] });
  it('한 주제 = 한 방(가장 최근 대화), 이 언어만, 최근 활동순 — 아직 안 연 주제는 뒤에', () => {
    expect(rooms.map((r) => r.key)).toEqual(['topic:오늘 하루', 'topic:여행', 'material:55', 'topic:음식']);
    expect(rooms[1].id).toBe('3');
    expect(rooms[3]).toMatchObject({ id: null, topic: '음식', lastAt: null });
  });
  it('미리보기 — 서버가 남긴 마지막 튜터 말, 없으면 마지막 내 말', () => {
    expect(rooms[1].preview).toBe('どこに行きたいですか？');
    expect(rooms[0].preview).toBe('나: 映画を見ました');
    expect(roomPreview({ preview: 'あ'.repeat(80) })).toHaveLength(ROOM_PREVIEW_CHARS + 1);
  });
  it('서버는 튜터의 마지막 말을 미리보기로 남긴다(목록이 본문을 읽지 않게)', () => {
    const server = read('lib/server/conversationTurn.js');
    expect(server).toContain('preview: tutorPreview(lines),');
    expect(server).toContain('preview: tutorPreview(tutorTexts)');
    expect(read('lib/conversation/conversationLibrary.js')).toContain("'preview:processed_json->metadata->conversation->>preview'");
  });
  it('마지막 활동 시각 — 서버가 남긴 lastAt, 없으면(옛 대화) 마지막 턴, 그것도 없으면 만든 시각', () => {
    expect(roomLastAt({ lastAt: '1760000000000', turns: [{ at: 5 }] })).toBe(1760000000000);
    expect(roomLastAt({ lastAt: null, turns: [{ at: 5 }, { at: null }] })).toBe(5);
    expect(roomLastAt({ createdAt: '2026-10-15T06:07:00Z' })).toBe(NOW);
    expect(roomLastAt({})).toBe(null);
    const server = read('lib/server/conversationTurn.js');
    expect(server).toContain('lastAt: tutorTurn?.at ?? now,');
    expect(server).toContain('lastAt: now,');
  });
});

describe('프로필 그림·색(7차, 오너 「다른 색과 이미지로 구분」)', () => {
  const ids = Array.from({ length: 40 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  it('같은 사람은 늘 같은 그림·색, 동물 16 × 색 8', () => {
    expect(profileLook(ids[3])).toEqual(profileLook(ids[3]));
    expect(PROFILE_ANIMALS).toHaveLength(16);
    expect(new Set(PROFILE_ANIMALS).size).toBe(16);
    for (const id of ids) {
      const look = profileLook(id);
      expect(PROFILE_ANIMALS).toContain(look.icon);
      expect(look.tone).toBeGreaterThanOrEqual(1);
      expect(look.tone).toBeLessThanOrEqual(PROFILE_TONES);
    }
    expect(profileLook(null)).toEqual(profileLook(''));
  });
  it('사람이 늘어도 고르게 퍼진다 — 40명에 색 8가지·그림 12가지 이상, 그림과 색 조합이 거의 겹치지 않는다', () => {
    const looks = ids.map(profileLook);
    expect(new Set(looks.map((l) => l.tone)).size).toBe(PROFILE_TONES);
    expect(new Set(looks.map((l) => l.icon)).size).toBeGreaterThanOrEqual(12);
    expect(new Set(looks.map((l) => `${l.icon}${l.tone}`)).size).toBeGreaterThanOrEqual(30);
  });
  it('튜터는 사람 그림과 겹치지 않는 고정 그림', () => {
    expect(PROFILE_ANIMALS).not.toContain(TUTOR_LOOK.icon);
  });
  it('화면은 토큰 색만 — 밝은 8색 · 어두운 8색 · 튜터, 대화방 두 곳이 같은 함수를 쓴다', () => {
    const css = read('components/conversation/conversation.css');
    for (let i = 1; i <= PROFILE_TONES; i++) {
      expect(css).toContain(`.conv-avatar--tone${i} { background: var(--chat-av-${i}); }`);
      expect(css.match(new RegExp(`--chat-av-${i}: #`, 'g'))).toHaveLength(2);
    }
    expect(css.match(/--chat-av-tutor: #/g)).toHaveLength(2);
    expect(read('views/ConversationLobbyPage.jsx')).toContain('conv-avatar--tone${profileLook(m.userId).tone}');
    expect(read('components/conversation/ConversationThread.jsx')).not.toContain('>튜</span>');
  });
});
