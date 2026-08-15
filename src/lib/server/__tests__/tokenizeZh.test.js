import { describe, expect, it } from 'vitest';
import { tokenizeZhLine } from '../tokenizeZh.js';

describe('중국어 토큰화', () => {
  it('단어 단위로 분할한다(글자 단위가 아니다)', () => {
    const tokens = tokenizeZhLine('我在北京大学读书。');
    const words = tokens.map((t) => t.text);
    expect(words).toContain('北京大学');   // 4글자 고유명사가 한 토큰
    expect(words).toContain('读书');
    expect(words).not.toContain('北');      // 글자 단위 분해가 아님
  });

  it('한자 토큰에 성조 병음을 단다(furigana 슬롯 — 영어 IPA와 같은 관례)', () => {
    const [first] = tokenizeZhLine('图书馆');
    expect(first.text).toBe('图书馆');
    expect(first.furigana).toBe('tú shū guǎn');
  });

  it('base_form은 표면형과 같다(중국어는 굴절이 없다)', () => {
    for (const t of tokenizeZhLine('他昨天买了三本书。')) {
      expect(t.base_form).toBe(t.text);
    }
  });

  it('문장부호는 기호로 표시하고 병음을 달지 않는다', () => {
    const tokens = tokenizeZhLine('好。');
    const punct = tokens.find((t) => t.text === '。');
    expect(punct?.pos).toBe('기호');
    expect(punct?.furigana).toBe('');
  });

  // jieba는 사전에 없는 한자 조합(HMM 병합 OOV)에 x 태그를 단다 — 기호로 오분류하면
  // 병음·품사가 통째로 사라진다(오너 보고: 这宗·这首·这片·这篇·笔在·项有 실측).
  it('x 태그라도 한자 조합이면 병음을 달고 기호로 처리하지 않는다', () => {
    const bi = tokenizeZhLine('笔在桌子上。').find((t) => t.text === '笔在');
    expect(bi?.pos).not.toBe('기호');
    expect(bi?.furigana).toBe('bǐ zài');
    const zong = tokenizeZhLine('这宗案子很复杂。').find((t) => t.text === '这宗');
    expect(zong?.pos).not.toBe('기호');
    expect(zong?.furigana).toBe('zhè zōng');
    const pian = tokenizeZhLine('这片森林。').find((t) => t.text === '这片');
    expect(pian?.furigana).toBe('zhè piàn');
  });

  it('품사 태그를 한국어로 옮긴다', () => {
    const tokens = tokenizeZhLine('我读书。');
    expect(tokens.find((t) => t.text === '我')?.pos).toBe('대명사');
  });

  it('빈 줄·공백은 빈 배열', () => {
    expect(tokenizeZhLine('')).toEqual([]);
    expect(tokenizeZhLine('   ')).toEqual([]);
  });
});

// 겸류(兼类) 후보: jieba는 사전 등재어에 문맥 불문 한 태그만 단다(工作은 我在工作에서도 vn).
// vn/vd/an/ad 겸류 태그는 pos_all 후보로 확장해 문맥 판별기(disambiguateZhPos)가 짚게 한다.
describe('겸류 품사 후보(pos_all)', () => {
  it('vn 태그 단어는 동사·명사 후보를 싣는다', () => {
    const t = tokenizeZhLine('我在工作。').find((x) => x.text === '工作');
    expect(t.pos_all).toBe('동사·명사');
  });

  it('단일 품사 단어에는 pos_all이 없다', () => {
    const t = tokenizeZhLine('我在工作。').find((x) => x.text === '我');
    expect(t.pos_all).toBeUndefined();
  });

  it('문장부호에는 pos_all이 없다', () => {
    const t = tokenizeZhLine('好。').find((x) => x.text === '。');
    expect(t.pos_all).toBeUndefined();
  });
});

// 문맥 병음(#1004): 줄 전체를 pinyin-pro에 넘겨 다음자·성조 변조를 문장 문맥으로 처리한다.
// (단어별 호출의 실측 오류: 不对→bù(변조 누락), 走了→liǎo(오독))
describe('문맥 병음 — 다음자·변조', () => {
  const pyOf = (line, word) => tokenizeZhLine(line).find((t) => t.text === word)?.furigana;

  it('성조 변조: 不对 → bú duì', () => {
    expect(pyOf('这个不对。', '不对') ?? pyOf('这个不对。', '不')).toMatch(/^bú/);
  });

  it('어기조사 了: 吃了 → le (liǎo 오독 금지)', () => {
    const toks = tokenizeZhLine('他吃了饭。');
    const withLe = toks.find((t) => t.text.includes('了'));
    expect(withLe.furigana).toContain('le');
    expect(withLe.furigana).not.toContain('liǎo');
  });

  it('还没 → hái 유지', () => {
    const toks = tokenizeZhLine('我还没吃饭。');
    expect(toks.find((t) => t.text === '还')?.furigana).toBe('hái');
  });

  it('공백 섞인 줄에서도 글자-병음 정렬이 어긋나지 않는다', () => {
    const toks = tokenizeZhLine('你好 世界。');
    expect(toks.find((t) => t.text === '你好')?.furigana).toBe('nǐ hǎo');
    expect(toks.find((t) => t.text === '世界')?.furigana).toBe('shì jiè');
  });
});
