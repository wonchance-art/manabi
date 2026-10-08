import { describe, expect, it } from 'vitest';
import {
  SENTENCE_LINE_BUDGET, clipSentenceToBudget, locateLineTokens, sentenceAroundTerm, sentenceAroundToken,
  sentenceCharWeight, splitSentenceRanges,
} from '../viewerSentenceLine';

/**
 * 계약: 단어창 문장 줄(VIEWER-V2-ROUNDS-001 §2.1 · AE-R1 설계서 §4·§7.3).
 * 「문장」 = 누른 토큰이 든 한 문장(。！？；… · 라틴 . ! ? ; + 공백), raw_text 줄 전체가 아니다.
 * 칠하는 곳 = 누른 자리 하나 — 같은 단어가 여러 번 나와도(지금 splitSentenceAroundWord는 전부 칠한다).
 * 3줄이 넘으면 단어 앞뒤만 남기고 양 끝 …(예산 CJK 60자 · 라틴 160자, 설계서 §10.2).
 */
const toks = (...texts) => texts.map((text) => ({ text }));
const weight = (s) => [...s].reduce((w, ch) => w + sentenceCharWeight(ch), 0);

describe('문장 단위 — 한 줄 두 문장에서 누른 토큰의 문장만', () => {
  const line = '我们明天去公园。她尽量别熬夜，要爱惜身体。';
  const tokens = toks('我们', '明天', '去', '公园', '。', '她', '尽量', '别', '熬夜', '，', '要', '爱惜', '身体', '。');
  it('둘째 문장 토큰 → 둘째 문장만, 쉼표는 경계가 아니다', () => {
    const r = sentenceAroundToken({ line, tokens, index: 8, language: 'Chinese' });
    expect(r.text).toBe('她尽量别熬夜，要爱惜身体。');
    expect([r.before, r.term, r.after]).toEqual(['她尽量别', '熬夜', '，要爱惜身体。']);
    expect(r.text.slice(r.start, r.end)).toBe('熬夜');
    expect(r.located).toBe(true);
  });
  it('첫 문장 토큰 → 첫 문장(마침표 포함)', () => {
    const r = sentenceAroundToken({ line, tokens, index: 3, language: 'Chinese' });
    expect(r.text).toBe('我们明天去公园。');
    expect(r.term).toBe('公园');
  });
  it('문장부호 토큰을 눌러도 그 문장(경계는 앞 문장에 붙는다)', () => {
    expect(sentenceAroundToken({ line, tokens, index: 4, language: 'Chinese' }).text).toBe('我们明天去公园。');
    expect(sentenceAroundToken({ line, tokens, index: 13, language: 'Chinese' }).text).toBe('她尽量别熬夜，要爱惜身体。');
  });
  it('！？；… 와 뒤따르는 닫는 따옴표까지 한 문장', () => {
    const quoted = '他说：“走吧！”然后走了……真的吗？';
    const t = toks('他', '说', '：', '“', '走', '吧', '！', '”', '然后', '走', '了', '……', '真的', '吗', '？');
    expect(sentenceAroundToken({ line: quoted, tokens: t, index: 4, language: 'Chinese' }).text).toBe('他说：“走吧！”');
    const second = sentenceAroundToken({ line: quoted, tokens: t, index: 9, language: 'Chinese' });
    expect(second.text).toBe('然后走了……');
    expect(second.start).toBe(2); // 같은 글자 走가 앞 문장에 있어도 누른 자리
    expect(sentenceAroundToken({ line: quoted, tokens: t, index: 12, language: 'Chinese' }).text).toBe('真的吗？');
    expect(splitSentenceRanges('甲；乙', { language: 'Chinese' })).toEqual([{ start: 0, end: 2 }, { start: 2, end: 3 }]);
  });
});

describe('누른 자리만 — 같은 단어 반복', () => {
  it('두 문장에 같은 단어 → 누른 문장의 누른 자리', () => {
    const line = '我喜欢猫。猫也喜欢我。';
    const tokens = toks('我', '喜欢', '猫', '。', '猫', '也', '喜欢', '我', '。');
    const a = sentenceAroundToken({ line, tokens, index: 4, language: 'Chinese' });
    expect([a.text, a.start, a.end]).toEqual(['猫也喜欢我。', 0, 1]);
    const b = sentenceAroundToken({ line, tokens, index: 7, language: 'Chinese' });
    expect([b.text, b.before, b.term, b.after]).toEqual(['猫也喜欢我。', '猫也喜欢', '我', '。']);
  });
  it('한 문장 안 같은 단어 두 번 → 둘째를 누르면 둘째만', () => {
    const line = '看了又看。';
    const tokens = toks('看', '了', '又', '看', '。');
    const first = sentenceAroundToken({ line, tokens, index: 0, language: 'Chinese' });
    const second = sentenceAroundToken({ line, tokens, index: 3, language: 'Chinese' });
    expect([first.before, first.term, first.after]).toEqual(['', '看', '了又看。']);
    expect([second.before, second.term, second.after]).toEqual(['看了又', '看', '。']);
  });
  it('문자열 검색(첫 일치)이 아니라 토큰 순서로 찾는다 — 앞 토큰 안에 같은 글자가 있어도', () => {
    // 体育场 안의 场 vs 뒤의 场: 커서가 앞 토큰 끝으로 옮겨 가므로 뒤의 场을 잡는다.
    const line = '体育场有场比赛。';
    const tokens = toks('体育场', '有', '场', '比赛', '。');
    const r = sentenceAroundToken({ line, tokens, index: 2, language: 'Chinese' });
    expect(r.start).toBe(4);
    expect(locateLineTokens(line, tokens).map((p) => p && p.start)).toEqual([0, 3, 4, 5, 7]);
  });
});

