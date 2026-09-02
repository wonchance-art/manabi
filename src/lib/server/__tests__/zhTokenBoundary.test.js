import { describe, expect, it } from 'vitest';
import { fixZhTagged, ZH_DEGREE_ADV } from '../zhTokenFix';
import { ZH_KEEP_MERGED } from '../zhKeepMerged';
import { ZH_CLASSIFIER, ZH_DEMONSTRATIVE } from '../zhClassifiers';
import ZH_HSK_LEVEL from '../../data/zhHskLevel.json';
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
    // `本书`는 v2-T R3(양사 계열)가 마저 가른다 — 여기 계약의 표적은 `太薄`다.
    expect(textsOf('这本书太薄了。')).toEqual(['这', '本', '书', '太', '薄', '了', '。']);
    expect(textsOf('这件衣服太小了。')).toContain('太');
    expect(textsOf('他跑得很快。')).toEqual(['他', '跑', '得', '很', '快', '。']);
  });

  it('여러 글자 형용사도 가른다', () => {
    expect(fixZhTagged([{ word: '很漂亮', tag: 'n' }]).map((e) => e.word)).toEqual(['很', '漂亮']);
    expect(fixZhTagged([{ word: '非常好', tag: 'a' }]).map((e) => e.word)).toEqual(['非常', '好']);
  });

  it('形이 아닌 것은 가르지 않는다 — 게이트가 단독 형용사 태그다', () => {
    // 很多는 라운드 5가 多·少를 명시 허용해 갈린다(zhNumClassifier.test) — 여기서 뺐다.
    for (const w of ['太阳', '太太', '太极', '太空', '真理', '真正', '真实', '认真', '真的']) {
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

/**
 * R3 — 양사 계열 (2026-09-01).
 *
 * ── 설계가 잡은 표적이 실물에 없었다
 *
 * 설계 §6은 `本书`·`这本`을 표적으로 적었는데, 재측하니 **`这本`은 애초에 토큰으로 나오지
 * 않는다.** `这本书`는 `这` + **`本书`** 로 갈린다 — 양사가 앞 지시사가 아니라 **뒤 명사에
 * 붙는다**(`这首歌`→`这`+`首歌`도 같다). 그래서 갈래를 둘로 나눠 잡는다:
 *   ⑥-a 지시사+양사(`这件`·`那条`·`那位`·`那本书`) — 지시사를 뗀다
 *   ⑥-b 양사+명사(`本书`·`首歌`) — 양사를 뗀다
 *
 * ── 수사+양사(`三个`·`两杯`·`一部`·`一家`)는 **건드리지 않는다**
 *
 * 数量结构는 문법상 구(句)지만 학습자 눈에도 「세 개」가 한 덩어리로 읽히고, jieba도
 * `m` 한 덩어리로 본다. 규칙이 양사 목록으로만 발화하므로 수사로 시작하는 이 갈래는
 * **구조적으로** 닿지 않는다 — 방침을 코드가 아니라 규칙의 모양이 지킨다.
 *
 * ── 정밀도의 근거 둘
 *
 * ⑴ **실단어 방벽 = HSK 표제어 10,935종.** 후보 규칙을 표제어 전량에 돌려 발화 **0건**
 *    (실측). `本来`·`个人`·`条件`·`位置`·`家人`·`头发`·`门口`·`把握`·`座位`처럼 양사
 *    글자로 시작하는 실단어가 전부 이 표에 있다.
 * ⑵ **앞자리 조건.** 양사는 수사·지시사 뒤에서만 양사다. 이 조건이 없으면 `块头很大`의
 *    `块头`(체격 — 실단어인데 HSK 표에 없다)가 갈린다(실측: 조건 없이 3건 발화 중 1건).
 */
describe('R3 — 양사 계열', () => {
  it('지시사 + 양사를 가른다 — 3자 병합도 끝까지', () => {
    expect(textsOf('这件衣服很贵。')).toEqual(['这', '件', '衣服', '很', '贵', '。']);
    expect(textsOf('那位老师很严格。')).toEqual(['那', '位', '老师', '很', '严格', '。']);
    expect(textsOf('那条路很长。')).toEqual(['那', '条', '路', '很', '长', '。']);
    // `那本书`는 세 글자가 통째로 `nr`(인명!)로 병합돼 있었다 — 끝까지 해체된다.
    expect(textsOf('那本书是我的。')).toEqual(['那', '本', '书', '是', '我', '的', '。']);
    // 의문 지시사 `哪`도 같은 자리다 — 빼면 `本书`·`哪位`·`哪条`가 되살아난다(실측).
    expect(textsOf('哪本书是你的？')).toEqual(['哪', '本', '书', '是', '你', '的', '？']);
    expect(textsOf('哪位老师教你？')).toEqual(['哪', '位', '老师', '教', '你', '？']);
    expect(textsOf('哪条路更近？')).toEqual(['哪', '条', '路', '更', '近', '？']);
  });

  it('양사 + 명사를 가른다 — 설계가 못 본 진짜 표적', () => {
    expect(textsOf('这本书很好看。')).toEqual(['这', '本', '书', '很', '好看', '。']);
    expect(textsOf('这首歌很好听。')).toEqual(['这', '首', '歌', '很', '好听', '。']);
    // 수사 뒤에서도 같다 — 앞자리가 `一`이어도 수량 자리다.
    expect(textsOf('我买了一本书。')).toEqual(['我', '买', '了', '一', '本', '书', '。']);
    // 지시사 + 수사 + 양사 + 명사가 겹쳐도 끝까지
    expect(textsOf('这三本书都是新的。')).toEqual(['这', '三', '本', '书', '都', '是', '新', '的', '。']);
  });

  it('갈린 양사에는 양사 태그가 붙는다 — 자리를 아는 쪽이 사전보다 정확하다', () => {
    // jieba 단독 태깅은 `条`를 명사, `件`을 미상으로 준다(실측). 지시사를 뗀 자리에
    // 양사 한 글자가 남았다면 그건 구조로 확정된 양사라 물어볼 필요가 없다.
    const posOf = (line, w) => tokenizeZhLine(line).find((t) => t.text === w)?.pos;
    expect(posOf('那条路很长。', '条')).toBe('양사');
    expect(posOf('这件衣服很贵。', '件')).toBe('양사');
    expect(posOf('这本书很好看。', '本')).toBe('양사');
  });

  it('앞자리가 수량 자리가 아니면 안 가른다 — `块头`가 살아남는 유일한 이유', () => {
    // 이 조건이 규칙 정밀도의 절반이다. 없애면 문장 첫머리의 `块头`(체격)가 갈린다.
    expect(textsOf('块头很大。')).toContain('块头');
  });

  it('실단어 방벽(HSK 표제어)이 일한다 — 없으면 진짜 단어가 부서진다', () => {
    // 앞자리 조건만으로는 못 막는다. 지시사 **뒤에** 오는 실단어가 정확히 규칙의 모양이라
    // 두 가드가 겹치지 않는다 — 방벽을 빼고 재보면(실측 2026-09-01) 이 일곱이 부서졌다.
    // 규칙 모양에 맞는 HSK 표제어는 전부 76종이고, 그 전부가 이 방벽 뒤에 있다.
    for (const [line, w] of [['那家人很好。', '家人'], ['这本子是新的。', '本子'],
      ['那台灯很亮。', '台灯'], ['这瓶子空了。', '瓶子'], ['这盒子里有什么？', '盒子'],
      ['那部门很大。', '部门'], ['这双手很冷。', '双手']]) {
      expect(textsOf(line), `${w}가 부서졌다`).toContain(w);
    }
  });

  it('수사+양사도 가른다 — R3의 방침을 라운드 5가 실측으로 뒤집었다', () => {
    // R3는 지시사+양사만 갈랐다. 리뷰 코퍼스 대조(8,534문장)에서 수사+양사 융합이 636건/72종이고 정답지가
    // 449건을 갈라 적었다 — 양사(件·张·条)가 학습자에게 어휘 항목인데 숨어 있었다(zhNumClassifier.test).
    for (const [line, w, pieces] of [['我有三个苹果。', '三个', ['三', '个']], ['他喝了两杯水。', '两杯', ['两', '杯']],
      ['我看了一部电影。', '一部', ['一', '部']], ['那里有一家店。', '一家', ['一', '家']]]) {
      const texts = textsOf(line);
      expect(texts, `${w}가 안 갈렸다`).not.toContain(w);
      expect(texts.join(' ')).toContain(pieces.join(' '));
    }
    // 수사 글자는 여전히 양사 목록 밖 — 수사가 양사로 오인돼 명사 앞에서 떨어지는 일은 없다.
    for (const n of [...'一二两三四五六七八九十几半']) {
      expect(ZH_CLASSIFIER.has(n), `${n}이 양사 목록에 들어왔다`).toBe(false);
    }
  });

  it('지시사+X 실단어는 지킨다 — 样·里·些는 양사가 아니라 자동으로 빠진다', () => {
    for (const [line, w] of [['这样做不对。', '这样'], ['那样说不好。', '那样'],
      ['这里很安静。', '这里'], ['那里有店。', '那里'], ['那些人在等车。', '那些']]) {
      expect(textsOf(line), `${w}가 갈렸다`).toContain(w);
    }
    for (const ch of [...'样里些么儿时']) {
      expect(ZH_CLASSIFIER.has(ch), `${ch}가 양사 목록에 들어왔다`).toBe(false);
    }
  });

  it('`这个`·`那个`·`哪个`는 실단어라 지킨다 — HSK 표의 구멍을 허용목록이 막는다', () => {
    // 표가 `这`와 `个`를 따로만 실어 방벽에 구멍이 있다. R2가 `最`·`更`를 뺀 것과 같은
    // 판단 — 이 축이 잡으려는 것은 뜻을 지어낼 수밖에 없는 절 조각이지, 온전한 뜻을
    // 가진 실단어가 아니다.
    for (const w of ['这个', '那个', '哪个']) {
      expect(ZH_HSK_LEVEL[w], `${w}가 HSK 표에 생겼다면 허용목록에서 빼도 된다`).toBeUndefined();
      expect(ZH_KEEP_MERGED.has(w), `${w}가 허용목록에서 빠졌다`).toBe(true);
    }
    expect(textsOf('这个节目很有意思。')).toContain('这个');
    expect(textsOf('那个人是谁？')).toContain('那个');
  });

  it('허용목록은 x-블록의 특수 규칙보다 **먼저** 본다', () => {
    // `这个`는 `个`로 끝나 R4a-C(个 꼬리 분리)에 먼저 걸렸다 — 방벽을 우회해 这+个로
    // 갈렸다. 한때 「호출부 검사를 지워도 돌연변이가 생존」했던 자리인데, 그건 등재어 중
    // 过·了·着·个로 끝나는 것이 없었기 때문이다. 「지금 등가라서 지운다」의 반례다.
    expect(fixZhTagged([{ word: '这个', tag: 'x' }])).toEqual([{ word: '这个', tag: 'x' }]);
    // 특수 규칙 자체는 살아 있다 — 등재되지 않은 조각은 그대로 갈린다.
    expect(fixZhTagged([{ word: '帮个', tag: 'x' }]).map((e) => e.word)).toEqual(['帮', '个']);
  });

  it('HSK 표제어 전량에 규칙이 발화하지 않는다 — 방벽 전수 검사', () => {
    // 이 축의 정밀도 근거를 표본이 아니라 **전수**로 고정한다. 양사 목록을 늘리다
    // 실단어를 부수면 여기서 잡힌다.
    const fired = [];
    for (const w of Object.keys(ZH_HSK_LEVEL)) {
      const chars = [...w];
      if (chars.length < 2) continue;
      if (ZH_DEMONSTRATIVE.has(chars[0]) && ZH_CLASSIFIER.has(chars[1])) fired.push(w);
    }
    expect(fired, `HSK 표제어가 지시사+양사로 갈릴 뻔했다: ${fired.join(' ')}`).toEqual([]);
  });
});
