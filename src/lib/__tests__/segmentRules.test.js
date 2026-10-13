import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// 뷰어 v2 AD-R3 PR④ — 단어 경계 규칙(② user_segment_rules · ③ shared_segment_rules) 순수 함수 계약.
// 정본: docs/manabi-viewer-v2-ad-r3.md §5.1(경계 일치 때만 묶음 · 정확 일치 때만 나눔 · 긴 것 우선 · 결정적) · §5.3(cuts 검증은
// 서버·화면 공용 함수 · 표가 없으면 무시) · §8.1 「사용자 규칙」.
import {
  compileSegmentRules, deleteUserSegmentRule, fetchUserSegmentRules, normalizeSegmentSurface, saveSharedSegmentRule, saveUserSegmentRule,
  segmentRuleEditsForLine, segmentRuleLayers, segmentRulesTableMissing, userRuleJoinOf, validateSegmentRule,
} from '../segmentRules';
import { applyBoundaryLayers } from '../boundaryEdits';
import { applyRequestBoundaries } from '../server/analyzeBoundaries';
import { loadSegmentRules } from '../server/segmentRulesStore';

const tok = (text, extra = {}) => ({ text, base_form: text, furigana: '', pos: '명사', ...extra });
const line = (...words) => words.map((w) => (typeof w === 'string' ? tok(w) : w));
const zh = (rows) => compileSegmentRules(rows, 'Chinese');
const edits = (tokens, rows, language = 'Chinese') => segmentRuleEditsForLine(tokens, compileSegmentRules(rows, language), { language });
const applied = (tokens, rows, language = 'Chinese', marker = 'user_rule') => {
  const list = edits(tokens, rows, language);
  return applyBoundaryLayers(tokens.map((token, k) => ({ id: k, token })), [{ marker, edits: list }], { language })
    .tokens.map((e) => e.token.text).join('|');
};

describe('validateSegmentRule — cuts 검증은 서버·화면 공용(0 < c < 길이 · 오름차순)', () => {
  it('맞는 규칙은 정규화해 돌려준다(중·일 공백 제거 · 영어 소문자 · 단어 사이 공백 하나)', () => {
    expect(validateSegmentRule({ language: 'Chinese', surface: ' 身体 素质 ', cuts: [] }))
      .toEqual({ ok: true, rule: { language: 'Chinese', surface: '身体素质', key: '身体素质', cuts: [] } });
    expect(validateSegmentRule({ language: 'English', surface: 'Pick   Up', cuts: [4] }))
      .toEqual({ ok: true, rule: { language: 'English', surface: 'pick up', key: 'pickup', cuts: [4] } });
    expect(validateSegmentRule({ language: 'Japanese', surface: '映画館', cuts: [2] }).ok).toBe(true);
  });

  it.each([
    [[0], '0'], [[4], '길이와 같음'], [[3, 2], '내림차순'], [[1, 1], '중복'], [[1.5], '정수 아님'], [['1'], '문자열'], ['1', '배열 아님'],
  ])('칼선 %j(%s)는 거부', (cuts, why) => {
    expect(validateSegmentRule({ language: 'Chinese', surface: '身体素质', cuts }), why).toEqual({ ok: false, reason: 'cuts' });
  });

  it('칼선 생략(null · undefined)은 묶기 규칙 []', () => {
    expect(validateSegmentRule({ language: 'Chinese', surface: '身体素质', cuts: null }).rule.cuts).toEqual([]);
    expect(validateSegmentRule({ language: 'Chinese', surface: '身体素质' }).rule.cuts).toEqual([]);
  });

  it('서로게이트 쌍 안쪽 칼선 · 영어 단어 안쪽 칼선 · 공백 없는 영어 한 단어는 거부', () => {
    expect(validateSegmentRule({ language: 'Chinese', surface: '𠮷野', cuts: [1] }).reason).toBe('cuts');
    expect(validateSegmentRule({ language: 'Chinese', surface: '𠮷野', cuts: [2] }).ok).toBe(true);
    expect(validateSegmentRule({ language: 'English', surface: 'pick up', cuts: [2] }).reason).toBe('cuts');
    expect(validateSegmentRule({ language: 'English', surface: 'pickup', cuts: [] }).reason).toBe('cuts');
  });

  it('언어 · 길이(2~40자, DDL CHECK와 같다) · 39칼선 상한', () => {
    expect(validateSegmentRule({ language: 'Korean', surface: '도서관에서' }).reason).toBe('language');
    expect(validateSegmentRule({ language: 'Chinese', surface: '身' }).reason).toBe('too_short');
    expect(validateSegmentRule({ language: 'Chinese', surface: '字'.repeat(41) }).reason).toBe('too_long');
    expect(validateSegmentRule({ language: 'Chinese', surface: '字'.repeat(40), cuts: Array.from({ length: 39 }, (_, k) => k + 1) }).ok).toBe(true);
    expect(validateSegmentRule({ language: 'Chinese', surface: 123 }).reason).toBe('surface');
  });

  it('normalizeSegmentSurface — 저장 · 지우기 · 맞추기가 같은 꼴을 쓴다', () => {
    expect(normalizeSegmentSurface('English', '  Looked\tAfter ')).toBe('looked after');
    expect(normalizeSegmentSurface('Chinese', '身体 素质')).toBe('身体素质');
  });
});