describe('경계 사례', () => {
  it('구두점 없는 줄 = 줄 전체', () => {
    const r = sentenceAroundToken({ line: '今天天气很好', tokens: toks('今天', '天气', '很', '好'), index: 1, language: 'Chinese' });
    expect(r.text).toBe('今天天气很好');
    expect([r.before, r.term, r.after]).toEqual(['今天', '天气', '很好']);
  });
  it('줄 끝 토큰(마지막 문장에 끝 부호가 없을 때) = 마지막 조각', () => {
    const r = sentenceAroundToken({ line: '我们走吧。明天见', tokens: toks('我们', '走', '吧', '。', '明天', '见'), index: 5, language: 'Chinese' });
    expect(r.text).toBe('明天见');
    expect([r.before, r.term, r.after]).toEqual(['明天', '见', '']);
  });
  it('토큰 일부가 원문에서 안 보여도(공백 정규화·누락) 나머지 위치는 흔들리지 않는다', () => {
    const line = '我 们 去公园。';
    const tokens = toks('我们', '去', '公园', '。'); // 我们은 원문에 붙어 있지 않다
    const r = sentenceAroundToken({ line, tokens, index: 2, language: 'Chinese' });
    expect(r.located).toBe(true);
    expect(r.term).toBe('公园');
    expect(r.text).toBe(line);
  });
  it('누른 토큰을 못 찾으면 첫 일치로 내려가고(located=false), 그것도 없으면 칠하지 않는다', () => {
    const fallback = sentenceAroundToken({ line: '猫。我 们。', tokens: toks('猫', '。', '我们', '。'), index: 2, language: 'Chinese', term: '我' });
    expect(fallback.located).toBe(false);
    expect([fallback.text, fallback.term]).toEqual(['我 们。', '我']);
    const none = sentenceAroundToken({ line: '猫。', tokens: toks('狗'), index: 0, language: 'Chinese' });
    expect([none.term, none.start, none.located]).toEqual(['', -1, false]);
    expect(sentenceAroundToken({ line: '', tokens: [], index: 0 })).toBeNull();
  });
  it('무id 리스트 단어 = 카드 문맥의 첫 일치만', () => {
    const r = sentenceAroundTerm({ line: '猫来了。猫走了。', term: '猫', language: 'Chinese' });
    expect([r.text, r.start]).toEqual(['猫来了。', 0]);
  });
  it('일본어는 CJK 부호만 경계 — 숫자 사이 . 는 자르지 않는다', () => {
    const line = '3.5キロ歩いた。次は電車だ。';
    const tokens = toks('3.5', 'キロ', '歩い', 'た', '。', '次', 'は', '電車', 'だ', '。');
    expect(sentenceAroundToken({ line, tokens, index: 2, language: 'Japanese' }).text).toBe('3.5キロ歩いた。');
    expect(sentenceAroundToken({ line, tokens, index: 7, language: 'Japanese' }).text).toBe('次は電車だ。');
  });
});

describe('라틴 문장 — . ! ? ; 뒤 공백, 흔한 약어는 경계가 아니다', () => {
  const line = 'Mr. Smith arrived early. He sat down! Did she, e.g. the teacher, come? Yes; she did.';
  const tokens = toks('Mr', '.', 'Smith', 'arrived', 'early', '.', 'He', 'sat', 'down', '!', 'Did', 'she', ',', 'e.g', '.', 'the', 'teacher', ',', 'come', '?', 'Yes', ';', 'she', 'did', '.');
  const at = (i) => sentenceAroundToken({ line, tokens, index: i, language: 'English' });
  it('Mr. 는 문장을 자르지 않는다', () => expect(at(2).text).toBe('Mr. Smith arrived early.'));
  it('! 뒤 공백에서 자르고 앞 공백은 문장에 넣지 않는다', () => expect(at(7).text).toBe('He sat down!'));
  it('e.g. 는 문장 안, ? 에서 끝', () => expect(at(16).text).toBe('Did she, e.g. the teacher, come?'));
  it('; 도 경계(정본 。！？；와 같은 줄)', () => {
    expect(at(20).text).toBe('Yes;');
    const r = at(22);
    expect(r.text).toBe('she did.');
    expect(r.start).toBe(0); // 같은 she가 앞 문장에도 있다 — 누른 자리
  });
  it('공백 없는 점(3.14, a.m)은 경계가 아니다', () => {
    expect(sentenceAroundTerm({ line: 'Pi is 3.14 today. Next.', term: 'Pi', language: 'English' }).text).toBe('Pi is 3.14 today.');
  });
  it('한국어 자료도 라틴 부호 경계를 쓴다', () => {
    const r = sentenceAroundTerm({ line: '안녕하세요. 반갑습니다.', term: '반갑습니다', language: 'Korean' });
    expect(r.text).toBe('반갑습니다.');
  });
});

