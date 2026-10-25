// ROUTE-AUDIT-2 F3(2026-10-25 KST) — /writing 첫 화면 뒤 조회 셋(최근 작문 10행 · 수확 재료 60행 · 대화 고친 말)을 한꺼번에 시작한다.
// 전에는 목록 → 수확 → 대화가 차례로라 모바일(+60ms)에서 3왕복이 줄을 섰다(e2e 합성 계정 실측 1036 → 1153 → 1236ms 시작).
// 화면은 그대로다: 넣는 값(setHistory · setGapRows의 [작문 행 …, 대화 행 …] 순서)과 기본 컬럼 폴백은 바뀌지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

const page = fs.readFileSync(path.join(process.cwd(), 'src/views/WritingStudioPage.jsx'), 'utf8');
const load = sliceBetween(page, 'async function loadHistory() {', '\n  }\n');
const gaps = sliceBetween(page, 'async function loadGapRows(withErrors, account, early = {}) {', '\n  }\n');

describe('작문 기록 조회 — 목록 · 수확 · 대화를 기다리지 않고 함께 시작한다', () => {
  it('수확(errors 포함) · 대화 조회가 첫 await(목록 10행) 앞에서 시작된다', () => {
    const firstAwait = load.indexOf('await ');
    expect(firstAwait).toBeGreaterThan(0);
    const before = load.slice(0, firstAwait);
    expect(before).toContain('gaps: Promise.resolve(gapRowsQuery(true, account)).catch(error => ({ error })),');
    expect(before).toContain('conv: fetchConversationTurns(supabase, user.id).then(conversationGapRows, () => []),');
    // PostgREST 빌더는 then을 불러야 요청이 나간다 — Promise.resolve로 지금 보낸다(빌더만 만들고 두면 직렬 그대로다).
    expect(load.slice(firstAwait)).toContain(".limit(10);");
  });

  it('새 컬럼 목록이 되면 먼저 시작한 둘을 그대로 쓰고, 기본 컬럼 폴백은 수확을 기본 컬럼으로 다시 받는다(예전과 같은 재료)', () => {
    expect(load).toContain('if (!full.error && full.data) { setHistory(full.data); await loadGapRows(true, account, early); return; }');
    expect(load).toContain('if (!base.error && base.data) { setHistory(base.data); await loadGapRows(false, account, { conv: early.conv }); }');
    expect(gaps).toContain('const r = await (early.gaps || gapRowsQuery(withErrors, account));');
    expect(gaps).toContain('setGapRows([...r.data, ...conv]);');
    // 수확이 실패하면 예전처럼 수확 칸만 비운다(목록은 그대로) — 먼저 시작한 조회의 거절이 처리되지 않은 채 남지 않는다.
    expect(gaps.indexOf('if (!r.error && r.data) {')).toBeLessThan(gaps.indexOf('const conv = await'));
  });

  it('수확 재료 조회는 한 곳(gapRowsQuery)에서 만든다 — 컬럼 · 60행 · 최신순', () => {
    const query = sliceBetween(page, 'function gapRowsQuery(withErrors, account) {', '\n  }\n');
    expect(query).toContain("? 'id, created_at, language, sentence, corrected, errors'");
    expect(query).toContain(": 'id, created_at, language, sentence, corrected';");
    expect(query).toContain(".eq('user_id', account).order('created_at', { ascending: false }).limit(60);");
    expect(page.match(/from\('writing_practice'\)\.select\(cols\)/g)).toHaveLength(1);
  });
});
