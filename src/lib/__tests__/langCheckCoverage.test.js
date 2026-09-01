import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LEVELS } from '../constants.js';

/**
 * 계약: `language` CHECK 제약이 우리가 쓰는 언어를 전부 덮는가 (v2-T R3, 2026-09-01).
 *
 * ── 왜 이 계약이 생겼나
 *
 * `morpheme_dictionary.language`에 `CHECK (language IN ('Japanese','English'))`가
 * 2026-04-15부터 걸려 있었다. 그 뒤 프랑스어·중국어가 열렸는데 이 제약은 따라오지
 * 않았고, **아무도 몰랐다** — `fetchMeanings`가 중국어 행을 upsert할 때마다 제약에
 * 막혀 실패했지만, 실패를 사용자에게 새지 않게 `console.warn`으로 삼키는 설계라
 * 화면에는 아무 일도 안 일어난 것처럼 보였기 때문이다.
 *
 * 결과: 공유 사전 캐시가 중국어·프랑스어에서 **영구히 차가웠고**(같은 단어를 매번 다시
 * 물었다), 그 행을 읽어야 뜨는 한자 대조의 `日` 자형 줄·`⚠` 경고는 **뜰 수가 없었다**.
 * 기능이 없는 게 아니라 닿지 못하고 있었다.
 *
 * 같은 누락이 `content_sources`에도 있었고(2026-08-31 완화), 그 마이그레이션 주석이
 * 「선례: user_ref_progress도 같은 이유로 완화했다」고 적고 있다. **세 번째다.**
 * 세 번 반복된 실수는 문서가 아니라 계약으로 막는다 — 다음 표는 CI가 잡는다.
 *
 * ── 무엇을 재는가
 *
 * 마이그레이션 전량을 파일명 순으로 읽어 표별 **최종** `language` CHECK를 구성하고,
 * 정본 언어 집합(`constants.js`의 `LEVELS` 키)을 덮는지 본다. 좁혀도 되는 표는
 * 근거와 함께 `NARROW_BY_DESIGN`에 적는다 — 비워 두는 것이 기본값이다.
 */

const MIG_DIR = path.join(process.cwd(), 'supabase/migrations');
const CANON = Object.keys(LEVELS);

/** 의도적으로 좁은 표 — 넣을 때는 **왜 그 언어만인지**를 값에 적는다. */
const NARROW_BY_DESIGN = {
  // (지금은 없다. 값 예시: some_table: '일본어 전용 기능 — 한자 획순은 ja에만 있다')
};

/** 마이그레이션 전량 → { [table]: Set<language> } (뒤 파일이 이긴다). */
function finalLanguageChecks() {
  const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
  const out = new Map();
  for (const f of files) {
    // 주석 줄은 통째로 버린다 — 설명·롤백 예시가 실제 제약으로 오독되면 안 된다.
    const sql = fs.readFileSync(path.join(MIG_DIR, f), 'utf8')
      .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

    // ① CREATE TABLE 안의 인라인 CHECK
    for (const m of sql.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\n\);/g)) {
      const langs = /CHECK\s*\(\s*language\s+IN\s*\(([^)]*)\)\s*\)/.exec(m[2]);
      if (langs) out.set(m[1], parseLangs(langs[1]));
    }
    // ② ALTER TABLE ... ADD CONSTRAINT ... CHECK
    for (const m of sql.matchAll(/ALTER TABLE\s+(\w+)[\s\S]*?CHECK\s*\(\s*language\s+IN\s*\(([^)]*)\)\s*\)/g)) {
      out.set(m[1], parseLangs(m[2]));
    }
  }
  return out;
}

const parseLangs = (body) => new Set([...body.matchAll(/'([^']+)'/g)].map((m) => m[1]));

describe('language CHECK 커버리지 계약', () => {
  it('마이그레이션에서 제약을 실제로 읽어낸다 — 파서가 죽으면 계약이 공허해진다', () => {
    const checks = finalLanguageChecks();
    expect(checks.size, 'language CHECK를 하나도 못 읽었다 — 파서를 고쳐라').toBeGreaterThan(0);
    expect(checks.has('morpheme_dictionary')).toBe(true);
    expect(checks.has('content_sources')).toBe(true);
  });

  it('모든 표가 정본 언어 집합을 덮는다 — 조용히 거부되는 언어가 없다', () => {
    const missing = [];
    for (const [table, allowed] of finalLanguageChecks()) {
      if (NARROW_BY_DESIGN[table]) continue;
      const gap = CANON.filter((l) => !allowed.has(l));
      if (gap.length > 0) missing.push(`${table}: ${gap.join('·')} 누락`);
    }
    expect(
      missing,
      `언어가 빠진 CHECK가 있다. 마이그레이션으로 완화하거나(운영 적용은 오너 수동),\n`
      + `그 표가 정말 좁아야 한다면 NARROW_BY_DESIGN에 근거와 함께 적어라:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('정본 언어 집합이 넷이다 — 언어가 늘면 이 계약이 먼저 걸린다', () => {
    // 새 언어를 열면 여기가 아니라 위 테스트가 먼저 빨개진다(제약이 안 따라오므로).
    // 그게 이 계약의 목적이다.
    expect(CANON).toEqual(['Japanese', 'English', 'French', 'Chinese']);
  });
});
