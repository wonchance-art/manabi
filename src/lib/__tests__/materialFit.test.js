import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FIT_MIN_TYPES, bookFit, fitBand, fitSortRank, materialContentWords, materialFit, sortByFit } from '../materialFit.js';
import { sliceBetween } from './helpers/sliceBetween.js';

// 🈁 자료 맞춤도 엔진(rfc-material-fit R1) — 결정적 커버리지·밴드 계약.

function pj(tokens) {
  const dictionary = {};
  const sequence = [];
  tokens.forEach((t, i) => {
    const id = `t${i}`;
    dictionary[id] = t;
    sequence.push(id);
  });
  return { sequence, dictionary };
}

describe('materialContentWords — 고유 내용어(types)', () => {
  it('base_form 우선 키로 첫 등장 순서를 유지하며 중복·기능어를 거른다', () => {
    const words = materialContentWords(pj([
      { text: '食べます', base_form: '食べる', pos: '동사' },
      { text: '食べた', base_form: '食べる', pos: '동사' },   // 같은 타입 — 1회
      { text: 'を', base_form: 'を', pos: '조사' },            // 기능어 — 제외
      { text: '、', base_form: '、', pos: '기호' },            // 기호 — 제외
      { text: '3', base_form: '3', pos: '수사' },              // 수사 — 제외
      { text: '\n', pos: '개행' },                             // 개행 — 제외
      { text: 'ラーメン', base_form: 'ラーメン', pos: '명사' },
      { text: '謎', pos: null },                               // pos null 내용어 — 포함(base 없음 → text 키)
    ]));
    expect(words.map((w) => w.key)).toEqual(['食べる', 'ラーメン', '謎']);
  });

  it('빈·깨진 입력은 빈 배열(안전)', () => {
    expect(materialContentWords(null)).toEqual([]);
    expect(materialContentWords({})).toEqual([]);
    expect(materialContentWords({ sequence: ['x'], dictionary: {} })).toEqual([]);
  });
});

describe('materialFit — 커버리지(뷰어 isSaved 관용구 대조)', () => {
  const json = pj([
    { text: '食べます', base_form: '食べる', pos: '동사' },
    { text: 'ラーメン', base_form: 'ラーメン', pos: '명사' },
    { text: '約束', base_form: '約束', pos: '명사' },
    { text: '謎の言葉', base_form: '謎の言葉', pos: '명사' },
  ]);

  it('surfaces(표면형)·bases(기본형) 어느 쪽으로든 잡히면 아는 말', () => {
    const fit = materialFit(json, {
      surfaces: new Set(['食べます']),     // 표면형으로 담김
      bases: new Set(['ラーメン']),        // 기본형으로 담김
    });
    expect(fit).toEqual({ total: 4, known: 2, unknown: 2, coverage: 0.5 });
  });

  it('저장어 없음·내용어 없음의 경계', () => {
    expect(materialFit(json, { surfaces: new Set(), bases: new Set() }).known).toBe(0);
    expect(materialFit(json, null).known).toBe(0);
    expect(materialFit(pj([{ text: 'を', pos: '조사' }]), null)).toEqual({
      total: 0, known: 0, unknown: 0, coverage: null,
    });
  });
});

describe('fitBand·fitSortRank — i+1 밴드', () => {
  it('임계 핀: ≥0.95 comfort · ≥0.90 fit · ≥0.75 stretch · 미만 hard', () => {
    expect(fitBand(0.96, 50)).toBe('comfort');
    expect(fitBand(0.95, 50)).toBe('comfort');
    expect(fitBand(0.92, 50)).toBe('fit');
    expect(fitBand(0.9, 50)).toBe('fit');
    expect(fitBand(0.8, 50)).toBe('stretch');
    expect(fitBand(0.5, 50)).toBe('hard');
  });

  it('표본 부족·계산 불가는 null(무표기) — 최소 표본은 저작 상수', () => {
    expect(fitBand(0.92, FIT_MIN_TYPES - 1)).toBeNull();
    expect(fitBand(0.92, FIT_MIN_TYPES)).toBe('fit');
    expect(fitBand(null, 100)).toBeNull();
  });

  it('정렬 랭크: fit → stretch → comfort → hard → 밴드 없음', () => {
    expect(['fit', 'stretch', 'comfort', 'hard', null].map(fitSortRank)).toEqual([0, 1, 2, 3, 4]);
  });

  it('sortByFit — 밴드 랭크 안정 정렬(동순위·무밴드는 원래 순서 유지, 입력 불변)', () => {
    const items = [
      { id: 'a', band: null }, { id: 'b', band: 'hard' }, { id: 'c', band: 'fit' },
      { id: 'd', band: 'comfort' }, { id: 'e', band: 'fit' }, { id: 'f', band: 'stretch' },
    ];
    const sorted = sortByFit(items, (m) => m.band);
    expect(sorted.map((m) => m.id)).toEqual(['c', 'e', 'f', 'd', 'b', 'a']); // fit 내부 c→e 순서 유지
    expect(items[0].id).toBe('a'); // 입력 배열 무변형
    expect(sortByFit(null, () => null)).toEqual([]);
  });
});

