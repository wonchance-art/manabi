import { describe, expect, it } from 'vitest';
import { buildVocabIndex, loadRefVocabIndex, refLevelLabel } from '../refVocabIndex';

// 계약(오너 승인 ②): 급수는 저장하지 않고 표시 시점에 레퍼런스 어휘 인덱스로 계산한다.
// 중복 단어는 낮은 급수(먼저 배우는 쪽)가 이기고, H1~H6 밖(생활 등)은 최하위 순위다.

const set = (level, words) => ({ level, mod: { default: { themes: [{ words }] } } });

describe('buildVocabIndex — 급수 인덱스 구축', () => {
  it('낮은 급수가 이긴다 — 입력 순서와 무관', () => {
    const w1 = { zh: '学习', ko: '공부하다' };
    const w3 = { zh: '学习', ko: '학습' };
    const a = buildVocabIndex([set('H3', [w3]), set('H1', [w1])]);
    const b = buildVocabIndex([set('H1', [w1]), set('H3', [w3])]);
    expect(a.get('学习')).toEqual({ level: 'H1', word: w1 });
    expect(b.get('学习')).toEqual({ level: 'H1', word: w1 });
  });

  it('H1~H6 밖 레벨(생활 등)은 최하위 — H6에도 밀린다', () => {
    const life = { zh: '打卡', ko: '출근 도장' };
    const h6 = { zh: '打卡', ko: '체크인하다' };
    const ix = buildVocabIndex([set('LIFE', [life]), set('H6', [h6])]);
    expect(ix.get('打卡').level).toBe('H6');
  });

  it('zh 없는 항목·빈 테마는 건너뛴다', () => {
    const ix = buildVocabIndex([
      set('H1', [{ ko: '표기 없음' }, null, { zh: '你', ko: '너' }]),
      { level: 'H2', mod: { default: { themes: [{}] } } },
      { level: 'H3', mod: {} },
    ]);
    expect(ix.size).toBe(1);
    expect(ix.get('你').word.ko).toBe('너');
  });
});

describe('refLevelLabel — 급수 라벨', () => {
  it('H1~H6 → HSK n', () => {
    expect(refLevelLabel('H1')).toBe('HSK 1');
    expect(refLevelLabel('H6')).toBe('HSK 6');
  });
  it('그 외 레벨은 생활, 없으면 null', () => {
    expect(refLevelLabel('LIFE')).toBe('생활');
    expect(refLevelLabel(null)).toBeNull();
    expect(refLevelLabel(undefined)).toBeNull();
  });
});

describe('loadRefVocabIndex — 실제 콘텐츠 로드(중국어)', () => {
  it('미지원 언어는 null', async () => {
    expect(await loadRefVocabIndex('Japanese')).toBeNull();
    expect(await loadRefVocabIndex(null)).toBeNull();
  });

  it('중국어 인덱스는 1회 로드 후 캐시되고, 정본 항목을 담는다', async () => {
    const ix = await loadRefVocabIndex('Chinese');
    expect(ix).toBeInstanceOf(Map);
    expect(ix.size).toBeGreaterThan(1000);
    // h1 정본 대표 항목 — 급수·뜻·병음·예문이 그대로 실린다
    const hello = ix.get('你好');
    expect(hello.level).toBe('H1');
    expect(hello.word.ko).toContain('안녕');
    expect(hello.word.pinyin).toBeTruthy();
    expect(hello.word.ex?.zh).toBeTruthy();
    // 같은 언어 재요청은 같은 인덱스(중복 로드 없음)
    expect(await loadRefVocabIndex('Chinese')).toBe(ix);
  });
});
