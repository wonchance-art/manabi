import { describe, expect, it } from 'vitest';
import { tag as jiebaTag } from 'jieba-wasm';
import '../zhSuppress';
import { fixZhTagged, ZH_POS_FIX } from '../zhTokenFix';
import POS_HSK from '../data/zhPosFixHsk.json';
import SEP_HAND from '../data/zhSeparable.json';
import SEP_HSK from '../data/zhSeparableHsk.json';
import { tokenizeZhLine } from '../tokenizeZh';

/**
 * 계약: 품사 — 어휘 정답지 대조 (분석기 라운드 9, 2026-09-02).
 *
 * 어휘 표제어 6,985개를 자기 예문에서 토큰화해 콘텐츠 pos와 대조한 결과 두 부류의 실오류가 있었다:
 * ① jieba 사전이 V-O 이합사를 n으로 싣는다(走路·跑步·唱歌·上学·生病 — 코퍼스 220건). 이합사 표가 이미 이들을
 *    알고 있으니 표 가입 + n 태그 → 동사 기본·명사 후보(结果·讲话는 명사로도 쓰인다 — 판별기가 짚는다).
 * ② 사전 태그 자체가 틀린 단어(문맥 태그 = 고립 태그): 一起/m·红绿灯/nr·回国/ns·高兴/b. 고립 태그로 되돌리는
 *    일반 규칙은 재보니 손해(n→nr 62 loss)라 버렸고, 정답지가 있는 단어만 수제로 실었다.
 */
const tagOf = (line, w) => fixZhTagged(jiebaTag(line, true)).find((e) => e.word === w);
const SEP = { ...SEP_HSK, ...SEP_HAND };

describe('이합사 표 × n 태그 → 동사 기본·명사 후보', () => {
  it('走路·跑步·生病·上学 — n으로 오던 V-O가 동사·명사 후보로', () => {
    for (const [line, w] of [['我走路去学校。', '走路'], ['他每天跑步。', '跑步'], ['他生病了。', '生病'], ['孩子们去上学。', '上学']]) {
      const e = tagOf(line, w);
      expect(SEP[w], `${w} 표 가입`).toBeTruthy();
      expect(e?.tag, w).toBe('v');
      expect(e?.posAll, w).toBe('동사·명사');
      expect(tokenizeZhLine(line).find((t) => t.text === w)?.pos, w).toBe('동사');
    }
  });

  it('명사로도 쓰이는 이합사(结果·见面)는 후보에 명사가 남고, n이 아닌 태그(吃饭/v·游泳/vn)는 손대지 않는다', () => {
    expect(tagOf('这是努力的结果。', '结果')?.posAll).toBe('동사·명사');
    expect(tagOf('我们明天见面。', '见面')?.tag).toBe('v');           // jieba n — 규칙이 올린다
    // 生气(생∥기)는 콘텐츠가 형용사로 적는 상태성 V-O — jieba n → 규칙이 동사·명사 후보로 올린다(명사보다 가깝다; 형용사는
    // 판별기 후보 밖이라 분류 체계 차이로 남는다 — 정답지 대조에서 「기타 6」으로 집계된 자리).
    expect(tagOf('他很生气。', '生气')?.tag).toBe('v');
    // 규칙은 n일 때만 — v/vn에 후보를 얹지 않는다(vn의 후보는 tokenizeZh의 POS_ALL 몫)
    const chifan = tagOf('我们去吃饭。', '吃饭');
    expect(chifan?.tag).toBe('v');
    expect(chifan?.posAll).toBeUndefined();
    const youyong = tagOf('他喜欢游泳。', '游泳');
    expect(youyong?.tag).toBe('vn');
    expect(youyong?.posAll).toBeUndefined();
  });

  it('우선순위 — 수제·HSK 층이 있으면 그쪽(聊天/v 수제), 표 밖 n은 무개입', () => {
    expect(tagOf('我们在聊天。', '聊天')?.tag).toBe('v');
    expect(tagOf('我们在聊天。', '聊天')?.posAll).toBeUndefined(); // 수제 { tag: v }에는 후보가 없다
    expect(tagOf('我喜欢苹果。', '苹果')?.tag).toBe('n');
  });
});

describe('사전 오태그 수제 — 어휘 정답지가 있는 단어만', () => {
  it('고유명사 태그의 보통명사·동사·형용사, 수사 접두 부사, 구별사·시간사·x 오태그', () => {
    for (const [line, w, ko] of [
      ['到红绿灯右拐。', '红绿灯', '명사'], ['我们的友谊很深。', '友谊', '명사'], ['我今天点了外卖。', '外卖', '명사'],
      ['他明年回国。', '回国', '동사'], ['孩子们很快就长大了。', '长大', '동사'], ['他买彩票中奖了。', '中奖', '동사'],
      ['老师的解题方法十分高明。', '高明', '형용사'], ['我很高兴。', '高兴', '형용사'],
      ['我们一起去吧。', '一起', '부사'], ['我十分感谢你。', '十分', '부사'], ['万一下雨怎么办？', '万一', '부사'],
      ['你上几年级？', '年级', '명사'], ['我们全家一起过年。', '过年', '동사'], ['请你从楼上下来。', '下来', '동사'],
      ['请给我留个座位。', '留', '동사'], ['墙上悬着一幅画。', '悬', '동사'],
    ]) expect(tokenizeZhLine(line).find((t) => t.text === w)?.pos, w).toBe(ko);
  });

  it('성씨 겸용 1자(金·熊·钟·云)와 一道(一道菜)는 싣지 않았다 — 정밀도', () => {
    for (const w of ['金', '熊', '钟', '云', '富', '蓝', '帅', '咸', '一道']) expect(ZH_POS_FIX[w], w).toBeUndefined();
  });

  it('수제 항목은 HSK 수확층과 겹치지 않는다 — 겹치면 재생성 신호(build-zh-hsk HAND_POS_FIX_KEYS 동기)', () => {
    const dup = Object.keys(ZH_POS_FIX).filter((w) => POS_HSK[w]);
    expect(dup).toEqual([]);
  });
});
