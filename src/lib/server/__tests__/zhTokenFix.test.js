import { describe, expect, it } from 'vitest';
import { fixZhTagged, ZH_MEI_SPLIT, ZH_POS_FIX } from '../zhTokenFix.js';
import { tokenizeZhLine } from '../tokenizeZh.js';

// 계약: 중국어 분석 개선 R1 — 분할·품사 후처리 (오너 승인 2026-08-29 "로드맵 승인 ㄱㄱ").
// jieba 사전의 쓰레기 병합(没吵)·HMM 오조각(过架/x)·오태그(自觉/d)를 화이트리스트로
// 교정한다. add_word/빈도 조작은 실측 배제(没吵 불파·没有 파손 부작용) — 후처리가 정답.
// 원칙: 등재분만 교정, 밖은 무개입(실패 시 현행 수렴). 실단어 병합은 건드리지 않는다.

describe('没V 되가름 (화이트리스트 27종)', () => {
  it('화이트리스트 전량: 没V → 没(부사, 구조 확정이라 후보 없음) + V(동사)', () => {
    for (const w of ZH_MEI_SPLIT) {
      const out = fixZhTagged([{ word: w, tag: 'v' }]);
      expect(out).toHaveLength(2);
      expect(out[0]).toMatchObject({ word: '没', tag: 'd' });
      expect(out[0].posAll).toBeUndefined(); // 뒤가 동사임이 구조로 확정 — 판별기 불요
      expect(out[1]).toMatchObject({ word: w.slice(1), tag: 'v' });
    }
  });

  it('실단어 병합은 불변 — 没有·没关系·没什么·没事·没用은 갈라지지 않는다', () => {
    expect(ZH_MEI_SPLIT.has('没用')).toBe(false); // 쓸모없다(형용사) — 실단어라 화이트리스트 제외
    const words = tokenizeZhLine('没有钱也没关系，没什么事，没用的。').map((t) => t.text);
    expect(words).toContain('没有');
    expect(words).toContain('没关系');
    expect(words).toContain('没什么');
    expect(words).not.toContain('没有钱');
  });

  it('대표 문장 실측: 我们从来没吵过架 → 没/吵/过/架 (没吵·过架 소멸)', () => {
    const toks = tokenizeZhLine('我们从来没吵过架。');
    const words = toks.map((t) => t.text);
    expect(words).toEqual(expect.arrayContaining(['从来', '没', '吵', '过', '架']));
    expect(words).not.toContain('没吵');
    expect(words).not.toContain('过架');
    // 분할이 병음 배분보다 먼저라 글자-병음 정렬이 성립한다
    expect(toks.find((t) => t.text === '吵')?.furigana).toBe('chǎo');
    expect(toks.find((t) => t.text === '架')?.furigana).toBe('jià');
    // 되가른 过는 조사 — 학습 단어가 아니라 기능어로 표시된다
    expect(toks.find((t) => t.text === '过')?.pos).toBe('조사');
  });
});

describe('x-조각(HMM OOV)의 상조사 분리', () => {
  it('선두 상조사: 过架/x → 过(조사) + 架(x 잔여 — 기존 OOV 흐름)', () => {
    expect(fixZhTagged([{ word: '过架', tag: 'x' }])).toEqual([
      { word: '过', tag: 'ug' },
      { word: '架', tag: 'x' },
    ]);
  });

  it('말미 상조사도 같은 규칙, 비조각(x 아님)·1자 조각은 무개입', () => {
    expect(fixZhTagged([{ word: '架着', tag: 'x' }])).toEqual([
      { word: '架', tag: 'x' },
      { word: '着', tag: 'uz' },
    ]);
    expect(fixZhTagged([{ word: '过', tag: 'x' }])).toEqual([{ word: '过', tag: 'x' }]);
    // 2자 x 조각은 이제 되가른다(v2-T R1) — 이 줄은 원래 `笔在`가 **한 토큰으로 남는 것**을
    // 고정하고 있었다. 그건 요구가 아니라 당시 한계였다.
    expect(fixZhTagged([{ word: '笔在', tag: 'x' }])).toEqual([
      { word: '笔', tag: 'n' },
      { word: '在', tag: 'p' },
    ]);
  });

  it('실단어 V过/V着 병합은 배제 원칙 — 방향·결과보어 어휘는 그대로', () => {
    // 실측: 병합의 절반이 실단어(穿过 통과하다·睡着 잠들다·接着 이어서) — 일반 분리 금지
    expect(tokenizeZhLine('他睡着了。').map((t) => t.text)).toContain('睡着');
    expect(tokenizeZhLine('接着说吧。').map((t) => t.text)).toContain('接着');
  });
});

