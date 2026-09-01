import { describe, expect, it } from 'vitest';
import { fixZhTagged, ZH_DEGREE_ADV } from '../zhTokenFix';
import { ZH_KEEP_MERGED } from '../zhKeepMerged';
import { tokenizeZhLine } from '../tokenizeZh';

/**
 * 계약: v2-T 중국어 토큰 경계 교정 R1·R2 (#1077 설계 5487116369, 오너 "우선순위대로 ㄱㄱ").
 *
 * ── 왜 화면 문제가 아닌가
 *
 * 중국어는 `base_form = 표면형`이라 **토큰 경계가 곧 표제어**다. 경계가 틀리면 표시만
 * 틀리는 게 아니라 뜻 조회를 거쳐 **전 사용자 공유 사전(`morpheme_dictionary`)에 가짜
 * 표제어가 적재**된다. `人要`의 뜻이 「사람은 마땅히」로 나온 것이 증거다 — 조사 '은'이
 * 들어간 순간 그건 단어가 아니라 절(節)이고, LLM도 절인 줄 알면서 표제어로 뜻을 지었다.
 *
 * ── 원인은 탐지기를 거꾸로 쓴 것
 *
 * `x` + 한자는 **HMM 조작물의 지문**인데, 옛 코드는 그것을 식별해 놓고 실단어로 승격했다.
 * 당시 목적(기호 오분류로 병음이 사라지는 사고 차단)은 옳았고 신호 소비 방향만 반대였다.
 *
 * ── 실측 (우리 교재 2332문장 · 14703토큰)
 *
 *   x+한자(2자↑) 278건(1.9%) · 고유 158종 · 그중 진짜 단어 5종(3%)
 *   상위 40종이 전부 오병합 — 我要 我学 我来 这是 学了 写得 热得 冷得 很难 太累 …
 *   `写得`·`热得`는 V得 정도보어(HSK3), `学了`는 상조사 — **문법이 통째로 사라지고 있었다.**
 */

const textsOf = (line) => tokenizeZhLine(line).map((t) => t.text);

describe('R1 — x+한자 토큰을 되가른다', () => {
  it('주어+술어·동사+조사·지시사+양사가 토큰으로 존재하지 않는다', () => {
    // 「없다」를 `not.toContain`으로만 적으면 규칙이 죽어도 다른 이유로 통과할 수 있다.
    // 문장 전체 분할을 **긍정으로** 고정한다.
    expect(textsOf('人要吃饭。')).toEqual(['人', '要', '吃饭', '。']);
    expect(textsOf('我学过中文。')).toEqual(['我', '学', '过', '中文', '。']);
    expect(textsOf('那家店很好。')).toEqual(['那', '家', '店', '很', '好', '。']);
    expect(textsOf('笔在桌子上。')).toEqual(['笔', '在', '桌子', '上', '。']);
  });

  it('3자 이상도 되가른다 — 2자로 한정할 수 없다', () => {
    expect(fixZhTagged([{ word: '那家店', tag: 'x' }]).map((e) => e.word)).toEqual(['那', '家', '店']);
    expect(fixZhTagged([{ word: '我学过', tag: 'x' }]).map((e) => e.word)).toEqual(['我', '学', '过']);
  });

  it('특수 규칙이 떼어내고 남긴 조각도 되가른다', () => {
    // `我学过/x`는 말미 상조사 규칙이 먼저 잡아 `我学/x` + `过/ug`를 만든다. 잔여 조각이
    // 되가름을 건너뛰면 **`我学`가 가짜 표제어로 살아남는다**(구현 중 실측한 실패).
    expect(fixZhTagged([{ word: '我学过', tag: 'x' }]).map((e) => e.word)).not.toContain('我学');
    // 상조사·양사 규칙 자체는 그대로 — 1자 잔여는 되가름 대상이 아니다.
    expect(fixZhTagged([{ word: '过架', tag: 'x' }])).toEqual([
      { word: '过', tag: 'ug' }, { word: '架', tag: 'x' },
    ]);
  });

  it('조각마다 품사 태그가 붙는다 — 미상으로 흘리지 않는다', () => {
    const tags = fixZhTagged([{ word: '人要', tag: 'x' }]);
    expect(tags).toEqual([{ word: '人', tag: 'n' }, { word: '要', tag: 'v' }]);
  });

  it('허용목록은 병합을 유지한다 — 신조어·2자 인명', () => {
    expect(textsOf('请扫码支付。')).toContain('扫码');
    expect(textsOf('李明是学生。')).toContain('李明');
    for (const w of ZH_KEEP_MERGED) {
      expect(fixZhTagged([{ word: w, tag: 'x' }]), `${w}가 갈렸다`).toEqual([{ word: w, tag: 'x' }]);
    }
  });

  it('허용목록이 실제로 일을 한다 — 등재 항목은 전부 되가름 대상이다', () => {
    // 규칙에 애초에 안 걸리는 단어를 넣어 두면 목록이 지키는 게 없으면서 커진다.
    for (const w of ZH_KEEP_MERGED) {
      expect([...w].length, `${w}: 1자는 규칙 대상이 아니다`).toBeGreaterThan(1);
      expect(/[一-鿿]/.test(w), `${w}: 한자가 없으면 규칙 대상이 아니다`).toBe(true);
    }
  });

  it('사전에 있는 실단어는 건드리지 않는다 — x가 아니기 때문이다', () => {
    // 기존 주석이 경고한 부류(穿过 통과하다·睡着 잠들다·接着 이어서)는 제대로 태깅돼 있어
    // 이 규칙의 사정권 밖이다. 착수 전 실측으로 확인했다.
    expect(textsOf('我穿过马路。')).toContain('穿过');
    expect(textsOf('他睡着了。')).toContain('睡着');
    expect(textsOf('接着说吧。')).toContain('接着');
  });

  it('병음이 조각을 따라간다 — 줄 단위 계산이라 손실이 없다', () => {
    const t = tokenizeZhLine('人要吃饭。');
    expect(t.slice(0, 2).map((x) => [x.text, x.furigana])).toEqual([['人', 'rén'], ['要', 'yào']]);
    for (const tok of t) {
      if (!/[一-鿿]/.test(tok.text)) continue;
      expect(tok.furigana, `${tok.text}에 병음이 없다`).not.toBe('');
    }
  });

  it('막혀 있던 이합사 인지가 살아난다 — 같은 원인의 다른 증상이었다', () => {
    // `他去理了发。`는 HMM이 去+理를 붙여 V 클러스터가 성립하지 않아 회랑 탐색이
    // 시작조차 못 했다. 되가름이 원인을 없애자 미스가 적중이 됐다.
    expect(tokenizeZhLine('他去理了发。').find((t) => t.text === '理')?.base_form).toBe('理发');
  });
});