describe('segmentRuleEditsForLine — §5.1 적용 규칙', () => {
  it('묶기: 양 끝이 분석기 토큰 경계와 맞을 때만(안쪽 토큰 2개 이상)', () => {
    expect(applied(line('运动员', '的', '身体', '素质', '非常', '好', '。'), [{ surface: '身体素质' }])).toBe('运动员|的|身体素质|非常|好|。');
    // 一个|人: 「个人」의 앞 끝(1)이 토큰 경계가 아니라 걸리지 않는다.
    expect(edits(line('一个', '人'), [{ surface: '个人' }])).toEqual([]);
    // 一|个|人: 경계가 맞으면 묶는다(설계서 §5.1 위험 — 첫 판은 문맥 조건 없음, Q5).
    expect(applied(line('一', '个', '人'), [{ surface: '个人' }])).toBe('一|个人');
    // 이미 한 토큰이면 기록을 만들지 않는다(규칙 없을 때와 같은 결과).
    expect(edits(line('身体素质', '好'), [{ surface: '身体素质' }])).toEqual([]);
  });

  it('나누기: 토큰 표면이 규칙 꼴과 정확히 같을 때만', () => {
    expect(applied(line('王先生', '来', '了'), [{ surface: '王先生', cuts: [1] }])).toBe('王|先生|来|了');
    expect(edits(line('王先生们', '来'), [{ surface: '王先生', cuts: [1] }])).toEqual([]);
    expect(edits(line('王', '先生'), [{ surface: '王先生', cuts: [1] }])).toEqual([]);
    expect(edits(line('王先生'), [{ surface: '王先生', cuts: [1] }])).toEqual([{ id: 'rule:王先生', start: 0, end: 3, text: '王先生', cuts: [1] }]);
  });

  it('긴 꼴부터 · 겹치면 먼저 맞은 것 · 입력 순서와 무관하게 결정적', () => {
    const tokens = line('A', 'B', 'C', 'D');
    const rows = [{ surface: 'AB' }, { surface: 'ABC' }, { surface: 'CD' }, { surface: 'BC' }];
    expect(applied(tokens, rows)).toBe('ABC|D');
    const shuffled = [rows[3], rows[0], rows[2], rows[1]];
    expect(edits(tokens, shuffled)).toEqual(edits(tokens, rows));
    // 같은 길이면 꼴의 코드 포인트 순: AB가 BC보다 먼저 — AB|CD.
    expect(applied(tokens, [{ surface: 'CD' }, { surface: 'BC' }, { surface: 'AB' }])).toBe('AB|CD');
  });

  it('한 줄에 여러 번 나오면 자리마다 적용한다', () => {
    expect(applied(line('身体', '好', '，', '身体', '好'), [{ surface: '身体好' }])).toBe('身体好|，|身体好');
  });

  it('이합사 조각 · 삽입형 · 분석 실패 토큰은 건드리지 않는다', () => {
    expect(edits(line('道', tok('了'), tok('歉', { sep_link: '道歉' })), [{ surface: '了歉' }])).toEqual([]);
    expect(edits(line(tok('吵过架', { base_form: '吵架' })), [{ surface: '吵过架', cuts: [1] }])).toEqual([]);
    expect(edits(line(tok('身体', { failed: true }), '素质'), [{ surface: '身体素质' }])).toEqual([]);
  });

  it('영어: 대소문자 무관 · 규칙 꼴의 단어 사이 그대로일 때만 묶고, 묶인 꼴만 나눈다', () => {
    const en = line('Pick', 'up', 'the', 'pen', '.');
    expect(applied(en, [{ surface: 'pick up' }], 'English')).toBe('Pick up|the|pen|.');
    expect(edits(line('picked', 'up'), [{ surface: 'pick up' }], 'English')).toEqual([]);
    expect(applied(line('pick up', 'the'), [{ surface: 'pick up', cuts: [4] }], 'English')).toBe('pick|up|the');
  });

  it('언어가 다른 규칙 행 · 검증에 어긋난 행 · 같은 꼴 중복은 버린다', () => {
    const rules = compileSegmentRules([
      { surface: '身体素质', cuts: [] }, { language: 'Japanese', surface: '映画館', cuts: [] },
      { surface: '身体素质', cuts: [2] }, { surface: '个', cuts: [] }, { surface: '王先生', cuts: [9] }, null,
    ], 'Chinese');
    expect(rules.map((r) => [r.surface, r.cuts])).toEqual([['身体素质', []]]);
  });

  it('입력 토큰 · 규칙을 바꾸지 않는다', () => {
    const tokens = line('身体', '素质');
    const rules = zh([{ surface: '身体素质' }]);
    const before = JSON.stringify({ tokens, rules });
    segmentRuleEditsForLine(tokens, rules, { language: 'Chinese' });
    expect(JSON.stringify({ tokens, rules })).toBe(before);
  });

  it('한국어 · 지원 밖 언어 · 규칙 없음은 []', () => {
    expect(segmentRuleEditsForLine(line('身体', '素质'), zh([{ surface: '身体素质' }]), { language: 'Korean' })).toEqual([]);
    expect(segmentRuleEditsForLine(line('身体', '素质'), [], { language: 'Chinese' })).toEqual([]);
    expect(segmentRuleLayers(line('身体', '素质'), { user: [], shared: [] }, { language: 'Chinese' })).toEqual([]);
  });
});