describe('POS_FIX — jieba 문맥 불문 오태그 수리', () => {
  it('自觉: d(부사) → 동사 + 후보(동사·형용사) — 문맥 판별기 이음새 재사용', () => {
    const t = tokenizeZhLine('他很自觉。').find((x) => x.text === '自觉');
    expect(t.pos).toBe('동사');
    expect(t.pos_all).toBe('동사·형용사');
  });

  it('很: zg(미지 태그 → 품사 미상이던 것) → 부사', () => {
    const t = tokenizeZhLine('他很自觉。').find((x) => x.text === '很');
    expect(t.pos).toBe('부사');
    expect(t.pos_all).toBeUndefined();
  });

  it('단독 没(jieba v 고정): 부사 + 후보(부사·동사) / 되가른 没: 후보 없이 부사 단정', () => {
    // jieba가 스스로 가른 没(没吃 앞) — 동사(没问题)·부사(没来) 겸용이라 후보를 싣는다
    const alone = tokenizeZhLine('我没吃早饭。').find((x) => x.text === '没');
    expect(alone.pos).toBe('부사');
    expect(alone.pos_all).toBe('부사·동사');
    // 화이트리스트가 가른 没(没来) — 뒤가 동사임이 구조 확정이라 후보 없음
    const split = tokenizeZhLine('他没来这个。').find((x) => x.text === '没');
    expect(split.pos).toBe('부사');
    expect(split.pos_all).toBeUndefined();
  });

  it('HMM 오병합 화이트리스트: 自觉遵守(ns 오태그) → 自觉 + 遵守', () => {
    const words = tokenizeZhLine('我们要自觉遵守规则。').map((t) => t.text);
    expect(words).toContain('自觉');
    expect(words).toContain('遵守');
    expect(words).not.toContain('自觉遵守');
  });

  it('POS_FIX 표는 존재하는 단어만 — 등재 밖 무개입(스팟: 일반 문장 불변)', () => {
    // 수제 5 + 분석기 리뷰 라운드 2 추가 37(zg·nrt 단어별 12 + nrt 오태그 6 + 고유명사 태그 보통명사·동사 19)
    // + 라운드 9 추가 51(어휘 정답지 대조 — 고유명사 태그 보통명사·동사·형용사 29·수사 접두 부사 11·구별사/시간사/x 11).
    // 개수를 못 박는다 — 표가 근거 없이 자라면 여기서 잡힌다(추가분의 근거는 zhSuppress.test·zhPosVocabGold.test·코퍼스 실측).
    expect(Object.keys(ZH_POS_FIX).slice(0, 5)).toEqual(['自觉', '没', '很', '谢谢', '安静']);
    expect(Object.keys(ZH_POS_FIX)).toHaveLength(5 + 37 + 51);
    const words = tokenizeZhLine('我在北京大学读书。').map((t) => t.text);
    expect(words).toContain('北京大学');
    expect(words).toContain('读书');
  });

  it('실단어 방벽은 x-블록·정도부사 규칙에도 선다 — 微信/x·真诚/a·不太/x는 HSK 표제어라 안 가른다(라운드 9b)', () => {
    const words = (line) => tokenizeZhLine(line).map((x) => x.text);
    expect(words('我们可以用微信联系。')).toContain('微信');   // jieba 사전 밖 → x → 되가름이 微|信으로 부수던 자리
    expect(words('他对朋友很真诚。')).toContain('真诚');       // ⑤가 真|诚으로 가르던 자리
    expect(words('不太舒服。')).toContain('不太');             // x — 교재 표제어(H2)
    expect(words('他真高。')).toEqual(expect.arrayContaining(['真', '高'])); // 표 밖 정도부사+형용사는 여전히 가른다
    expect(words('这里的人要多一些。')).not.toContain('人要'); // 표 밖 x는 여전히 되가른다
  });

  it('nr 오태그 수제 수리: 谢谢·安静(인명 사각 — 수확·판별기 모두 못 잡는 경로)', () => {
    const xie = tokenizeZhLine('谢谢你！').find((x) => x.text === '谢谢');
    expect(xie.pos).toBe('동사');
    const an = tokenizeZhLine('请保持安静。').find((x) => x.text === '安静');
    expect(an.pos).toBe('형용사');
    expect(an.pos_all).toBe('형용사·동사');
    // 정당한 고유명사 태그는 불변 — 지명 존중(북경은 POS_FIX 밖)
    expect(tokenizeZhLine('我在北京。').find((x) => x.text === '北京').pos).toBe('지명');
  });
});
