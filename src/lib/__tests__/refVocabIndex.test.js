import { describe, expect, it } from 'vitest';
import { buildVocabIndex, loadRefVocabIndex } from '../refVocabIndex';

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

// 계약(ZH-DICT-FIX-001, 오너 승인 2026-10-13): 표제어 하나에 항목 하나만 남는 인덱스에서
// 사전 뜻이 한국어 동형 한자어로 오독되거나(学院≠학원·爱人≠애인) 주 독음이 낮은 급수에
// 없어 엉뚱한 뜻이 이기는(行 → háng) 회귀를 막는다.
describe('loadRefVocabIndex — 사전 정정 회귀 고정(ZH-DICT-FIX-001)', () => {
  it('行 단독 표제는 HSK 1의 xíng(좋다·괜찮다)이 이긴다 — h4의 háng(줄·업종)이 아니라', async () => {
    const ix = await loadRefVocabIndex('Chinese');
    const xing = ix.get('行');
    expect(xing.level).toBe('H1');
    expect(xing.word.pinyin).toBe('xíng');
    expect(xing.word.ko).toMatch(/^좋다/);
  });

  it('本事는 경성 běnshi(능력·재주)로 싣는다', async () => {
    const ix = await loadRefVocabIndex('Chinese');
    const w = ix.get('本事').word;
    expect(w.pinyin).toBe('běnshi');
    expect(w.ko).toMatch(/^능력/);
  });

  it('学院·爱人의 뜻은 한국어 동형어(학원·애인)로 시작하지 않고, 한자 노트로 차이를 짚는다', async () => {
    const ix = await loadRefVocabIndex('Chinese');
    const xueyuan = ix.get('学院').word;
    const airen = ix.get('爱人').word;
    expect(xueyuan.ko.startsWith('학원')).toBe(false);
    expect(airen.ko.startsWith('애인')).toBe(false);
    expect(xueyuan.hanja).toMatch(/학원.*달라요/);
    expect(airen.hanja).toMatch(/애인.*달라요/);
  });
});

// 계약(ZH-DICT-FIX-002, 오너 승인 2026-10-13): 첫 뜻이 한국 한자음과 같아 보이지만 뜻이 다른 가짜동족 12개.
// 뜻(ko) 어디에도 한국어 동형어를 두지 않아 한자 창이 「같은 한자어」로 잘못 묶지 않게 하고, 한자 노트로 차이를 짚는다.
describe('loadRefVocabIndex — 가짜동족 정정 2차 고정(ZH-DICT-FIX-002)', () => {
  const FALSE_FRIENDS = {
    事业: '사업', 工程: '공정', 电动车: '전동차', 协议: '협의', 协议书: '협의서', 道理: '도리',
    情报: '정보', 言论: '언론', 若干: '약간', 文物: '문물', 标记: '표기', 精力: '정력',
  };
  it.each(Object.entries(FALSE_FRIENDS))('%s의 뜻에 한국어 동형어 「%s」가 없고 한자 노트가 차이를 짚는다', async (zh, ko) => {
    const w = (await loadRefVocabIndex('Chinese')).get(zh).word;
    expect(w.ko.includes(ko)).toBe(false);
    expect(w.hanja).toMatch(new RegExp(`^${ko}\\(.*달라요!`));
  });
});
