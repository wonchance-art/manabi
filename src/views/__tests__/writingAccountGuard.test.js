// /writing 최근 작문 · 수확 재료(PERF 감사 2026-10-26 KST 냄새) — history · gapRows는 화면 상태라 계정 캐시 비우기 밖이다.
// 화면 계정이 바뀐 뒤 도착한 옛 계정 응답은 버리고(useVocabData actorRef 모양), 계정이 바뀌면 비운 뒤 새 계정으로 다시 읽는다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

const page = fs.readFileSync(path.join(process.cwd(), 'src/views/WritingStudioPage.jsx'), 'utf8');

describe('작문 화면 — 옛 계정 응답을 새 계정 화면에 그리지 않는다', () => {
  it('렌더마다 화면 계정을 ref에 두고, 읽기는 시작 시 계정으로 묻는다', () => {
    expect(page).toContain('const accountRef = useRef(user?.id);\n  accountRef.current = user?.id;');
    const load = sliceBetween(page, 'async function loadHistory() {', '\n  }\n');
    expect(load).toContain('const account = user?.id;');
    expect(load).toContain('const current = () => accountRef.current === account;');
    // user.id는 대화 조회 한 곳뿐(같은 렌더 클로저 = account — conversationLoop 계약이 그 호출 모양을 고정한다)
    expect(load.replace('fetchConversationTurns(supabase, user.id)', '')).not.toContain('user.id');
    expect(load.match(/\.eq\('user_id', account\)/g)).toHaveLength(2);
  });
  it('응답마다 계정 확인 뒤에만 상태에 쓴다 — 목록 두 갈래 · 수확 재료', () => {
    const load = sliceBetween(page, 'async function loadHistory() {', '\n  }\n');
    const sets = [...load.matchAll(/setHistory\(/g)].map(m => m.index);
    const checks = [...load.matchAll(/if \(!current\(\)\) return;/g)].map(m => m.index);
    expect(sets).toHaveLength(2);
    expect(checks).toHaveLength(2);
    sets.forEach((at, i) => expect(checks[i]).toBeLessThan(at));
    expect(load).toContain('await loadGapRows(true, account, early);');
    expect(load).toContain('await loadGapRows(false, account, { conv: early.conv });');
    const gaps = sliceBetween(page, 'async function loadGapRows(withErrors, account, early = {}) {', '\n  }\n');
    expect(gaps).toContain('gapRowsQuery(withErrors, account)');
    expect(sliceBetween(page, 'function gapRowsQuery(withErrors, account) {', '\n  }\n')).toContain(".eq('user_id', account)");
    // 대화 고친 말은 같은 렌더 클로저의 user.id(= account)로 묻는다 — 늦게 온 응답은 아래 확인에서 버린다
    expect(gaps).toContain('fetchConversationTurns(supabase, user.id)');
    expect(gaps.indexOf('if (accountRef.current !== account) return;')).toBeGreaterThan(gaps.indexOf('fetchConversationTurns('));
    expect(gaps.indexOf('if (accountRef.current !== account) return;')).toBeLessThan(gaps.indexOf('setGapRows('));
  });
  it('계정이 바뀌면 옛 목록 · 수확 · 담은 표시를 비우고 다시 읽는다', () => {
    expect(page).toMatch(/useEffect\(\(\) => \{\s*\/\/[^\n]*\n\s*setHistory\(\[\]\); setGapRows\(\[\]\); setGapAdded\(\{\}\);\s*loadHistory\(\);[\s\S]{0,80}\}, \[user\?\.id\]\);/);
  });
});
