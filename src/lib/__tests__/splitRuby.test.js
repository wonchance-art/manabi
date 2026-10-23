import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { KURU_STEM, baseFormReading, kuruNextTexts, splitRuby } from '../splitRuby.js';
import { sliceBetween } from './helpers/sliceBetween';

// 계약: 중국어/일본어 판별 — 이 표식(pinyin)이 격자 조판(1em 고정·0.26em 단일 크기)·
// Noto Sans·성조색의 스위치다. 오분류는 곧 "병음이 크게 나온다"류의 시각 회귀다.
describe('splitRuby — 중국어 병음 분류', () => {
  it('한 글자 단어도 병음이다 — 공백이 없다고 일본어로 흘리면 요미 크기(0.5em)로 커진다(오너 발견)', () => {
    expect(splitRuby('我', 'wǒ')).toEqual([{ kanji: '我', reading: 'wǒ', pinyin: true }]);
    expect(splitRuby('去', 'qù')).toEqual([{ kanji: '去', reading: 'qù', pinyin: true }]);
  });

  it('여러 글자는 공백 구분 음절을 글자별로 분배한다', () => {
    expect(splitRuby('图书馆', 'tú shū guǎn')).toEqual([
      { kanji: '图', reading: 'tú', pinyin: true },
      { kanji: '书', reading: 'shū', pinyin: true },
      { kanji: '馆', reading: 'guǎn', pinyin: true },
    ]);
  });

  it('성조 부호만 있는 음절(ǹg 같은 감탄사)도 라틴 스크립트로 판별한다', () => {
    expect(splitRuby('嗯', 'ǹg')[0].pinyin).toBe(true);
    expect(splitRuby('嗯', 'ǹ')[0].pinyin).toBe(true);
  });

  it('음절 수와 글자 수가 어긋나면 병음 격자를 포기한다(전체 독음 통짜 폴백)', () => {
    const segs = splitRuby('图书馆', 'túshūguǎn');
    expect(segs[0].pinyin).toBeUndefined();
    expect(segs[0].reading).toBe('túshūguǎn');
  });
});

describe('splitRuby — 일본어 요미가나 분류(무영향 확인)', () => {
  it('가나 독음은 병음 표식을 받지 않는다', () => {
    expect(splitRuby('私', 'わたし')).toEqual([{ kanji: '私', reading: 'わたし' }]);
  });

  it('오쿠리가나 앵커 분해는 그대로다', () => {
    expect(splitRuby('取りまとめ', 'とりまとめ')).toEqual([
      { kanji: '取', reading: 'と' },
      { plain: 'りまとめ' },
    ]);
  });

  it('독음이 없으면 plain', () => {
    expect(splitRuby('東京', null)).toEqual([{ plain: '東京' }]);
  });
});

// 분석기는 활용형 토큰에도 기본형 읽기를 준다(운영 자료 47 · 49 실측: 違い + ちがう, 待っ + まつ).
// 기본형이 없으면 독음 전체가 한자 위에 얹혀 「違[ちがう]い」로 보였다 — 기본형으로 한자 읽기를 구해 옮긴다(VIEWER-LANG-AUDIT).
describe('splitRuby — 활용형은 기본형 읽기에서 한자 읽기만 옮긴다', () => {
  it('違い(違う · ちがう) → 違[ちが]い, 待っ(待つ · まつ) → 待[ま]っ', () => {
    expect(splitRuby('違い', 'ちがう', '違う')).toEqual([{ kanji: '違', reading: 'ちが' }, { plain: 'い' }]);
    expect(splitRuby('待っ', 'まつ', '待つ')).toEqual([{ kanji: '待', reading: 'ま' }, { plain: 'っ' }]);
    expect(splitRuby('新しかっ', 'あたらしい', '新しい')).toEqual([{ kanji: '新', reading: 'あたら' }, { plain: 'しかっ' }]);
  });
  it('来る는 뒤 가나로 읽기를 고른다(来 · くる)', () => {
    expect(splitRuby('来', 'くる', '来る')).toEqual([{ kanji: '来', reading: 'き' }]); // 来 | た · 来 | ます(가장 흔함)
    expect(splitRuby('来な', 'くる', '来る')[0].reading).toBe('こ');
    expect(splitRuby('来ま', 'くる', '来る')[0].reading).toBe('き');
    expect(splitRuby('来れ', 'くる', '来る')[0].reading).toBe('く');
    expect(splitRuby('見', 'みる', '見る')).toEqual([{ kanji: '見', reading: 'み' }]);
  });
  it('표면 앵커가 맞으면(기본형 = 표면) 지금과 같고, 기본형이 없거나 한자가 다르면 옛 폴백 그대로', () => {
    expect(splitRuby('休み', 'やすみ', '休み')).toEqual([{ kanji: '休', reading: 'やす' }, { plain: 'み' }]);
    expect(splitRuby('違い', 'ちがう')).toEqual([{ kanji: '違', reading: 'ちがう' }, { plain: 'い' }]);
    expect(splitRuby('行っ', 'いく', '往く')).toEqual([{ kanji: '行', reading: 'いく' }, { plain: 'っ' }]);
  });
  it('중국어 병음은 기본형을 받아도 그대로다', () => {
    expect(splitRuby('图书馆', 'tú shū guǎn', '图书馆')[0]).toEqual({ kanji: '图', reading: 'tú', pinyin: true });
  });
});

