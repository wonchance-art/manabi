import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LEVELS } from '../constants.js';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: 어휘 레벨 사다리가 정본 급수를 전부 덮는가 (#1077, 2026-09-01).
 *
 * ── 왜 생겼나
 *
 * `VocabStats`가 `['Japanese','English','French']`를 **손으로 적어** 들고 있었다.
 * `constants.js`는 이미 4언어 정본(`LEVELS`)을 갖고 있었고 프로필 컬럼도 넷인데,
 * 이 목록 하나 때문에 **중국어만 급수 진도를 못 봤다.** 코드가 막은 게 아니라
 * 목록이 안 따라온 것이다 — `langCheckCoverage`가 잡은 CHECK 누락과 **같은 모양**이다.
 *
 * 같이 드러난 것: `LEVEL_MILESTONES.French`가 6칸인데 `FR_LEVELS`는 7칸(`A0 입문`)이라,
 * A0 학습자는 폴백으로 **A1의 500을 자기 목표로 표시**받고 있었다(라벨은 A0, 수는 A1).
 *
 * ── 무엇을 재는가
 *
 * 정본 `LEVELS`의 급수가 전부 사다리에 있거나, 없다면 **왜 없는지가 코드에 적혀 있는가**
 * (`LADDER_EXEMPT`). 비워 두는 것이 기본값이다.
 */

const SRC = 'src/views/VocabStats.jsx';
const read = () => fs.readFileSync(path.join(process.cwd(), SRC), 'utf8');

/** 소스에서 표를 읽어 { [lang]: [급수…] }로. 주석은 걷어낸다(설명이 데이터로 오독되면 안 된다). */
function ladders() {
  const block = sliceBetween(read().replace(/\/\*[\s\S]*?\*\//g, ''), 'const LEVEL_MILESTONES = {', '\n};');
  const out = {};
  for (const m of block.matchAll(/^\s{2}(\w+):\s*\{([^}]*)\}/gm)) {
    out[m[1]] = [...m[2].matchAll(/'([^']+)':\s*(\d+)/g)].map((x) => [x[1], Number(x[2])]);
  }
  return out;
}
const exemptLevels = () => [...sliceBetween(read(), 'const LADDER_EXEMPT = {', '\n};')
  .matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => m[1]);

describe('어휘 레벨 사다리 — 정본 급수 커버리지', () => {
  it('표를 실제로 읽어낸다 — 파서가 죽으면 아래 단언이 공허해진다', () => {
    const l = ladders();
    expect(Object.keys(l).sort()).toEqual(['Chinese', 'English', 'French', 'Japanese']);
    expect(l.Japanese[0]).toEqual(['N5 기초', 800]);
    for (const rows of Object.values(l)) expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  it('정본 4언어를 전부 덮는다 — 언어가 늘면 여기가 먼저 걸린다', () => {
    const l = ladders();
    const missing = Object.keys(LEVELS).filter((lang) => !l[lang]);
    expect(missing, `사다리 없는 언어: ${missing.join('·')}`).toEqual([]);
  });

  it('언어별 급수가 전부 사다리에 있거나 면제 사유가 적혀 있다', () => {
    const l = ladders();
    const exempt = new Set(exemptLevels());
    const gaps = [];
    for (const [lang, levels] of Object.entries(LEVELS)) {
      const have = new Set((l[lang] || []).map(([k]) => k));
      for (const lv of levels) {
        if (!have.has(lv) && !exempt.has(lv)) gaps.push(`${lang}/${lv}`);
      }
    }
    expect(gaps, `사다리에 없고 면제 사유도 없는 급수: ${gaps.join(', ')}\n`
      + '수치를 넣거나, 정말 없어야 한다면 LADDER_EXEMPT에 이유와 함께 적어라').toEqual([]);
  });

  it('면제는 입문 급수 둘뿐이다 — 예외 목록이 도피처가 되지 않게', () => {
    expect(exemptLevels().sort()).toEqual(['A0 입문', 'OT 입문']);
  });

  it('사다리는 오름차순이다 — 커버리지 막대가 왼쪽부터 차오른다', () => {
    for (const [lang, rows] of Object.entries(ladders())) {
      const nums = rows.map(([, n]) => n);
      expect(nums, `${lang} 사다리가 오름차순이 아니다: ${nums}`)
        .toEqual([...nums].sort((a, b) => a - b));
    }
  });

  it('중국어는 HSK 시행본 누적 수치다 — 대체된 2021 초안이 아니다', () => {
    // 2021 초안: 500·1,272·2,245·3,245·4,316·5,456 → 2026년 7월 시행본으로 대체됐다.
    // 값을 바꾸려면 이 줄도 함께 바꾸게 해서, 근거 없이 숫자만 흔들리지 않게 한다.
    expect(ladders().Chinese.map(([, n]) => n)).toEqual([300, 500, 1000, 2000, 3600, 5400]);
    expect(read(), 'HSK 수치의 출처가 코드에서 사라졌다').toContain('HSK 3.0 2026년 7월 시행본');
  });
});

describe('언어 목록 — 정본에서 나온다', () => {
  it('활성 언어를 손으로 적지 않는다', () => {
    const src = read();
    expect(src, '언어 배열을 다시 손으로 적었다').not.toMatch(/\[\s*'Japanese',\s*'English',\s*'French'/);
    expect(src).toContain('Object.keys(LEVELS)');
  });

  it('언어 이름도 정본을 쓴다 — 라벨을 두 벌 들지 않는다', () => {
    expect(read()).toContain('langNameKo(lang)');
    expect(sliceBetween(read(), 'const LANG_META = {', '\n};'), 'LANG_META가 이름을 또 든다')
      .not.toContain('label:');
  });

  it('입문 급수는 라벨과 수가 함께 첫 급수로 간다 — 어긋난 표기를 만들지 않는다', () => {
    const fn = sliceBetween(read(), 'function targetOf(', '\n}');
    expect(fn).toContain('wanted in ladder');
    expect(fn, '수만 고르고 라벨은 그대로 두면 A0에 A1의 수가 붙는다').toContain('level, count');
  });

  it('막대 색이 삼항이 아니다 — 다음 언어가 조용히 한쪽 가지로 떨어지지 않게', () => {
    const src = read();
    expect(src).toContain('LANG_BAR[effLevelLang] || DEFAULT_BAR');
    expect(src, "언어 비교 삼항이 남아 있다").not.toMatch(/effLevelLang === '\w+'\s*\?/);
  });
});
