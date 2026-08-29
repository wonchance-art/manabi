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

// 필독 경성(轻声) 오버라이드(zhNeutralTone.js) — pinyin-pro가 원조로 내는 어휘를
// 토큰 단위로 교정한다(오너 실측 보고: 怪不得 → guài bù dé). customPinyin 전역 등록은
// 문자열 매칭이 단어 경계를 무시해(这本|事先에 本事 매칭, 东西南北 오염 실측) 쓰지 않는다.
describe('필독 경성 오버라이드', () => {
  const pyOf = (line, word) => tokenizeZhLine(line).find((t) => t.text === word)?.furigana;

  it('怪不得 → guài bu de (不·得 경성)', () => {
    expect(pyOf('怪不得你不知道这件事情。', '怪不得')).toBe('guài bu de');
  });

  it('어휘 경성: 朋友·时候·知道', () => {
    expect(pyOf('我朋友知道那个时候。', '朋友')).toBe('péng you');
    expect(pyOf('我朋友知道那个时候。', '知道')).toBe('zhī dao');
    expect(pyOf('我朋友知道那个时候。', '时候')).toBe('shí hou');
  });

  it('가능보어 V不C: 对不起·来不及', () => {
    expect(pyOf('对不起，来不及了。', '对不起')).toBe('duì bu qǐ');
    expect(pyOf('对不起，来不及了。', '来不及')).toBe('lái bu jí');
  });

  it('사전 밖 줄 병음은 그대로 — 성조 변조(不对→bú) 불변', () => {
    expect(pyOf('这个不对。', '不对') ?? pyOf('这个不对。', '不')).toMatch(/^bú/);
  });

  it('성어는 원조 유지 — 사전 미등재라 오버라이드 비적용', () => {
    expect(pyOf('他迫不得已才这样做。', '迫不得已')).toBe('pò bù dé yǐ');
  });

  it('토큰 정확 일치만 적용 — 东西南北(단일 토큰)는 오염되지 않는다', () => {
    // 东西(물건)는 dōng xi로 교정하되, 东西南北는 jieba가 한 토큰으로 잘라 사전 키와
    // 불일치 → 줄 병음(dōng xī …) 유지. customPinyin였다면 여기가 오염됐다(실측).
    expect(pyOf('我买了很多东西。', '东西')).toBe('dōng xi');
    expect(pyOf('东西南北都逛了。', '东西南北')).toBe('dōng xī nán běi');
  });

  it('오버라이드 뒤 토큰의 정렬이 어긋나지 않는다', () => {
    const toks = tokenizeZhLine('我朋友买了饺子和葡萄。');
    expect(toks.find((t) => t.text === '饺子')?.furigana).toBe('jiǎo zi');
    expect(toks.find((t) => t.text === '葡萄')?.furigana).toBe('pú tao');
    // 사전 밖 후속 토큰도 줄 병음 정렬 유지
    expect(toks.find((t) => t.text === '和')?.furigana).toBe('hé');
  });
});

// 병음 경계 오독 수리(zhPinyinFix.js) — pinyin-pro의 탐욕 매칭이 jieba 토큰 경계를 넘어
// 다른 단어를 붙잡는 실측 오독의 토큰 오버라이드(실문장 스모크 2026-08-29 발견).
describe('병음 경계 오독 오버라이드', () => {
  const pyOf = (line, word) => tokenizeZhLine(line).find((t) => t.text === word)?.furigana;

  it('人|参加 경계: 三十人参加了 → 参加 = cān jiā (人参 rén shēn 매칭 수리)', () => {
    expect(pyOf('三十人参加了活动。', '参加')).toBe('cān jiā');
  });

  it('실단어 人参은 불변 — 토큰 정확 일치만 적용', () => {
    expect(pyOf('我买了人参。', '人参')).toBe('rén shēn');
  });

  it('오독 문맥 밖 参加도 같은 값(무맥락 정답 독음이라 항상 안전)', () => {
    expect(pyOf('我参加了比赛。', '参加')).toBe('cān jiā');
  });
});