describe('splitRuby — 독음이 표면 읽기면 표면 앵커가 이긴다(기본형으로 바꾸지 않는다)', () => {
  it('食べ + たべ(표면) + 食べる → 食[た]べ', () => {
    expect(splitRuby('食べ', 'たべ', '食べる')).toEqual([{ kanji: '食', reading: 'た' }, { plain: 'べ' }]);
    expect(splitRuby('食べ', 'たべる', '食べる')).toEqual([{ kanji: '食', reading: 'た' }, { plain: 'べ' }]);
    expect(splitRuby('来', 'き', '来る')).toEqual([{ kanji: '来', reading: 'き' }]);
  });
  it('기존 앵커 분해는 그대로다(引っ張る · 思い出す · 今日)', () => {
    expect(splitRuby('引っ張る', 'ひっぱる')).toEqual([{ kanji: '引', reading: 'ひ' }, { plain: 'っ' }, { kanji: '張', reading: 'ぱ' }, { plain: 'る' }]);
    expect(splitRuby('思い出す', 'おもいだす')).toEqual([{ kanji: '思', reading: 'おも' }, { plain: 'い' }, { kanji: '出', reading: 'だ' }, { plain: 'す' }]);
    expect(splitRuby('今日', 'きょう')).toEqual([{ kanji: '今日', reading: 'きょう' }]);
  });
});

describe('본문 · 카드 · 미리보기 · 빠른 읽기가 기본형을 넘긴다(VIEWER-LANG-AUDIT)', () => {
  const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  it('토큰 독음 분해 자리마다 base_form을 함께 준다', () => {
    // 본문 낱말은 ReaderToken(memo, VIEWER-TAP-PERF-001)이 나누고, 바로 뒤 토큰 표기는 뷰어가 자료마다 한 번 만든 표(kuruNext)에서 원시값으로 준다.
    expect(read('src/components/viewer/ReaderToken.jsx')).toContain('splitRuby(token.text, pinyinPerChar(token.text, token.furigana) ?? token.furigana, token.base_form, nextText)');
    expect(read('src/views/ViewerPage.jsx')).toContain("nextText={token.furigana ? kuruNext.get(tokenId) : ''}");
    expect(read('src/views/ViewerPage.jsx')).toContain('splitRuby(headText, headReading, headIsBase ? undefined : selectedToken?.base_form)');
    expect(read('src/views/QuickPage.jsx')).toContain('splitRuby(token.text, token.furigana, token.base_form, line?.[i + 1]?.text)');
    expect(read('src/components/viewer/ViewerPreview.jsx')).toContain('splitRuby(token.text,token.furigana,token.base_form,shown[i+1]?.text)');
  });
});

