// 대화 모드 v2-Z Z-R1 ③ — 대화는 서재 「대화」 묶음으로 모이고, 읽을거리 자리(이어 읽기·고르기·공개)에는 끼지 않는다.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conversationHref, conversationShelfMeta, fetchConversations } from '../conversationLibrary';

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
  };
  return { from(table) { calls.push(['from', table]); return table === 'library_item_state' ? state : chain; } };
}

describe('서재 「대화」 묶음 조회', () => {
  it('내 대화 표식 자료만, 최신순으로, 본문 없이 메타만 읽는다', async () => {
    const calls = [];
    const rows = await fetchConversations(fakeClient([
      { id: 12, title: '여행 이야기', created_at: '2026-10-13T16:00:00Z', topic: '여행', language: 'Chinese', parentId: '7', marker: '1' },
      { id: 11, title: '일반 자료', created_at: null }, // 필터를 모르는 백엔드가 섞어 보낸 행
      { id: 9, title: '', created_at: null, topic: null, language: null, parentId: null, marker: '1' },
      { id: 5, title: '지운 대화', created_at: null, topic: null, language: null, parentId: null, marker: '1' },
    ], calls, ['5']), 'u1');
    expect(calls).toContainEqual(['from', 'reading_materials']);
    expect(calls).toContainEqual(['eq', 'owner_id', 'u1']);
    expect(calls).toContainEqual(['not', 'processed_json->metadata->conversation', 'is', null]);
    const cols = calls.find((c) => c[0] === 'select')[1];
    expect(cols).not.toMatch(/raw_text|processed_json,|processed_json$/);
    expect(rows[0]).toEqual({ id: '12', title: '여행', language: 'Chinese', parentId: '7', createdAt: '2026-10-13T16:00:00Z' });
    expect(rows[1].title).toBe('대화');
    expect(rows.map((r) => r.id)).toEqual(['12', '9']); // 휴지통으로 옮긴 대화는 묶음에서 빠진다
  });

  it('보조 정보는 언어·시작점·KST 날짜', () => {
    const name = (l) => ({ Chinese: '중국어' }[l] || l);
    expect(conversationShelfMeta({ language: 'Chinese', parentId: '7', createdAt: '2026-10-13T16:00:00Z' }, { languageName: name }))
      .toBe('중국어 · 자료로 시작한 대화 · 10월 14일');
    expect(conversationShelfMeta({ language: null, parentId: null, createdAt: null })).toBe('주제 대화');
    expect(conversationHref('12')).toBe('/viewer/12');
  });
});

describe('대화는 읽을거리 자리에 끼지 않는다(정적 계약)', () => {
  it('서재 화면이 「대화」 묶음을 그리고 목록 행에 대화 표시를 단다', () => {
    const shelf = read('components/library/LibraryShelf.jsx');
    expect(shelf).toContain('<ConversationShelf query={conversations} ownerId={user.id} ssr={ssr}/>');
    expect(shelf).toContain('conversationIds.has(String(row.material_id))');
    expect(read('components/library/LibraryRow.jsx')).toContain("row.conversation?'대화':null");
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
