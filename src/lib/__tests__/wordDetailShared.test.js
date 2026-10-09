import { describe, expect, it, beforeEach } from 'vitest';
import { fetchSharedDetailText, peekWordDetailText, resetSharedDetailMemo } from '../wordDetail.js';

// AE-R1 PR③ — 「자세한 설명」 공유 detail_text 지연 조회(VIEWER-V2-ROUNDS-001 §2.1 더 알아보기 「이미 만든 결과(공유
// detail_text, 캐시)가 있으면 버튼 대신 내용」). morpheme_dictionary.detail_text만 읽고(AI 0), 같은 단어 재열람은
// 메모리 캐시로 0요청. 실패는 조용히 null(버튼 그대로)이고 기억하지 않는다(다음 열람에 다시 시도).
function fakeClient(rows, { fail = false } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const q = { table, filters: {} };
      const chain = {
        select(cols) { q.select = cols; return chain; },
        eq(col, value) { q.filters[col] = value; return chain; },
        async maybeSingle() {
          calls.push(q);
          if (fail) return { data: null, error: { message: 'fixture outage' } };
          const row = rows[`${q.filters.language}:${q.filters.base_form}`];
          return { data: row ? { detail_text: row } : null, error: null };
        },
      };
      return chain;
    },
  };
}

describe('fetchSharedDetailText', () => {
  beforeEach(() => resetSharedDetailMemo());

  it('detail_text 한 열만, 기존 설명 경로와 같은 키(base_form ‖ text)로 1회 — 같은 단어 재열람은 0요청', async () => {
    const client = fakeClient({ 'Japanese:食べる': '**뜻**\n1. 먹다' });
    const token = { text: '食べた', base_form: '食べる' };
    expect(await fetchSharedDetailText(client, token, 'Japanese')).toBe('**뜻**\n1. 먹다');
    expect(await fetchSharedDetailText(client, token, 'Japanese')).toBe('**뜻**\n1. 먹다');
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toEqual({ table: 'morpheme_dictionary', select: 'detail_text', filters: { language: 'Japanese', base_form: '食べる' } });
  });

  it('설명이 없는 단어도 기억한다(null → 버튼 그대로, 재열람 0요청)', async () => {
    const client = fakeClient({});
    const token = { text: '天気', base_form: '天気' };
    expect(await fetchSharedDetailText(client, token, 'Japanese')).toBeNull();
    expect(await fetchSharedDetailText(client, token, 'Japanese')).toBeNull();
    expect(client.calls).toHaveLength(1);
    // 다른 단어는 따로 1회
    await fetchSharedDetailText(client, { text: '寿司', base_form: '寿司' }, 'Japanese');
    expect(client.calls).toHaveLength(2);
  });

  it('실패는 조용히 null이고 기억하지 않는다', async () => {
    const client = fakeClient({}, { fail: true });
    const token = { text: '壮观', base_form: '壮观' };
    await expect(fetchSharedDetailText(client, token, 'Japanese')).resolves.toBeNull();
    await expect(fetchSharedDetailText(client, token, 'Japanese')).resolves.toBeNull();
    expect(client.calls).toHaveLength(2);
  });

  it('받아 둔 설명은 peekWordDetailText가 네트워크 없이 다시 준다(카드 재마운트·교정 뒤 버튼으로 돌아가지 않게)', async () => {
    const client = fakeClient({ 'Japanese:寿司': '초밥 설명' });
    const token = { text: '寿司', base_form: '寿司' };
    expect(await peekWordDetailText(token, 'Japanese')).toBeNull();
    await fetchSharedDetailText(client, token, 'Japanese');
    expect(await peekWordDetailText(token, 'Japanese')).toBe('초밥 설명');
    expect(client.calls).toHaveLength(1);
  });
});