// 실제 분석 출력(analyzeLines + 운영 사전 캐시 읽기 — 2026-10-17 KST): 彼は来ない。 → 来 | ない, 来의 독음 = くる(캐시 기본형 읽기).
describe('splitRuby — 来 | ない처럼 어미가 다음 토큰이면 다음 토큰 글자로 읽기를 고른다', () => {
  it('来 + くる + 来る + 다음 ない → こ, ます → き, た → き, れば → く, 모르면 き', () => {
    expect(splitRuby('来', 'くる', '来る', 'ない')).toEqual([{ kanji: '来', reading: 'こ' }]);
    expect(splitRuby('来', 'くる', '来る', 'ます')).toEqual([{ kanji: '来', reading: 'き' }]);
    expect(splitRuby('来', 'くる', '来る', 'た')).toEqual([{ kanji: '来', reading: 'き' }]);
    expect(splitRuby('来', 'くる', '来る', 'れば')).toEqual([{ kanji: '来', reading: 'く' }]);
    expect(splitRuby('来', 'くる', '来る')).toEqual([{ kanji: '来', reading: 'き' }]);
  });
  it('토큰 안 어미가 다음 토큰보다 먼저다 · 캐시가 없어 표면 읽기(こ)가 오면 그대로', () => {
    expect(splitRuby('来な', 'くる', '来る', 'ます')[0].reading).toBe('こ');
    expect(splitRuby('来', 'こ', '来る', 'ない')).toEqual([{ kanji: '来', reading: 'こ' }]);
  });
  it('카타카나 독음은 앵커가 맞지 않아 옛 폴백(전체 독음)으로 — 깨지지 않는다', () => {
    expect(splitRuby('違い', 'チガウ', '違う')).toEqual([{ kanji: '違', reading: 'チガウ' }, { plain: 'い' }]);
    expect(splitRuby('来', 'クル', '来る', 'ない')).toEqual([{ kanji: '来', reading: 'クル' }]);
  });
});

// 来い · 来れる(가능) · 来ず는 こ, 来れば는 く(a775 리뷰 2026-10-17 KST). 来 뒤 가나 = 토큰 안 어미 + 다음 토큰.
describe('splitRuby — 来의 명령 · 가능 · 부정 문어', () => {
  it('来い → こ · 来れ | ない → こ · 来 | れる → こ · 来ず → こ · 来れ | ば → く · 来れ(뒤 모름) → く', () => {
    expect(splitRuby('来い', 'くる', '来る')[0].reading).toBe('こ');
    expect(splitRuby('来れ', 'くる', '来る', 'ない')[0].reading).toBe('こ');
    expect(splitRuby('来', 'くる', '来る', 'れる')[0].reading).toBe('こ');
    expect(splitRuby('来ず', 'くる', '来る')[0].reading).toBe('こ');
    expect(splitRuby('来れ', 'くる', '来る', 'ば')[0].reading).toBe('く');
    expect(splitRuby('来', 'くる', '来る', 'れば')[0].reading).toBe('く');
    expect(splitRuby('来れ', 'くる', '来る')[0].reading).toBe('く');
  });
  it('KURU_STEM 표', () => {
    for (const [tail, r] of [['ない', 'こ'], ['よう', 'こ'], ['させ', 'こ'], ['られ', 'こ'], ['い', 'こ'], ['ず', 'こ'], ['ぬ', 'こ'], ['れる', 'こ'], ['れない', 'こ'],
      ['れば', 'く'], ['る', 'く'], ['れ', 'く'], ['ます', 'き'], ['た', 'き'], ['て', 'き'], ['', 'き']]) expect(KURU_STEM(tail), tail).toBe(r);
  });
});