describe('층 순서 — 공유 규칙 → 사용자 규칙 → 이 자료 기록(뒤가 이긴다) · 표식', () => {
  const entry = (...words) => [{ original: words.join(''), tokens: line(...words) }];

  it('사용자 규칙이 겹치는 공유 규칙을 이기고 표식이 갈린다', () => {
    const rules = { shared: zh([{ surface: '素质非常' }, { surface: '运动员', cuts: [2] }]), user: zh([{ surface: '身体素质' }]) };
    const state = applyRequestBoundaries(entry('运动员', '的', '身体', '素质', '非常', '好'), null, 'Chinese', rules);
    const tokens = state.tokenizedLines[0].tokens;
    expect(tokens.map((t) => `${t.text}${t.boundary ? `:${t.boundary}` : ''}`).join('|'))
      .toBe('运动:shared_rule|员:shared_rule|的|身体素质:user_rule|非常|好');
    // 규칙은 자료 기록이 아니다 — 응답 boundaryApplied를 만들 lines가 비어 있다.
    expect(state.lines.size).toBe(0);
  });

  it('이 자료 기록이 겹치는 규칙을 이기고, boundaryApplied에는 기록만 실린다', () => {
    const rules = { shared: [], user: zh([{ surface: '身体素质' }]) };
    const record = { id: 'b_1', line: 0, start: 6, end: 10, text: '素质非常', cuts: [] };
    const state = applyRequestBoundaries(entry('运动员', '的', '身体', '素质', '非常', '好'), new Map([[0, [record]]]), 'Chinese', rules);
    expect(state.tokenizedLines[0].tokens.map((t) => t.text).join('|')).toBe('运动员|的|身体|素质非常|好');
    expect(state.lines.get(0).results).toHaveLength(1);
    expect(state.lines.get(0).results[0]).toMatchObject({ id: 'b_1', status: 'applied' });
    expect(state.lines.get(0).base.map((t) => t.text)).toEqual(['素质', '非常']);
  });

  it('맞는 규칙이 없으면 null — 라우트는 기존 경로 그대로(바이트 단위 동일)', () => {
    const lines = entry('运动员', '的', '身体');
    expect(applyRequestBoundaries(lines, null, 'Chinese', { user: zh([{ surface: '素质非常' }]), shared: [] })).toBeNull();
    expect(applyRequestBoundaries(lines, null, 'Chinese', { user: [], shared: [] })).toBeNull();
    expect(applyRequestBoundaries(lines, null, 'Chinese', null)).toBeNull();
  });
});

// ── 표가 없으면(PGRST205/42P01) 무시 — 롤백해도 분석이 깨지지 않는다(§5.3) ──

