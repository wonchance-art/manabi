// 대화 모드 v2-Z Z-R1 ③ — 대화는 서재 「대화」 묶음으로 모이고, 읽을거리 자리(이어 읽기·고르기·공개)에는 끼지 않는다.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conversationHref, fetchConversationRooms } from '../conversationLibrary';
import { createHash } from 'node:crypto';
import { sliceBetween } from '../../__tests__/helpers/sliceBetween.js';

const read = (rel) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');

function fakeClient(rows, calls, trashed = []) {
  const state = {
    select() { return state; }, eq() { return state; }, neq() { return state; },
    range() { return Promise.resolve({ data: trashed.map((id) => ({ target_kind: 'material', target_id: id })), error: null }); },
  };
  const chain = {
    select(cols) { calls.push(['select', cols]); return chain; },
    eq(...a) { calls.push(['eq', ...a]); return chain; },
    not(...a) { calls.push(['not', ...a]); return chain; },
    order(...a) { calls.push(['order', ...a]); return chain; },
    limit(n) { calls.push(['limit', n]); return Promise.resolve({ data: rows, error: null }); },
    in(col, ids) { calls.push(['in', col, ids]); return Promise.resolve({ data: ids.map((id) => ({ id, turns: [{ who: 'me', text: '옛 말', at: 5 }] })), error: null }); },
  };
  return { from(table) { calls.push(['from', table]); return table === 'library_item_state' ? state : chain; } };
}

describe('대화 방 목록 조회', () => {
  it('내 대화 표식 자료만, 최신순으로, 본문 없이 — 휴지통으로 옮긴 대화는 뺀다', async () => {
    const calls = [];
    const rows = await fetchConversationRooms(fakeClient([
      { id: 12, title: '여행 이야기', created_at: '2026-10-13T16:00:00Z', topic: '여행', language: 'Chinese', parentId: '7', marker: '1', preview: 'x', lastAt: '1' },
      { id: 11, title: '일반 자료', created_at: null }, // 필터를 모르는 백엔드가 섞어 보낸 행
      { id: 9, title: '', created_at: null, topic: null, language: null, parentId: null, marker: '1', preview: 'y', lastAt: '2' },
      { id: 5, title: '지운 대화', created_at: null, topic: null, language: null, parentId: null, marker: '1', preview: 'z', lastAt: '3' },
    ], calls, ['5']), 'u1');
    expect(calls).toContainEqual(['from', 'reading_materials']);
    expect(calls).toContainEqual(['eq', 'owner_id', 'u1']);
    expect(calls).toContainEqual(['not', 'processed_json->metadata->conversation', 'is', null]);
    const cols = calls.find((c) => c[0] === 'select')[1];
    expect(cols).not.toMatch(/raw_text|processed_json,|processed_json$/);
    expect(rows[0]).toMatchObject({ id: '12', title: '여행 이야기', topic: '여행', language: 'Chinese', parentId: '7' });
    expect(rows[1].title).toBe('대화');
    expect(rows.map((r) => r.id)).toEqual(['12', '9']);
    expect(conversationHref('12')).toBe('/viewer/12');
  });
});

describe('대화 방 목록은 대화 기록을 읽지 않는다(CONV-CHAT-001 6차 최적화)', () => {
  it('preview · lastAt 두 칸만 읽고, 두 칸이 없는 옛 대화만 그 행의 turns를 한 번 더 읽는다', async () => {
    const calls = [];
    const rows = await fetchConversationRooms(fakeClient([
      { id: 12, title: '여행', topic: '여행', language: 'Japanese', marker: '1', preview: 'どこへ？', lastAt: '1760000000000' },
      { id: 9, title: '오늘 하루', topic: '오늘 하루', language: 'Japanese', marker: '1', preview: null, lastAt: null },
    ], calls), 'u1');
    const selects = calls.filter((c) => c[0] === 'select').map((c) => c[1]);
    expect(selects[0]).not.toMatch(/->turns/);
    expect(selects[0]).toContain('lastAt:processed_json->metadata->conversation->>lastAt');
    expect(calls).toContainEqual(['in', 'id', [9]]);
    expect(rows[0]).toMatchObject({ id: '12', turns: [], preview: 'どこへ？', lastAt: 1760000000000 });
    expect(rows[1]).toMatchObject({ id: '9', lastAt: null, turns: [{ who: 'me', text: '옛 말', at: 5 }] });
  });
  it('모두 새 대화면 두 번째 조회가 없다', async () => {
    const calls = [];
    await fetchConversationRooms(fakeClient([{ id: 3, marker: '1', preview: 'x', lastAt: '7' }], calls), 'u1');
    expect(calls.some((c) => c[0] === 'in')).toBe(false);
  });
});

describe('대화는 읽을거리 자리에 끼지 않는다(정적 계약)', () => {
  it('튜터 대화는 서재에 두지 않는다 — 「대화」 묶음·표시 없음(오너 결정 「대화방에만」 2026-10-17)', () => {
    const shelf = read('components/library/LibraryShelf.jsx');
    expect(shelf).not.toMatch(/ConversationShelf|fetchConversations|conversationIds/);
    expect(read('components/library/LibraryRow.jsx')).not.toContain('row.conversation');
    expect(read('lib/libraryOperations.js')).toContain("'conversation-rooms'"); // 서재 휴지통에서 되돌리면 방 목록이 다시 읽는다
  });
  it('서재 목록 RPC는 휴지통 밖에서 대화를 뺀다 — 바꾸는 것은 조건 한 줄, 되돌리기는 적용 전 운영 본문 그대로', () => {
    const fwd = read('../docs/sql/library-hide-conversations.sql');
    const back = read('../docs/sql/library-hide-conversations-rollback.sql');
    const body = (sql) => sliceBetween(sliceBetween(sql, 'AS $function$'), '\n', '$function$;');
    expect(createHash('md5').update(body(back)).digest('hex')).toBe('16963a52f504e3bd9f9b19bc39af73f1');
    expect(fwd).toContain("<> '16963a52f504e3bd9f9b19bc39af73f1'");
    expect(fwd).toContain("p_filters->>'scope' is not distinct from 'trash' or case when r.target_kind='material'");
    expect(fwd).toContain("m.processed_json#>'{metadata,conversation}' is not null");
    const strip = (t) => t.replace(/\s+/g, ' ');
    const added = strip(body(fwd)).replace(strip(body(back)), '');
    expect(added).not.toBe(''); // 앞의 줄이 바뀌었다
    expect(strip(body(fwd)).length - strip(body(back)).length).toBeLessThan(400); // 조건 한 줄만 늘었다
  });
  it('고르기 목록·공개 전환에서 대화를 뺀다', () => {
    const page = read('views/MaterialsPage.jsx');
    expect(page).toContain('!isTeamRoot(material) && !conversationOf(material)');
    expect(page).toContain('!isStudyNote(m) && !conversationOf(m)');
  });
  it('읽던 위치·읽던 곳 기록을 남기지 않는다', () => {
    expect(read('lib/useScrollRestore.js')).toContain('if (!tracksPosition) return;');
    expect(read('views/ViewerPage.jsx')).toContain('!shouldReadComposerOriginal(material,originalParams)&&!conversationOf(material))');
  });
  it('대화에서 담은 말의 출처는 「대화로」 돌아간다', () => {
    expect(read('lib/server/learningContext.js')).toContain('...(conversationOf(material) ? { conversation: true } : {})');
    expect(read('components/learning/VocabularyContexts.jsx')).toContain("primary.locator?.conversation?'대화로 ↗'");
  });
});
