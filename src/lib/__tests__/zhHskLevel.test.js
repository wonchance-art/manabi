import { describe, expect, it } from 'vitest';
import ZH_HSK_LEVEL from '../data/zhHskLevel.json';
import HSK_POS_FIX from '../server/data/zhPosFixHsk.json';
import { ZH_POS_FIX } from '../server/zhTokenFix.js';
import { zhHskLevelOf, zhHskProfile } from '../zhHskLevel.js';
import { tokenizeZhLine } from '../server/tokenizeZh.js';

// 계약: HSK 3.0 급수·품사 계층 (분석 개선 R3 — 오너 승인 2026-08-29).
// 원천 ivankra/hsk30(MIT, 공식 목록 11,092단어 정리본), 생성 scripts/build-zh-hsk.mjs.
// ⑴ 급수 데이터 정본 + 조회·프로필(엔진 — UI는 목업 승인 후, i+1 R1→R2 선례)
// ⑵ 품사 충돌 수확층(jieba 계열과 HSK 집합이 서로소인 것만) — R1 POS_FIX의 자동 시드.
//    R5: 고유명사류(nr/ns/nt/nz) 태그는 CEDICT 대문자 판별자(© MDBG, CC BY-SA 4.0 —
//    고유명사는 병음이 대문자)로 갈라, 소문자 독음뿐인 일반어 오태그(明白/nr·星星/nz)만
//    수확하고 진짜 고유명사(北京·성씨 겸용 毛/周)는 존중한다.

describe('zhHskLevel 데이터 정본', () => {
  const entries = Object.entries(ZH_HSK_LEVEL);

  it('규모 — 공식 목록 11,092의 한자 표제어(파이프 변형 분해 후 1만+)', () => {
    expect(entries.length).toBeGreaterThan(10000);
  });

  it('형식 전수 — 키는 한자, 값은 1~7 정수(7 = 7-9 밴드)', () => {
    const bad = entries.filter(([k, v]) => !/^[一-鿿]+$/.test(k) || !Number.isInteger(v) || v < 1 || v > 7);
    expect(bad.map(([k]) => k)).toEqual([]);
  });

  it('스팟 핀 — 1급 기초어·파이프 변형 분해·7-9 밴드', () => {
    expect(zhHskLevelOf('爱')).toBe(1);
    expect(zhHskLevelOf('爸爸')).toBe(1);
    expect(zhHskLevelOf('爸')).toBe(1); // 爸爸|爸 파이프 변형 각각 등재
    expect(zhHskLevelOf('朋友')).toBe(1);
    expect(ZH_HSK_LEVEL['癌']).toBe(7); // 7-9 밴드 → 7
    expect(zhHskLevelOf('없는말')).toBeNull();
  });
});

describe('zhHskProfile — 자료 난이도 프로필(순수)', () => {
  const words = [
    { key: '爱', text: '爱', base_form: '爱' },       // 1급
    { key: '朋友', text: '朋友', base_form: '朋友' }, // 1급
    { key: '癌', text: '癌', base_form: '癌' },       // 7(7-9)
    { key: 'XYZ', text: 'XYZ', base_form: 'XYZ' },    // 미등재
  ];

  it('급수 분포·미담김 분포·중앙값을 센다(담김은 뷰어 관용구 대조)', () => {
    const p = zhHskProfile(words, { surfaces: new Set(['爱']), bases: new Set() });
    expect(p.tagged).toBe(3);
    expect(p.untagged).toBe(1);
    expect(p.byLevel[1]).toBe(2);
    expect(p.byLevel[7]).toBe(1);
    expect(p.unknownByLevel[1]).toBe(1); // 朋友만(爱는 담김)
    expect(p.unknownByLevel[7]).toBe(1);
    expect(p.unknownMedianLevel).toBe(1); // [1,7]의 하위 중앙값
  });

  it('표본 없음 → 중앙값 null(0 무표기 결)', () => {
    const p = zhHskProfile([], {});
    expect(p.tagged).toBe(0);
    expect(p.unknownMedianLevel).toBeNull();
  });
});

describe('품사 충돌 수확층(zhPosFixHsk)', () => {
  const entries = Object.entries(HSK_POS_FIX);

  it('형식 전수 — tag는 내용어 계열(n/v/a/d), posAll은 · 연결 한국어 라벨', () => {
    const bad = [];
    for (const [w, fix] of entries) {
      if (!/^[一-鿿]+$/.test(w)) bad.push(`키 ${w}`);
      else if (!['n', 'v', 'a', 'd'].includes(fix.tag)) bad.push(`tag ${w}`);
      else if (fix.posAll !== undefined && !/^[가-힣]+(·[가-힣]+)+$/.test(fix.posAll)) bad.push(`posAll ${w}`);
    }
    expect(bad).toEqual([]);
  });

  it('수제 POS_FIX와 겹치지 않는다(수제 정본 우선 — 생성기가 제외)', () => {
    for (const w of Object.keys(ZH_POS_FIX)) {
      expect(HSK_POS_FIX[w]).toBeUndefined();
    }
  });

  it('배선 스팟 — 수확 항목이 토큰화에 실제 반영된다(成天: 시간사 오태그 → 부사)', () => {
    expect(HSK_POS_FIX['成天']).toEqual({ tag: 'd' });
    const t = tokenizeZhLine('他成天玩。').find((x) => x.text === '成天');
    expect(t.pos).toBe('부사');
    // 겸류 수확은 후보로 실려 문맥 판별기가 짚는다
    expect(HSK_POS_FIX['够']).toEqual({ tag: 'v', posAll: '동사·부사' });
  });

  it('R5 고유명사 사각 수확 — CEDICT 대문자 판별자(소문자 독음 = 일반어 오태그)', () => {
    // jieba가 nr/nz로 박제한 상용어들이 HSK 품사로 수확된다
    expect(HSK_POS_FIX['明白']).toEqual({ tag: 'a', posAll: '형용사·동사' });
    expect(HSK_POS_FIX['星星']).toEqual({ tag: 'n' });
    expect(HSK_POS_FIX['换']).toEqual({ tag: 'v' });
    // 진짜 고유명사(대문자 독음 — 성씨 겸용 포함)는 존중·배제
    expect(HSK_POS_FIX['北京']).toBeUndefined();
    expect(HSK_POS_FIX['毛']).toBeUndefined();
    expect(HSK_POS_FIX['周']).toBeUndefined();
    // 배선: 星星이 지명/고유명사가 아니라 명사로 표시된다
    const t = tokenizeZhLine('天上有很多星星。').find((x) => x.text === '星星');
    expect(t.pos).toBe('명사');
  });
});