// 오쿠리가나 표기 관행이 다른 기본형(終っ ↔ 終わる · 行なっ ↔ 行う)은 활용이 아니다 — 기본형 이동을 쓰지 않고 옛 폴백 그대로(a775 리뷰).
describe('splitRuby — 활용 범위 밖의 오쿠리가나 차이는 기본형 이동을 쓰지 않는다(BASEFORM-OKURI-001)', () => {
  it('막는 경우: 終っ/終わる · 行なっ/行う · 終わっ/終る · 打ち合せ/打ち合わせる', () => {
    expect(splitRuby('終っ', 'おわる', '終わる')).toEqual([{ kanji: '終', reading: 'おわる' }, { plain: 'っ' }]);
    expect(splitRuby('行なっ', 'おこなう', '行う')).toEqual([{ kanji: '行', reading: 'おこなう' }, { plain: 'なっ' }]);
    expect(splitRuby('終わっ', 'おわる', '終る')).toEqual([{ kanji: '終', reading: 'おわる' }, { plain: 'わっ' }]);
    expect(splitRuby('打ち合せ', 'うちあわせる', '打ち合わせる')[0].reading).not.toBe('う');
  });
  it('기존 통과 사례는 그대로(5단 · 1단 · する · 형용사 · 한자 둘 · 숙자훈 · 出来)', () => {
    const cases = [
      ['違い', 'ちがう', '違う', 'ちが'], ['待っ', 'まつ', '待つ', 'ま'], ['行っ', 'いく', '行く', 'い'], ['書い', 'かく', '書く', 'か'],
      ['読ん', 'よむ', '読む', 'よ'], ['帰っ', 'かえる', '帰る', 'かえ'], ['泳い', 'およぐ', '泳ぐ', 'およ'], ['話し', 'はなす', '話す', 'はな'],
      ['死ん', 'しぬ', '死ぬ', 'し'], ['遊ん', 'あそぶ', '遊ぶ', 'あそ'], ['違わ', 'ちがう', '違う', 'ちが'], ['食べ', 'たべる', '食べる', 'た'],
      ['見', 'みる', '見る', 'み'], ['勉強し', 'べんきょうする', '勉強する', 'べんきょう'], ['新しかっ', 'あたらしい', '新しい', 'あたら'],
      ['大人しく', 'おとなしい', '大人しい', 'おとな'], ['高く', 'たかい', '高い', 'たか'], ['出来', 'できる', '出来る', 'でき'],
      // 1단 의지형은 분석기가 食べよ|う로 쪼갠다 — る행 허용 글자에 よ가 없으면 食[たべる]べよ로 퇴행했다(리뷰 2026-10-17 KST).
      ['食べよ', 'たべる', '食べる', 'た'], ['見よ', 'みる', '見る', 'み'], ['起きよ', 'おきる', '起きる', 'お'], ['考えよ', 'かんがえる', '考える', 'かんが'],
    ];
    for (const [text, furigana, base, reading] of cases) expect(splitRuby(text, furigana, base)[0].reading, text).toBe(reading);
    expect(splitRuby('引き出し', 'ひきだす', '引き出す')).toEqual([{ kanji: '引', reading: 'ひ' }, { plain: 'き' }, { kanji: '出', reading: 'だ' }, { plain: 'し' }]);
  });
});

