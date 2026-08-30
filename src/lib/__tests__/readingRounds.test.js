import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { ROUND_SAME_PCT, compareRound, lastRoundCpm } from '../readingSpeedHistory.js';
import { READING_METRIC_VERSION } from '../readingTimer.js';

/**
 * 계약: v2-I R1a R2 회차 비교 + 재독 배지 (#1077 설계 §1·§2·§3·§8).
 * 유창성의 표준 측정은 **같은 텍스트를 다시 읽은 속도**다(Nation timed reading).
 * 그래서 비교 대상은 언제나 같은 자료의 이전 회차이고(§1), 페이서 회차는 양쪽 모두
 * 표본에서 빠진다(§8). 재료는 append-only인 review_events뿐 — 새 테이블 0(§2).
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ev = (cpm, extra = {}) => ({ detail: { cpm, v: READING_METRIC_VERSION, paced: false, ...extra } });
const now = (cpm, paced = false) => ({ cpm, paced });

describe('§1 비교 대상 — 같은 자료의 직전 회차', () => {
  it('빨라졌으면 증가율을 준다 — 61 → 76은 +25%', () => {
    expect(compareRound(now(76), [ev(61)])).toEqual({ prev: 61, deltaPct: 25, tone: 'up' });
  });

  it('느려졌어도 그대로 적는다 — 숨기면 지표가 아니라 응원이 된다', () => {
    expect(compareRound(now(79), [ev(90)])).toEqual({ prev: 90, deltaPct: -12, tone: 'down' });
  });

  it('오차 범위 안이면 "비슷한 속도" — 읽기 속도는 원래 이 정도 흔들린다', () => {
    expect(ROUND_SAME_PCT).toBe(5);
    expect(compareRound(now(77), [ev(76)]).tone).toBe('same');
    expect(compareRound(now(73), [ev(76)]).tone).toBe('same');
  });

  it('첫 회차면 비교 줄이 아예 없다 — 비교할 것이 없는데 0%를 적으면 거짓말이다', () => {
    expect(compareRound(now(76), [])).toBeNull();
    expect(compareRound(now(76), [{ detail: null }])).toBeNull();
    expect(lastRoundCpm([])).toBeNull();
  });

  it('직전 것 하나만 본다 — 최신순 목록의 첫 유효 표본', () => {
    expect(lastRoundCpm([ev(76), ev(61), ev(50)])).toBe(76);
  });
});

describe('§8 페이서 회차는 양쪽 다 제외 — 내가 설정한 속도로 실력을 재지 않는다', () => {
  it('이번 회차가 페이서면 비교하지 않는다', () => {
    expect(compareRound(now(150, true), [ev(61)])).toBeNull();
  });

  it('지난 회차가 페이서면 그 회차를 건너뛰고 그 앞을 본다', () => {
    expect(compareRound(now(76), [ev(300, { paced: true }), ev(61)]))
      .toEqual({ prev: 61, deltaPct: 25, tone: 'up' });
  });

  it('정의 버전이 다른 회차도 건너뛴다 — 시간·글자수의 뜻이 달라진 기록이다', () => {
    expect(compareRound(now(76), [ev(999, { v: 99 }), ev(61)]).prev).toBe(61);
  });

  it('망가진 값은 비교하지 않는다 — 진단 줄이 화면을 깨뜨리지 않는다', () => {
    expect(compareRound(null, [ev(61)])).toBeNull();
    expect(compareRound(now(0), [ev(61)])).toBeNull();
    expect(compareRound(now(76), [ev(0)])).toBeNull();
  });
});

describe('§2 조회 — append-only 이벤트를 자료로 좁혀 읽기만 한다', () => {
  const rows = codeOf(read('src/lib/readingSpeedRows.js'));

  it('item_key로 자료를 특정한다 — 언어 전체 이력과 다른 질문이다', () => {
    const fn = sliceBetween(rows, 'export async function fetchMaterialRoundRows', 'catch {');
    expect(fn).toContain("eq('item_key', 'material:' + materialId)");
    expect(fn).toContain("eq('source', 'reading')");
    expect(fn).toContain("order('created_at', { ascending: false })");
  });

  it('새 테이블·쓰기 0 — 재독 회차는 이미 쌓이고 있다', () => {
    for (const banned of ['insert(', 'upsert(', 'delete(', 'reading_rounds']) {
      expect(rows, `회차 조회가 ${banned}를 하면 안 된다`).not.toContain(banned);
    }
  });
});

describe('완독 직후 배선 — 자기 자신과 비교하지 않는다', () => {
  const hook = read('src/lib/useReadingCompletion.js');

  it('이번 회차를 기록하기 **전에** 이전 회차를 읽는다 — 순서가 뒤집히면 언제나 0%', () => {
    const body = codeOf(sliceBetween(hook, 'let metric = null;', 'const pendingCompletion'));
    expect(body).toContain('const rows = await fetchMaterialRoundRows(user.id, materialId);');
    expect(body).toContain('round = compareRound(metric, rows);');
    expect(body.indexOf('fetchMaterialRoundRows')).toBeLessThan(body.indexOf('logReviewEvents('));
  });

  it('이벤트 개수는 여전히 불변 — 비교는 읽기만 한다(I-a R1 계약 유지)', () => {
    expect(hook.match(/logReviewEvents\(/g)).toHaveLength(1);
  });

  it('측정이 없으면 비교도 없다 — 200자 미만 자료에 조회를 태우지 않는다', () => {
    const body = codeOf(sliceBetween(hook, 'let round = null;', 'if (eventLang'));
    expect(body).toContain('if (metric) {');
  });

  it('완독 화면으로 넘어간다 — 첫 회차·페이서 회차면 null이라 줄이 없다', () => {
    expect(hook).toContain('round,');
  });
});

describe('§3 완독 한 줄 — 느려진 회차를 나무라지 않는다', () => {
  const modal = read('src/views/ViewerQuizModal.jsx');
  const css = read('src/index.css');

  it('측정이 있을 때만, 그 아래 한 줄', () => {
    expect(modal).toContain('{completionModal.round && (');
    expect(modal).toContain('지난번 {completionModal.round.prev}자/분');
    expect(modal).toContain("completionModal.round.tone === 'same'");
    expect(modal).toContain('비슷한 속도');
  });

  it('빨라졌을 때만 강조색 — 느려졌을 때 경고색·↓ 화살표를 쓰지 않는다', () => {
    expect(css).toContain('.completion-modal__round--up b { color: var(--accent-text); }');
    expect(css).not.toContain('.completion-modal__round--down b { color: var(--error');
    expect(codeOf(modal)).not.toMatch(/↓|더 느려|아쉬/);
  });

  it('경쟁·랭킹 요소가 없다(설계 §11)', () => {
    expect(codeOf(modal)).not.toMatch(/랭킹|순위|leaderboard|등수/i);
  });
});

describe('재독 카드 — "두 번째는 훨씬 빨라요"에 실물 근거를 붙인다', () => {
  const hook = read('src/lib/useRereadCandidate.js');

  it('지난 회차 속도를 kicker에 얹고, 없으면 예전 문구 그대로', () => {
    const kicker = sliceBetween(hook, 'kicker: lastCpm', '\n');
    expect(kicker).toContain('지난번 ${lastCpm}자/분');
    expect(kicker).toContain("'다시 읽기 · 두 번째는 훨씬 빨라요'");
  });

  it('meta는 짧게 유지한다 — nowrap·flex-shrink:0이라 길어지면 제목이 잘린다(렌더 실측)', () => {
    const meta = sliceBetween(hook, 'meta: `', '`,');
    expect(meta).toBe('meta: `${candidate.daysSince}일 만에 →');
    expect(read('src/index.css')).toContain('color: var(--text-secondary); white-space: nowrap;');
  });

  it('후보가 없으면 조회하지 않는다 — 홈에 매번 쿼리를 얹지 않는다', () => {
    const q = sliceBetween(hook, "queryKey: ['reread-cpm'", '});');
    expect(q).toContain('enabled: !!user && !!candidate?.material_id,');
  });

  it('조회는 조건부 반환보다 앞에 있다 — 훅 순서가 렌더마다 흔들리면 React가 깨진다', () => {
    const code = codeOf(hook);
    expect(code.indexOf("queryKey: ['reread-cpm'")).toBeLessThan(code.indexOf('return null;'));
  });
});