describe('3줄 예산 줄임 — CJK 60자 · 라틴 160자, 단어 보존, 양 끝 …', () => {
  it('예산 안이면 그대로', () => {
    const r = clipSentenceToBudget({ before: '她尽量别', term: '熬夜', after: '，要爱惜身体。' });
    expect(r).toEqual({ before: '她尽量别', term: '熬夜', after: '，要爱惜身体。', clippedStart: false, clippedEnd: false });
  });
  it('예산 상수 = 전각 60자, 반각은 0.375자(=160자)', () => {
    expect(SENTENCE_LINE_BUDGET).toBe(60);
    expect(weight('一'.repeat(60))).toBe(60);
    expect(weight('a'.repeat(160))).toBeCloseTo(60, 6);
    expect(clipSentenceToBudget({ before: '一'.repeat(30), term: '二', after: '三'.repeat(29) }).clippedEnd).toBe(false);
    expect(clipSentenceToBudget({ before: '一'.repeat(30), term: '二', after: '三'.repeat(30) }).clippedEnd).toBe(true);
  });
  it('긴 CJK 문장 가운데 단어 → 앞뒤 … · 단어 그대로 · 예산 이하 · 단어에 붙은 글자부터 남긴다', () => {
    const before = '甲乙丙丁戊己庚辛壬癸'.repeat(5), after = '子丑寅卯辰巳午未申酉'.repeat(5);
    const r = clipSentenceToBudget({ before, term: '壮观', after });
    expect(r.term).toBe('壮观');
    expect(r.before.startsWith('…') && r.after.endsWith('…')).toBe(true);
    expect(before.endsWith(r.before.slice(1))).toBe(true);
    expect(after.startsWith(r.after.slice(0, -1))).toBe(true);
    expect(weight(r.before + r.term + r.after)).toBeLessThanOrEqual(60);
    expect(Math.abs([...r.before].length - [...r.after].length)).toBeLessThanOrEqual(1);
  });
  it('단어가 문장 앞쪽이면 앞은 그대로, 남는 몫은 뒤에', () => {
    const r = clipSentenceToBudget({ before: '我', term: '喜欢', after: '看'.repeat(100) });
    expect(r.clippedStart).toBe(false);
    expect(r.before).toBe('我');
    expect(r.clippedEnd).toBe(true);
    expect(weight(r.before + r.term + r.after)).toBeLessThanOrEqual(60);
    expect(weight(r.after)).toBeGreaterThan(50);
  });
  it('라틴은 단어 중간에서 자르지 않는다', () => {
    const words = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa';
    const r = clipSentenceToBudget({ before: `${words} `, term: 'stadium', after: ` ${words}.` });
    expect(r.clippedStart && r.clippedEnd).toBe(true);
    expect(weight(r.before + r.term + r.after)).toBeLessThanOrEqual(60);
    const headWords = r.before.slice(1).trim().split(' ');
    const tailWords = r.after.slice(0, -1).trim().split(' ');
    for (const w of [...headWords, ...tailWords]) expect(words.split(' ')).toContain(w);
  });
  it('단어 자체가 예산보다 길어도 단어는 자르지 않는다', () => {
    const long = '长'.repeat(70);
    const r = clipSentenceToBudget({ before: '前面', term: long, after: '后面' });
    expect(r.term).toBe(long);
    expect([r.before, r.after]).toEqual(['…', '…']);
  });
  it('줄임은 sentenceAroundToken 결과를 그대로 받는다', () => {
    const line = `${'很长的句子'.repeat(15)}壮观${'后面还有'.repeat(15)}。`;
    const r = sentenceAroundToken({ line, tokens: [{ text: '很长的句子'.repeat(15) }, { text: '壮观' }], index: 1, language: 'Chinese' });
    const clipped = clipSentenceToBudget(r);
    expect(clipped.term).toBe('壮观');
    expect(clipped.after.endsWith('…')).toBe(true);
  });
});