/* ── 책 단위 커버리지(R2) — 어휘 교재의 진짜 지표 ── */
describe('bookFit — 챕터 합집합 커버리지', () => {
  const chapterOf = (words) => ({
    processed_json: {
      sequence: words.map((_, i) => `t${i}`),
      dictionary: Object.fromEntries(words.map((w, i) => [`t${i}`, { text: w, base_form: w, pos: '명사' }])),
    },
  });
  const savedOf = (...words) => ({ surfaces: new Set(words), bases: new Set() });

  it('같은 단어가 여러 과에 나와도 한 번만 센다 — 평균이 아니라 합집합', () => {
    const chapters = [chapterOf(['学习', '工作', '环境']), chapterOf(['学习', '保护', '水平'])];
    const bf = bookFit(chapters, savedOf('学习', '工作'));
    expect(bf.total).toBe(5);          // 学习 중복 제거
    expect(bf.known).toBe(2);
    expect(bf.coverage).toBeCloseTo(0.4);
    // 챕터별 평균이었다면 (2/3 + 1/3)/2 = 0.5로 부풀려진다
    expect(bf.coverage).not.toBeCloseTo(0.5);
  });

  it('미분석 챕터는 0개를 기여하고 analyzed에서 빠진다 — "분석한 N과 기준"의 근거', () => {
    const chapters = [
      chapterOf(['学习', '工作']),
      { processed_json: { sequence: [], dictionary: {}, status: 'pending' } },
      { processed_json: null },
    ];
    const bf = bookFit(chapters, savedOf('学习'));
    expect(bf.analyzed).toBe(1);
    expect(bf.chapters).toBe(3);
    expect(bf.total).toBe(2);
  });

  it('전부 미분석이면 coverage는 null — 0%로 오표기하지 않는다', () => {
    const bf = bookFit([{ processed_json: null }, { processed_json: null }], savedOf('学习'));
    expect(bf.coverage).toBeNull();
    expect(bf.analyzed).toBe(0);
  });

  it('빈 책·게스트(인덱스 없음)에도 터지지 않는다', () => {
    expect(bookFit([], null).coverage).toBeNull();
    expect(bookFit(null, null).chapters).toBe(0);
    expect(bookFit([chapterOf(['学习'])], null).known).toBe(0);
  });

  it('materialFit과 같은 pos 제외 규칙을 쓴다 — 두 숫자가 같은 셈법', () => {
    const withParticle = {
      processed_json: {
        sequence: ['a', 'b'],
        dictionary: { a: { text: '学习', base_form: '学习', pos: '명사' }, b: { text: '的', base_form: '的', pos: '조사' } },
      },
    };
    expect(bookFit([withParticle], savedOf()).total).toBe(1); // 조사 제외
    expect(bookFit([withParticle], savedOf()).total).toBe(materialFit(withParticle.processed_json, savedOf()).total);
  });
});

describe('서재 책 카드 배선 계약', () => {
  it('책 카드와 자료 카드가 같은 대조 인덱스를 쓴다 — 이미 앎 반영이 갈리지 않게', () => {
    const page = fs.readFileSync(path.join(process.cwd(), 'src/views/MaterialsPage.jsx'), 'utf8');
    expect(page).toMatch(/const savedFitIndex = useMemo\([\s\S]{0,300}?mergeKnownIntoIndex/);
    expect(page).toContain('bookFit(b.chapters, savedFitIndex)');
    expect(page).toMatch(/const index = savedFitIndex;/);
    // 병합이 두 번 일어나면 안 된다 — mergeKnownIntoIndex 호출은 한 곳뿐
    expect(page.match(/mergeKnownIntoIndex\(/g)).toHaveLength(1);
  });

  it('표본 미달 책은 무표기 — fitBand와 같은 결', () => {
    // v2-P로 커버리지 줄이 `fitLineOf` 헬퍼가 됐다(책 묶음과 PDF 묶음이 같은 줄을 쓴다).
    // 판정은 그대로 한 자리에 있어야 한다 — 두 벌이 되면 한쪽만 낡는다.
    const page = fs.readFileSync(path.join(process.cwd(), 'src/views/MaterialsPage.jsx'), 'utf8');
    const guard = sliceBetween(page, 'const fitLineOf = ', '\n  };');
    expect(guard).toContain('bf.total >= FIT_MIN_TYPES');
    expect(guard).toContain('bf.coverage != null');
    // 판정이 헬퍼 밖에 복제돼 있지 않다
    expect(page.match(/bf\.total >= FIT_MIN_TYPES/g)).toHaveLength(1);
  });
});