function fakeClient(tables) {
  const ops = [];
  return {
    ops,
    from(table) {
      const q = { table, filters: [] };
      const result = () => {
        const stored = tables[table];
        if (stored instanceof Error) throw stored;
        if (stored && !Array.isArray(stored)) return { data: null, error: stored.error };
        return { data: stored ?? [], error: null };
      };
      const chain = {
        select(cols) { q.op = 'select'; q.cols = cols; return chain; },
        eq(k, v) { q.filters.push([k, v]); return chain; },
        limit(n) { q.limit = n; return chain; },
        upsert(row, opts) { q.op = 'upsert'; q.row = row; q.opts = opts; return chain; },
        delete() { q.op = 'delete'; return chain; },
        then(resolve, reject) { ops.push(q); return Promise.resolve().then(result).then(resolve, reject); },
      };
      return chain;
    },
  };
}

describe('표 없음 · 읽기 실패 = 규칙 없음', () => {
  it('segmentRulesTableMissing은 PGRST205 · 42P01만', () => {
    expect(segmentRulesTableMissing({ code: 'PGRST205' })).toBe(true);
    expect(segmentRulesTableMissing({ code: '42P01' })).toBe(true);
    expect(segmentRulesTableMissing({ code: '42501' })).toBe(false);
    expect(segmentRulesTableMissing(null)).toBe(false);
  });

  it.each([['PGRST205'], ['42P01']])('표가 없으면(%s) 그 표의 규칙은 빈 목록이고 missing 표시', async (code) => {
    const client = fakeClient({ user_segment_rules: { error: { code } }, shared_segment_rules: { error: { code } } });
    expect(await loadSegmentRules(client, { userId: 'u1', language: 'Chinese' }))
      .toEqual({ user: [], shared: [], missing: { user: true, shared: true } });
  });

  it('한 표만 없어도 다른 표 규칙은 쓴다 · 그 밖의 오류 · 예외도 규칙 없음(분석은 계속)', async () => {
    const one = fakeClient({ user_segment_rules: [{ surface: '身体素质', cuts: [] }], shared_segment_rules: { error: { code: 'PGRST205' } } });
    const out = await loadSegmentRules(one, { userId: 'u1', language: 'Chinese' });
    expect(out.user.map((r) => r.surface)).toEqual(['身体素质']);
    expect(out.shared).toEqual([]);
    const broken = fakeClient({ user_segment_rules: new Error('network'), shared_segment_rules: { error: { code: '42501', message: 'denied' } } });
    const original = console.warn;
    console.warn = () => {};
    try {
      expect(await loadSegmentRules(broken, { userId: 'u1', language: 'Chinese' }))
        .toEqual({ user: [], shared: [], missing: { user: false, shared: false } });
    } finally { console.warn = original; }
  });

  it('읽기는 표마다 1회 · language(+ 본인 user_id)로만 거른다 · 쓰기 0', async () => {
    const client = fakeClient({ user_segment_rules: [], shared_segment_rules: [] });
    await loadSegmentRules(client, { userId: 'u1', language: 'English' });
    expect(client.ops.map((q) => [q.table, q.op, q.filters, q.limit])).toEqual([
      ['user_segment_rules', 'select', [['user_id', 'u1'], ['language', 'English']], 500],
      ['shared_segment_rules', 'select', [['language', 'English']], 500],
    ]);
  });

  it('화면 목록: 표가 없으면 available:false(②③ 선택지 · 규칙 지우기 숨김), 있으면 검증한 내 규칙', async () => {
    expect(await fetchUserSegmentRules(fakeClient({ user_segment_rules: { error: { code: 'PGRST205' } } }), { language: 'Chinese' }))
      .toEqual({ available: false, rules: [] });
    expect(await fetchUserSegmentRules(fakeClient({ user_segment_rules: new Error('offline') }), { language: 'Chinese' }))
      .toEqual({ available: false, rules: [] });
    expect(await fetchUserSegmentRules(fakeClient({ user_segment_rules: [{ surface: '身体素质', cuts: [] }, { surface: '身', cuts: [] }] }), { language: 'Chinese' }))
      .toEqual({ available: true, rules: [{ surface: '身体素质', cuts: [] }] });
    expect(await fetchUserSegmentRules(fakeClient({}), { language: 'Korean' })).toEqual({ available: false, rules: [] });
  });

  it('카드 「내 규칙으로 묶음」: 표식 user_rule + 같은 꼴의 묶기 규칙일 때만(나누기 조각 · 지운 규칙 · 다른 표식은 null)', () => {
    const rules = [{ surface: '身体素质', cuts: [] }, { surface: '王先生', cuts: [1] }];
    expect(userRuleJoinOf({ text: '身体素质', boundary: 'user_rule' }, rules, 'Chinese')).toBe('身体素质');
    expect(userRuleJoinOf({ text: '王', boundary: 'user_rule' }, rules, 'Chinese')).toBeNull();
    expect(userRuleJoinOf({ text: '身体素质', boundary: 'user' }, rules, 'Chinese')).toBeNull();
    expect(userRuleJoinOf({ text: '身体素质', boundary: 'user_rule' }, [], 'Chinese')).toBeNull();
    expect(userRuleJoinOf({ text: 'Picked Up', boundary: 'user_rule' }, [{ surface: 'picked up', cuts: [] }], 'English')).toBe('picked up');
  });
});

