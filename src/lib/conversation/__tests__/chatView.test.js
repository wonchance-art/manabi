// CONV-CHAT-001 2차 — 방 목록·날짜 구분선 표시 규칙(KST).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chatDateLabel, conversationRooms, kstDateKey, roomPreview, roomTimeLabel, ROOM_PREVIEW_CHARS } from '../chatView';

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
});
