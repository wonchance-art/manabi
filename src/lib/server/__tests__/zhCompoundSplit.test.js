import { describe, expect, it } from 'vitest';
import { tag as jiebaTag } from 'jieba-wasm';
import '../zhSuppress';
import { fixZhTagged, splitZhCompound } from '../zhTokenFix';
import { ZH_KEEP_MERGED } from '../zhKeepMerged';
import { ZH_NEUTRAL_TONE } from '../zhNeutralTone';
import { tokenizeZhLine } from '../tokenizeZh';

/**
 * 계약: 두-실단어 되가름 ⑦ (분석기 라운드 8, 2026-09-02).
 *
 * jieba 사전은 구(句)를 단어처럼 실어 놓는다 — 看电视·天气预报·十分钟이 한 토큰으로 온다. 학습자에겐 看과 电视가
 * 어휘 항목이고, 공유 사전(morpheme_dictionary)에 「看电视」 표제어가 쌓이는 건 5b가 청소한 두 글자 쓰레기(两个·一份)의
 * 세 글자판이다. 규칙은 코퍼스 정답지 병음의 단어 띄어쓰기와 대조해 확정했다(zhCorpusSegment.test — 663:3).
 * 바꾸는 쪽과 두는 쪽을 한 쌍으로 못 박는다.
 */
const words = (line) => fixZhTagged(jiebaTag(line, true)).map((e) => e.word);
const tagOf = (line, w) => fixZhTagged(jiebaTag(line, true)).find((e) => e.word === w)?.tag;

describe('가르는 쪽 — 유일하게 두 실단어로 분해되는 비실단어 융합 토큰', () => {
  it('(a) 둘 다 ≥2자: 天气预报·解决问题·身体健康 — 실측 432건 불일치 0', () => {
    expect(words('天气预报说有雨。')).toEqual(expect.arrayContaining(['天气', '预报']));
    expect(words('我们要先解决问题。')).toEqual(expect.arrayContaining(['解决', '问题']));
    expect(words('祝你身体健康。')).toEqual(expect.arrayContaining(['身体', '健康']));
    expect(splitZhCompound('天气预报', 'n')).toEqual(['天气', '预报']);
  });

  it('(b) 1자 접두 + 단어: 看电视·好消息·十分钟·打篮球 — 경성 사전이 조각(消息 xiāo xi)에 다시 걸린다', () => {
    expect(words('我看电视看了一个小时。')).toEqual(expect.arrayContaining(['看', '电视']));
    expect(words('我休息了十分钟。')).toEqual(expect.arrayContaining(['十', '分钟']));
    expect(words('弟弟打篮球打得很好。')).toEqual(expect.arrayContaining(['打', '篮球']));
    const toks = tokenizeZhLine('听到这个好消息，大家都高兴。');
    expect(toks.map((t) => t.text)).toEqual(expect.arrayContaining(['好', '消息']));
    expect(toks.find((t) => t.text === '消息')?.furigana).toBe('xiāo xi'); // 라운드 7이 남긴 융합 토큰 공백 — 되가름이 닫는다
    expect(splitZhCompound('看电视', 'v')).toEqual(['看', '电视']);
  });

  it('(c) 단어 + 조사·방위 1자: 回家吧·操场上·角落里 — 명사 접미 1자(垃圾桶·科学家·咖啡店)는 파생 복합어라 그대로', () => {
    expect(words('我们一起回家吧。')).toEqual(expect.arrayContaining(['回家', '吧']));
    expect(words('他们在操场上打球。')).toEqual(expect.arrayContaining(['操场', '上']));
    expect(words('房间的角落里堆满了旧书。')).toEqual(expect.arrayContaining(['角落', '里']));
    for (const [line, w] of [['垃圾桶在门口。', '垃圾桶'], ['这位科学家很有名。', '科学家'], ['他周末在咖啡店打工。', '咖啡店'], ['请出示登机牌。', '登机牌']]) {
      expect(words(line), w).toContain(w);
    }
    expect(splitZhCompound('垃圾桶', 'n')).toBe(null);
  });

  it('조각의 태그는 jieba에게 다시 묻는다 — 看/v·电视/n·十/m·分钟/n, 손으로 찍지 않는다', () => {
    expect(tagOf('我看电视。', '看')).toMatch(/^v/);
    expect(tagOf('我看电视。', '电视')).toMatch(/^n/);
    expect(tagOf('我休息了十分钟。', '十')).toBe('m');
    expect(tagOf('我休息了十分钟。', '分钟')).toBe('q'); // jieba는 分钟을 양사로 단다 — 손으로 n을 찍었다면 여기가 오태그였다
  });
});