describe('kuruNextTexts — 来가 든 토큰만, 같은 줄의 바로 뒤 토큰(ViewerPage가 자료마다 한 번 만든다)', () => {
  it('来 토큰만 담고, 줄 끝 · 다른 줄이면 빈 글', () => {
    const sequence = ['id_0_0', 'id_0_1', 'id_0_2', 'id_1_0', 'id_1_1'];
    const dictionary = { id_0_0: { text: '彼' }, id_0_1: { text: '来' }, id_0_2: { text: 'ない' }, id_1_0: { text: '来' }, id_1_1: { text: '来れ' } };
    expect([...kuruNextTexts(sequence, dictionary)]).toEqual([['id_0_1', 'ない'], ['id_1_0', '来れ'], ['id_1_1', '']]);
    expect(kuruNextTexts(['id_0_0', 'id_1_0'], { id_0_0: { text: '来' }, id_1_0: { text: 'ない' } }).get('id_0_0')).toBe('');
    expect(kuruNextTexts().size).toBe(0);
  });
  it('ViewerPage는 useMemo로 자료마다 한 번 만들고 렌더에서는 표만 본다', () => {
    const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(viewer).toContain('const kuruNext = useMemo(() => kuruNextTexts(material?.processed_json?.sequence, material?.processed_json?.dictionary), [material?.processed_json]);');
    expect(viewer).not.toMatch(/new Map\(json\.sequence\.map/);
    expect(viewer).not.toContain('nextTokenText(');
    // 훅은 이른 반환보다 앞(훅 순서 고정)
    expect(viewer.indexOf('const kuruNext = useMemo(')).toBeLessThan(viewer.indexOf("if (isLoading) return <div className=\"page-container\">"));
  });
});

// 로그아웃 카드 — 사전 행(RLS = 로그인만)이 없어 활용형의 기본형 표제어(違う)가 읽기 없이 섰다(viewer-lang-4 2번 채택, 2026-10-17 KST).
// 토큰 독음이 기본형 읽기일 때만, 본문 루비와 같은 판정(fromBaseForm · BASEFORM-OKURI-001)으로 표제어 읽기를 돌려준다.
describe('baseFormReading — 로그아웃 기본형 표제어 읽기(GUEST-HEAD-READING-001)', () => {
  it('기본형 읽기 독음이면 그 독음 — 표제어 루비는 기본형 앵커로 나뉜다', () => {
    const cases = [
      ['違い', 'ちがう', '違う', 'ちが'], ['待っ', 'まつ', '待つ', 'ま'], ['書い', 'かく', '書く', 'か'], ['食べ', 'たべる', '食べる', 'た'],
      ['勉強し', 'べんきょうする', '勉強する', 'べんきょう'], ['新しかっ', 'あたらしい', '新しい', 'あたら'], ['食べよ', 'たべる', '食べる', 'た'],
      ['来', 'くる', '来る', 'く'], ['見', 'みる', '見る', 'み'],
    ];
    for (const [text, furigana, base, kanjiReading] of cases) {
      expect(baseFormReading(text, furigana, base), text).toBe(furigana);
      expect(splitRuby(base, baseFormReading(text, furigana, base))[0], text).toEqual({ kanji: base.match(/^[^ぁ-ん]+/)[0], reading: kanjiReading });
    }
    expect(splitRuby('引き出す', baseFormReading('引き出し', 'ひきだす', '引き出す'))).toEqual([{ kanji: '引', reading: 'ひ' }, { plain: 'き' }, { kanji: '出', reading: 'だ' }, { plain: 'す' }]);
  });
  it('null(읽기 없이 둔다): 표면 읽기 · 가드(BASEFORM-OKURI-001) · 한자 구간 불일치 · 병음 · 같은 표기 · 빈 값', () => {
    expect(baseFormReading('食べ', 'たべ', '食べる')).toBeNull();     // 사전 캐시 없이 kuromoji 표면 읽기
    expect(baseFormReading('待っ', 'まっ', '待つ')).toBeNull();
    expect(baseFormReading('終っ', 'おわる', '終わる')).toBeNull();   // 오쿠리가나 관행 차이 — 본문 루비도 이동하지 않는다
    expect(baseFormReading('行なっ', 'おこなう', '行う')).toBeNull();
    expect(baseFormReading('終わっ', 'おわる', '終る')).toBeNull();
    expect(baseFormReading('打ち合せ', 'うちあわせる', '打ち合わせる')).toBeNull();
    expect(baseFormReading('道', 'dào', '道歉')).toBeNull();          // 이합사 조각(병음) — 일본어 판정 밖
    expect(baseFormReading('違う', 'ちがう', '違う')).toBeNull();
    expect(baseFormReading('し', 'する', 'する')).toBeNull();
    expect(baseFormReading('違い', null, '違う')).toBeNull();
    expect(baseFormReading('違い', 'ちがう', undefined)).toBeNull();
  });
  it('본문 루비와 같은 판정 — 이 값이 있으면 splitRuby도 기본형 이동을 쓰고, null이면 쓰지 않는다', () => {
    const pairs = [['違い', 'ちがう', '違う'], ['終っ', 'おわる', '終わる'], ['食べ', 'たべ', '食べる'], ['行なっ', 'おこなう', '行う'], ['待っ', 'まつ', '待つ']];
    for (const [text, furigana, base] of pairs) {
      const moved = splitRuby(text, furigana, base)[0].reading !== splitRuby(text, furigana)[0].reading;
      expect(baseFormReading(text, furigana, base) !== null, text).toBe(moved);
    }
  });
  it('규칙은 한 벌 — fromBaseForm을 부르고, ViewerPage는 로그아웃(인증 확정)일 때만 사전 읽기 다음 자리로 쓴다', () => {
    const lib = fs.readFileSync(path.join(process.cwd(), 'src/lib/splitRuby.js'), 'utf8');
    const fn = sliceBetween(lib, 'export function baseFormReading(', '\n}\n');
    expect(fn).toContain('fromBaseForm(segments, furigana, baseForm)');
    expect(fn).not.toMatch(/CONJUGABLE|anchorSplit|RegExp/);
    const viewer = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(viewer).toContain('const guestHeadReading = headIsBase && !user && !authLoading ? baseFormReading(selectedToken.text, selectedToken.furigana, headText) : null;');
    expect(viewer).toContain('const headReading = headIsBase ? (editDictEntry?.reading || guestHeadReading || null) : selectedToken?.furigana;');
    expect(viewer).toContain('const headFallback = headIsBase && dictFetched && !editDictEntry?.reading;'); // 「기본형」 라벨은 목업대로 유지
    expect(viewer).toContain('splitRuby(headText, headReading, headIsBase ? undefined : selectedToken?.base_form)');
    expect(viewer.match(/baseFormReading\(/g)).toHaveLength(1);
  });
});
