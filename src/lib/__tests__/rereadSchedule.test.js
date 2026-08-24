import { describe, expect, it } from 'vitest';
import { REREAD_AFTER_DAYS, pickRereadCandidates } from '../rereadSchedule.js';

// 계약: 재독 후보(#1077-12) — KST 일 단위 14일 경계, 최신순 상한 3, 무효 행 제외.

const NOW = Date.parse('2026-08-23T12:00:00+09:00');
const row = (id, completedAt, done = true) => ({ material_id: id, is_completed: done, completed_at: completedAt });

describe('pickRereadCandidates', () => {
  it('상수 — 14일', () => {
    expect(REREAD_AFTER_DAYS).toBe(14);
  });

  it('KST 일 단위 경계 — 14일째(0시 넘김)는 포함, 13일째는 늦은 밤이어도 제외', () => {
    // 2026-08-09에 완독 → 8/23은 14일째(포함). 시각은 무관(일 단위).
    const incl = pickRereadCandidates({ progressRows: [row(1, '2026-08-09T23:30:00+09:00')], now: NOW });
    expect(incl.map((c) => c.material_id)).toEqual([1]);
    expect(incl[0].daysSince).toBe(14);
    // 2026-08-10 완독 → 8/23은 13일째(제외) — 8/23 어느 시각이어도.
    const excl = pickRereadCandidates({
      progressRows: [row(2, '2026-08-10T00:10:00+09:00')],
      now: Date.parse('2026-08-23T23:59:00+09:00'),
    });
    expect(excl).toEqual([]);
  });

  it('완독 최신순 정렬·상한 3', () => {
    const rows = [
      row(1, '2026-07-01T10:00:00+09:00'),
      row(2, '2026-08-01T10:00:00+09:00'),
      row(3, '2026-07-15T10:00:00+09:00'),
      row(4, '2026-08-05T10:00:00+09:00'),
    ];
    const picked = pickRereadCandidates({ progressRows: rows, now: NOW });
    expect(picked.map((c) => c.material_id)).toEqual([4, 2, 3]);
  });

  it('미완독·무효 completed_at 행은 조용히 제외, 빈 입력은 빈 배열', () => {
    const rows = [
      row(1, '2026-08-01T10:00:00+09:00', false), // 미완독
      row(2, null),
      row(3, '언제였더라'),
    ];
    expect(pickRereadCandidates({ progressRows: rows, now: NOW })).toEqual([]);
    expect(pickRereadCandidates({ progressRows: [], now: NOW })).toEqual([]);
    expect(pickRereadCandidates({ now: NOW })).toEqual([]);
  });
});

// 배선 계약(목업 ② — UI 라운드): 홈 카드가 엔진을 쓰고, 후보 없으면 조용히 생략.
describe('재독 카드 배선 계약', () => {
  it("재독 후보 훅이 엔진을 소비하고 '이어서' 덱 항목으로 홈에 배선된다", async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

    const hook = read('src/lib/useRereadCandidate.js');
    expect(hook).toContain('pickRereadCandidates');
    // 훅이 렌더가 아니라 **항목 서술**을 준다 — 덱이 개수를 알아야 껍데기를 결정한다.
    expect(hook).toContain("key: 'reread'");
    expect(hook).toContain('kicker');

    const home = read('src/views/HomePage.jsx');
    expect(home).toContain('<ContinueDeck items={continueDeckItems} />');
    expect(home).toContain('useRereadCandidate()');
    // 조건부 훅 호출 금지 — 훅은 early return보다 위에 있어야 한다.
    expect(home.indexOf('useRereadCandidate()')).toBeLessThan(home.indexOf('if (!user) return'));
    // 옛 전용 카드는 부활 금지
    expect(home).not.toContain('<RereadCard />');
    expect(fs.existsSync(path.join(process.cwd(), 'src/components/RereadCard.jsx'))).toBe(false);
  });
});
