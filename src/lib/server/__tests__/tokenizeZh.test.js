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

  it('base_form은 표면형과 같다(중국어 무굴절 — 유일 예외는 이합사 삽입형, zhSeparable.test)', () => {
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

  // jieba는 사전에 없는 한자 조합(HMM 병합 OOV)에 x 태그를 단다. 이 계약이 원래 지키려던
  // 요구는 「그걸 **기호로 오분류해 병음이 통째로 사라지면 안 된다**」였고, 그 요구는 지금도
  // 유효하다. 다만 당시 해법이 「x+한자를 실단어로 승격」이라 `笔在`·`这宗`이 **가짜 표제어**로
  // 살아남았고, 계약이 그 증상을 값으로 박제했다(v2-T가 되가름으로 뒤집었다).
  //
  // ⚠ 부정 단언(`not.toBe('기호')`)은 토큰이 사라지면 `undefined?.pos`가 되어 **공허 통과**한다.
  //    그래서 「없어졌다」가 아니라 **조각이 무엇인지**를 긍정으로 적는다.
  it('x+한자는 되갈리되, 조각마다 병음이 붙고 기호로 처리되지 않는다', () => {
    // 품사는 여기서 고정하지 않는다 — 조각 단위 태그는 jieba가 자주 틀리고(`宗` 단독은
    // 성씨 `nr`), 그 교정은 하류 문맥 판별기(disambiguateZhPos) 몫이다. 이 계약이 지키는
    // 것은 **경계와 병음**이다.
    const readOf = (line) => tokenizeZhLine(line).map((t) => [t.text, t.furigana]);

    expect(readOf('笔在桌子上。').slice(0, 2)).toEqual([['笔', 'bǐ'], ['在', 'zài']]);
    expect(readOf('这宗案子很复杂。').slice(0, 2)).toEqual([['这', 'zhè'], ['宗', 'zōng']]);
    expect(readOf('这片森林。').slice(0, 2)).toEqual([['这', 'zhè'], ['片', 'piàn']]);

    // 줄 병음 정렬 불변 — 토큰을 갈라도 음절 배분만 달라진다(병음은 줄 단위 계산).
    // 그리고 한자 토큰은 어느 것도 기호로 떨어지지 않는다(이 계약의 원래 요구).
    for (const t of tokenizeZhLine('笔在桌子上。')) {
      if (!/[一-鿿]/.test(t.text)) continue;
      expect(t.pos, `${t.text}이 기호로 떨어졌다`).not.toBe('기호');
      expect(t.furigana, `${t.text}에 병음이 비었다`).not.toBe('');
    }
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

  it('어휘 경성: 朋友·时候 — 知道는 라운드 7에서 원조로(정답지 33:0·CEDICT·pinyin-pro 전부 zhī dào)', () => {
    expect(pyOf('我朋友知道那个时候。', '朋友')).toBe('péng you');
    expect(pyOf('我朋友知道那个时候。', '知道')).toBe('zhī dào');
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
