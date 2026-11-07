import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { RETIRED_SERIES_PATH, SERIES_TITLE_ILIKE, withoutRetiredSeries } from '../constants';

/**
 * 계약(SEED-EXPOSE-001 · 2026-11-08 KST): 공개 목록 · 공개 글 수 · 스터디 그룹 후보 · 사이트맵은 **제목 모양이 아니라 명시 은퇴 표식**
 * (processed_json.metadata.retired_series)으로만 자료를 숨긴다 — 제목 패턴 숨김이 새 중국어 시드 9편을 실수로 숨겼다(운영 실측).
 * 네 곳은 정본 withoutRetiredSeries 하나를 쓴다(어긋나면 「N편」이라 세고 열면 0편 — 2026-10-16 실측). 대상은 0편에서 시작(B안).
 */
const read = (p) => fs.readFileSync(p, 'utf8');
const code = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join('\n');
const SITES = ['src/views/MaterialsPage.jsx', 'src/app/(app)/discover/page.jsx', 'src/lib/studyGroups.js', 'src/lib/server/curatedMaterials.js'];

describe('SEED-EXPOSE-001 — 은퇴 판정은 명시 표식 하나', () => {
  it('정본 판정 = 표식 칸이 비어 있는 행만(is null)', () => {
    const calls = [];
    const q = { is: (...a) => { calls.push(a); return q; } };
    expect(withoutRetiredSeries(q)).toBe(q);
    expect(calls).toEqual([[RETIRED_SERIES_PATH, null]]);
    expect(RETIRED_SERIES_PATH).toBe('processed_json->metadata->>retired_series');
  });

  it('네 곳 모두 withoutRetiredSeries를 쓰고, 제목 패턴으로 숨기지 않는다', () => {
    for (const f of SITES) {
      const src = code(read(f));
      expect(src, f).toMatch(/withoutRetiredSeries\(/);
      expect(src, f).not.toMatch(/SERIES_TITLE_ILIKE|not\('title', 'ilike'/);
    }
  });

  it('시리즈 제목 패턴은 연재 앞뒤 찾기에만 남는다', () => {
    expect(SERIES_TITLE_ILIKE).toBe('[%#%]%');
    const users = fs.readdirSync('src', { recursive: true })
      .filter((f) => /\.(js|jsx)$/.test(f) && !f.includes('__tests__'))
      .filter((f) => code(read(`src/${f}`)).includes('SERIES_TITLE_ILIKE'));
    expect(users.sort()).toEqual(['lib/constants.js']);
  });
});