describe('두는 쪽 — 규칙의 정밀도는 여기서 난다', () => {
  it('모호한 분해는 유지: 火车站(火|车站·火车|站)·火车票·其他人·所有人 — 정답지도 붙여 쓴다', () => {
    for (const [line, w] of [['请问，火车站在哪儿？', '火车站'], ['火车票很难买。', '火车票'], ['其他人呢？', '其他人'], ['所有人都来了。', '所有人']]) {
      expect(words(line), w).toContain(w);
      expect(splitZhCompound(w, 'n'), w).toBe(null);
    }
  });

  it('실단어(HSK)·허용목록은 그대로: 大学生·小时候·老朋友·小孩子·照相机 — 경성 사전 표제어는 보호가 아니다(民间故事 → 民间|故事, 故事는 gù shi 유지)', () => {
    expect(words('他是大学生。')).toContain('大学生');
    expect(words('小时候我很喜欢吃糖。')).toContain('小时候');
    expect(words('他是我的老朋友。')).toContain('老朋友');     // HSK 방벽 — 경성 사전 표제어이기도 하지만 지키는 건 HSK다
    // 경성 사전(CEDICT 층)은 구(句)도 싣는 병음 사전이라 어휘 단위의 근거가 못 된다 — 정답지 4/4가 가른다(변이 실측)
    expect(ZH_NEUTRAL_TONE['民间故事']).toBeDefined();
    const toks = tokenizeZhLine('这是一个民间故事。');
    expect(toks.map((x) => x.text)).toEqual(expect.arrayContaining(['民间', '故事']));
    expect(toks.find((x) => x.text === '故事')?.furigana).toBe('gù shi');
    for (const w of ['小孩子', '照相机', '班主任', '日用品', '初学者', '发动机', '好容易']) {
      expect(ZH_KEEP_MERGED.has(w), w).toBe(true);
      expect(splitZhCompound(w, 'n'), w).toBe(null);
    }
    expect(words('这个道理连小孩子也明白。')).toContain('小孩子');
    expect(words('这台照相机很贵。')).toContain('照相机');
  });

  it('성어·고유명사 태그는 손대지 않는다: 一举两得/i·上海/ns·王小明/nr — 같은 글자라도 태그가 i면 유지(身体健康)', () => {
    expect(words('这是一举两得的办法。')).toContain('一举两得');
    expect(splitZhCompound('身体健康', 'i')).toBe(null);                // 태그 가드가 정밀도라는 핀
    expect(splitZhCompound('身体健康', 'l')).toEqual(['身体', '健康']);
    expect(words('我住在上海。')).toContain('上海');
    expect(splitZhCompound('王小明', 'nr')).toBe(null);
  });

  it('수사 머리 우선 — 十分钟(十|分钟·十分|钟 모호)·几年级은 수사+실단어로; 一·半은 머리에서 빠져 半路上·一共有는 모호 유지', () => {
    expect(splitZhCompound('十分钟', 'm')).toEqual(['十', '分钟']);
    expect(splitZhCompound('几年级', 'm')).toEqual(['几', '年级']);
    // 半路上 = 半路|上, 一共有 = 一共|有 — 半·一이 머리 집합에 있으면 半|路上·一|共有로 갈린다(변이 실측). 둘 다 HSK 밖.
    expect(splitZhCompound('半路上', 'n')).toBe(null);
    expect(splitZhCompound('一共有', 'v')).toBe(null);
    expect(splitZhCompound('一整天', 'm')).toEqual(['一', '整天']); // 유일 분해는 一 머리여도 갈린다 — 정답지 2/2
  });

  it('3자 가운데 不·得(가능보어·A不A)는 한 구조 — 行不行·吃不完·看得懂은 안 가르고, 문맥 층의 不 경성이 산다', () => {
    expect(splitZhCompound('行不行', 'v')).toBe(null);
    expect(splitZhCompound('吃不完', 'v')).toBe(null);
    expect(splitZhCompound('看得懂', 'v')).toBe(null);
    expect(tokenizeZhLine('这样行不行？').find((t) => t.text === '行不行')?.furigana).toBe('xíng bu xíng');
  });

  it('2자 이하·실단어·분해 불능은 무개입 — 규칙 함수가 null', () => {
    expect(splitZhCompound('电视', 'n')).toBe(null);          // 3자 미만
    expect(splitZhCompound('图书馆', 'n')).toBe(null);        // HSK 실단어
    expect(splitZhCompound('冰淇淋', 'n')).toBe(null);        // 冰|淇淋·冰淇|淋 — 어느 쪽도 두 실단어가 아니다
  });
});