describe('화면 쓰기(②) — 본인 규칙 표 하나만', () => {
  it('저장은 검증한 꼴로 upsert(같은 꼴은 칼선만 바꿈) · 출처 자료 번호는 bigint', async () => {
    const client = fakeClient({ user_segment_rules: [] });
    const out = await saveUserSegmentRule(client, { userId: 'u1', language: 'English', surface: 'Picked Up', materialId: 41 });
    expect(out.rule).toMatchObject({ surface: 'picked up', cuts: [] });
    expect(client.ops).toHaveLength(1);
    expect(client.ops[0]).toMatchObject({ table: 'user_segment_rules', op: 'upsert', opts: { onConflict: 'user_id,language,surface' } });
    expect(client.ops[0].row).toMatchObject({ user_id: 'u1', language: 'English', surface: 'picked up', cuts: [], source_material_id: 41 });
  });

  it('검증 실패 · 표 없음은 쓰지 않거나 unavailable로 알린다', async () => {
    const client = fakeClient({ user_segment_rules: { error: { code: 'PGRST205' } } });
    await expect(saveUserSegmentRule(client, { userId: 'u1', language: 'Chinese', surface: '身' })).rejects.toMatchObject({ reason: 'too_short' });
    expect(client.ops).toHaveLength(0);
    await expect(saveUserSegmentRule(client, { userId: 'u1', language: 'Chinese', surface: '身体素质' })).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it('③ 공유 규칙은 관리자 라우트로만(검증한 꼴 · 토큰) · 403 → forbidden · 503 → unavailable', async () => {
    const calls = [];
    const fetchWith = (status) => async (url, init) => { calls.push({ url, init }); return { ok: status === 200, status }; };
    await saveSharedSegmentRule({ language: 'Chinese', surface: '身体 素质' }, { fetch: fetchWith(200), accessToken: 'tok' });
    expect(calls[0].url).toBe('/api/admin/segment-rules');
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(calls[0].init.body)).toEqual({ language: 'Chinese', surface: '身体素质', cuts: [] });
    await expect(saveSharedSegmentRule({ language: 'Chinese', surface: '身体素质' }, { fetch: fetchWith(403) })).rejects.toMatchObject({ reason: 'forbidden' });
    await expect(saveSharedSegmentRule({ language: 'Chinese', surface: '身体素质' }, { fetch: fetchWith(503) })).rejects.toMatchObject({ reason: 'unavailable' });
    await expect(saveSharedSegmentRule({ language: 'Chinese', surface: '身' }, { fetch: fetchWith(200) })).rejects.toMatchObject({ reason: 'too_short' });
    expect(calls).toHaveLength(3);
  });

  it('지우기는 본인 · 언어 · 정규화한 꼴로', async () => {
    const client = fakeClient({ user_segment_rules: [] });
    await deleteUserSegmentRule(client, { userId: 'u1', language: 'Chinese', surface: '身体 素质' });
    expect(client.ops[0]).toMatchObject({ table: 'user_segment_rules', op: 'delete', filters: [['user_id', 'u1'], ['language', 'Chinese'], ['surface', '身体素质']] });
  });

  it('소스 계약: 규칙 경로는 단어장 · 문맥 · 평가 이력 · FSRS · 아는 단어 · 사전에 쓰지 않는다', () => {
    for (const file of ['src/lib/segmentRules.js', 'src/lib/server/segmentRulesStore.js', 'src/app/api/admin/segment-rules/route.js']) {
      const source = readFileSync(path.resolve(process.cwd(), file), 'utf8');
      for (const forbidden of ['user_vocabulary', 'vocabulary_contexts', 'review_events', 'fsrs', 'user_known_words', 'vocabulary_exclusions', 'morpheme_dictionary', 'token_corrections']) {
        expect(source, `${file} → ${forbidden}`).not.toContain(forbidden);
      }
    }
  });
});