describe('R2 — 정도부사 + 형용사', () => {
  it('사전 등재 병합을 가른다 — x가 아니라 R1이 못 잡는 갈래', () => {
    expect(textsOf('这本书太薄了。')).toEqual(['这', '本书', '太', '薄', '了', '。']);
    expect(textsOf('这件衣服太小了。')).toContain('太');
    expect(textsOf('他跑得很快。')).toEqual(['他', '跑', '得', '很', '快', '。']);
  });

  it('여러 글자 형용사도 가른다', () => {
    expect(fixZhTagged([{ word: '很漂亮', tag: 'n' }]).map((e) => e.word)).toEqual(['很', '漂亮']);
    expect(fixZhTagged([{ word: '非常好', tag: 'a' }]).map((e) => e.word)).toEqual(['非常', '好']);
  });

  it('形이 아닌 것은 가르지 않는다 — 게이트가 단독 형용사 태그다', () => {
    for (const w of ['太阳', '太太', '太极', '太空', '真理', '真正', '真实', '认真', '很多', '真的']) {
      expect(fixZhTagged([{ word: w, tag: 'n' }]).map((e) => e.word), `${w}가 갈렸다`).toEqual([w]);
    }
  });

  it('最·更는 정도부사 집합에 없다 — 진짜 표제어를 부수기 때문이다', () => {
    // 설계는 넣자고 했으나 재측정에서 오분리가 나왔다: 最近(HSK1)·最好·更新이 전부
    // 「부사+형용사」 꼴로 걸린다. x 토큰(사전 밖)과 달리 여기는 **사전에 있는 단어**를
    // 가르는 규칙이라, 재현율보다 정밀도를 택한다.
    expect(textsOf('最近很忙。')).toContain('最近');
    expect(textsOf('手机更新了。')).toContain('更新');
    expect(fixZhTagged([{ word: '最好', tag: 'a' }]).map((e) => e.word)).toEqual(['最好']);
  });

  it('정도부사 목록은 서로 접두가 아니다 — 그래야 찾는 순서가 무의미하다', () => {
    // 접두 관계인 항목이 들어오면(예: `非` + `非常`) 짧은 쪽이 먼저 걸려 긴 부사가 죽는다.
    // 지금은 서로 접두가 아니라 순서가 무의미한데, 그 전제가 깨지는 순간을 여기서 잡는다.
    const advs = ZH_DEGREE_ADV;
    for (const a of advs) {
      for (const b of advs) {
        if (a === b) continue;
        expect(b.startsWith(a), `${a}가 ${b}의 접두 — 긴 것부터 찾도록 정렬이 필요하다`).toBe(false);
      }
    }
  });

  it('x 토큰은 R1이 맡는다 — 두 규칙이 겹치지 않는다', () => {
    // `太累`·`真热`는 x 태그라 R1 소관이다. R2가 x를 건드리면 규칙 둘이 같은 자리를 다툰다.
    expect(fixZhTagged([{ word: '太累', tag: 'x' }]).map((e) => e.word)).toEqual(['太', '累']);
    expect(textsOf('今天太累了。')).toEqual(['今天', '太', '累', '了', '。']);
  });
});
