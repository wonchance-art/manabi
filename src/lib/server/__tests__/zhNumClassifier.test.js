import { describe, expect, it } from 'vitest';
import { tokenizeZhLine } from '../tokenizeZh';
import { ZH_CLASSIFIER } from '../zhClassifiers';
import ZH_HSK_LEVEL from '../../data/zhHskLevel.json';
import { collectZhCorpus } from './zhCorpusPinyin.test.js';

/**
 * 계약: 수사+양사 되가름·정도부사+多/少 (분석기 리뷰 라운드 5 — #1077 5501779373).
 * 코퍼스 8,534문장 실측: 수사+양사 융합 토큰 636건/72종(정답지 449건 분리), 很多 154건(정답지 112건 분리).
 *
 * 라운드 5b — 머리를 여러 글자로 확장. 라운드 5 규칙이 두 글자만 봐서 `三十个`·`五十六个`·`一万块`가
 * 통째로 남아 있었다(코퍼스 20건/14종). 大수사(百千万亿)와 零을 수사 집합에 더하고 머리를 한 토큰으로
 * 담는다 — `三十`이 수사 한 단어이지 `三`+`十`이 아니다. 이 패턴에 걸리는 HSK 표제어는 半场·零件·一头
 * 셋뿐이고 전부 방벽이 지킨다(전수 실측).
 */
const textsOf = (s) => tokenizeZhLine(s).map((t) => t.text);
/** 규칙의 사정거리 — 마지막 글자가 양사이고 앞이 전부 수사 글자. 계약이 규칙과 같은 잣대를 쓴다. */
const NUM_CHARS = new Set([...'一二三四五六七八九十两几半百千万亿零']);
const wouldSplit = (w) => {
  const c = [...w];
  return c.length >= 2 && ZH_CLASSIFIER.has(c[c.length - 1]) && c.slice(0, -1).every((x) => NUM_CHARS.has(x));
};
const posOf = (s, w) => tokenizeZhLine(s).find((t) => t.text === w)?.pos;

describe('⑥-c 수사 + 양사 — 양사가 어휘 항목으로 드러난다', () => {
  it('一个·一件·两张·三本 — 수사/양사 두 토큰', () => {
    expect(textsOf('我有一个哥哥。')).toEqual(['我', '有', '一', '个', '哥哥', '。']);
    expect(textsOf('我买了一件衣服。')).toEqual(['我', '买', '了', '一', '件', '衣服', '。']);
    expect(textsOf('两张票。')).toEqual(['两', '张', '票', '。']);
    expect(textsOf('墙上挂着一幅画。')).toContain('幅');   // jieba는 一幅를 d(부사)로 단다 — 태그 조건이 없어야 갈린다
    expect(posOf('我买了一件衣服。', '件')).toBe('양사');
    expect(posOf('我买了一件衣服。', '一')).toBe('수사');
  });

  it('둘째 글자가 양사가 아니면 무관 — 一下·一点·一起·一样은 한 토큰', () => {
    for (const [line, w] of [['等一下。', '一下'], ['我们一起去。', '一起'], ['都一样。', '一样'], ['吃一点。', '一点']]) {
      expect(textsOf(line), w).toContain(w);
      expect(ZH_CLASSIFIER.has([...w][1])).toBe(false);
    }
  });

  it('HSK 표제어인 수량 어휘는 방벽이 지킨다 — 표에 있는 것은 갈리지 않는다', () => {
    const fused = [...ZH_CLASSIFIER].map((q) => `一${q}`).filter((w) => ZH_HSK_LEVEL[w]);
    for (const w of fused) expect(textsOf(`${w}。`), w).toContain(w);
    // 머리 확장(5b)이 새로 닿는 범위 전수 — HSK 표에서 이 패턴에 걸리는 것은 이 셋뿐이다.
    // 표가 자라 넷째가 생기면 여기서 먼저 걸린다(방벽이 실제로 지키는지 확인해야 하므로).
    const reach = Object.keys(ZH_HSK_LEVEL).filter(wouldSplit);
    expect(reach.sort()).toEqual(['一头', '半场', '零件']);
    for (const w of reach) expect(textsOf(`这是${w}。`), w).toContain(w);
  });

  it('머리가 여러 글자여도 가른다 — 三十个·五十六个·一万块 (라운드 5b)', () => {
    expect(textsOf('这是三十个。')).toEqual(['这', '是', '三十', '个', '。']);
    expect(textsOf('五十六个学生。')).toEqual(['五十六', '个', '学生', '。']);
    expect(textsOf('一万块钱。')).toEqual(['一万', '块', '钱', '。']);
    expect(textsOf('百家企业。')).toEqual(['百', '家', '企业', '。']);
    // 머리는 통으로 한 토큰 — 三+十로 잘게 부수지 않는다
    expect(posOf('这是三十个。', '三十')).toBe('수사');
    expect(posOf('这是三十个。', '个')).toBe('양사');
  });

  it('수사 글자로만 이루어진 머리여야 한다 — 十分·半天·一下는 무관', () => {
    for (const [line, w] of [['十分好。', '十分'], ['半天了。', '半天'], ['等一下。', '一下']])
      expect(textsOf(line), w).toContain(w);
  });

  it('지시사+양사(这本)·양사+명사(本书)의 R3 규칙은 그대로', () => {
    expect(textsOf('这本书很好。')).toEqual(['这', '本', '书', '很', '好', '。']);
  });
});

describe('⑤ 정도부사 + 多/少 — jieba가 m으로 달던 두 글자', () => {
  it('很多·很少·太多·非常多 → 부사 + 형용사', () => {
    expect(textsOf('我有很多朋友。')).toEqual(['我', '有', '很', '多', '朋友', '。']);
    expect(textsOf('人很少。')).toEqual(['人', '很', '少', '。']);
    expect(textsOf('太多了。')).toEqual(['太', '多', '了', '。']);
    expect(posOf('我有很多朋友。', '多')).toBe('형용사');
  });

  it('后처리라 연쇄가 없다 — 억제로 풀 때 생기던 很多人이 나오지 않는다', () => {
    expect(textsOf('很多人来了。')).not.toContain('很多人');
    expect(textsOf('很多人来了。')).toEqual(['很', '多', '人', '来', '了', '。']);
  });

  it('多·少가 단독 술어면 무관 — 정도부사 없이는 손대지 않는다', () => {
    expect(textsOf('人多吗？')).toContain('多');
  });
});

describe('코퍼스 회귀 — 융합 토큰이 남지 않는다', () => {
  it('수사+양사 융합 토큰(HSK 밖·머리 길이 무관)과 很多가 콘텐츠 8,000+문장 어디에도 없다', async () => {
    const rows = await collectZhCorpus();
    const fused = new Map(); let henduo = 0;
    for (const r of rows) {
      for (const t of tokenizeZhLine(r.zh)) {
        if (wouldSplit(t.text) && !ZH_HSK_LEVEL[t.text]) fused.set(t.text, (fused.get(t.text) || 0) + 1);
        if (t.text === '很多' || t.text === '很少') henduo++;
      }
    }
    expect([...fused]).toEqual([]);
    expect(henduo).toBe(0);
  }, 120000);
});
