import { describe, expect, it } from 'vitest';
import { tokenizeJaLine } from '../tokenizeJa';
import { JA_TOKEN_READING, JA_COUNTERS, readNumeral, readCounted, digitsToKanji } from '../jaReadingFix';

/**
 * 계약: kuromoji 독음 수리 (분석기 리뷰 라운드 3 — #1077 5501779373 §2).
 * 코퍼스 9,203문장 전수 대조의 범인 순위를 그대로 픽스처로 쓴다. 규칙마다 **바꾸는 쪽과 두는 쪽**을 한 쌍으로.
 */
const toks = async (s) => (await tokenizeJaLine(s)).filter((t) => t.pos !== '기호');
const readOf = async (s, w) => (await toks(s)).find((t) => t.text === w)?.furigana;

describe('① 토큰 정확 일치', () => {
  it('日本은 にほん — 범인 1위 ×66. 독해 게이트 PLACE_YOMI에만 있던 수리', async () => {
    expect(await readOf('日本に住んでいる。', '日本')).toBe('にほん');
    expect(await readOf('今年こそ日本へ行きたい。', '日本')).toBe('にほん');
  });

  it('단독 間·物·者·今·後·角·味·道 — 별개 토큰인 복합어는 무관', async () => {
    expect(await readOf('留守の間にどろぼうが入った。', '間')).toBe('あいだ');
    expect(await readOf('教師たる者、模範を示すべきだ。', '者')).toBe('もの');
    expect(await readOf('研究者が発表した。', '者')).toBe('しゃ');      // 명사 뒤 者는 しゃ — 토큰 일치로 넣었다가 40건이 깨진 자리
    expect(await readOf('今すぐ来て。', '今')).toBe('いま');
    expect(await readOf('今学期の成績が上がった。', '今')).toBe('こん');   // 닫힌 복합의 접두 — 토큰 일치로 넣었다가 깨진 자리
    expect(await readOf('その映画は今話題になっている。', '今')).toBe('いま'); // 명사 앞이라도 복합이 아니면 いま
    expect((await toks('今朝は寒い。'))[0].furigana).toBe('けさ');    // 今朝寝坊는 朝寝坊가 한 단어라 무관
    expect(await readOf('食事の後で散歩する。', '後')).toBe('あと');   // その後는 한 토큰(そのご)이라 무관
    expect(await readOf('十年後の生活を想像する。', '後')).toBe('ご');   // 명사 뒤 접미
    expect(await readOf('夜が明けた。', '夜')).toBe('よ');
    expect(await readOf('夜に電話する。', '夜')).toBe('よる');
    expect(await readOf('角を右に曲がる。', '角')).toBe('かど');
    expect(await readOf('午後に会いましょう。', '午後')).toBe('ごご');   // 복합어 그대로
  });

  it('등재 항목은 전부 분석기 출력에 반영된다', async () => {
    for (const [w, r] of Object.entries(JA_TOKEN_READING)) {
      const got = await readOf(`${w}。`, w);
      // 来ら·堪え·預け·描く·得る은 문장 안에서 활용 토큰으로 온다 — 단독으로는 다른 분할이 될 수 있어 문장으로 본다
      if (got !== undefined) expect(got, w).toBe(r);
    }
    expect(await readOf('明日のパーティー、来られますか。', '来ら')).toBe('こら');
    expect(await readOf('痛みに堪える。', '堪える')).toBe('たえる');
    expect(await readOf('荷物を預けます。', '預け')).toBe('あずけ');
  });
});

describe('② 이웃 조건', () => {
  it('何 — です/で 앞에서만 なん(12/12). 何を·何も는 なに', async () => {
    expect(await readOf('これは何ですか。', '何')).toBe('なん');
    expect(await readOf('あれは何の木ですか。', '何')).toBe('なん');
    expect((await toks('何名様ですか。'))[0].furigana).toBe('なんめい');
    expect(await readOf('何でも聞いてください。', '何')).toBe('なん');
    expect((await toks('今日は何曜日ですか。')).find((t) => t.text === '何曜日')?.furigana).toBe('なんようび');
    expect(await readOf('何を食べますか。', '何')).toBe('なに');
    expect(await readOf('何もない。', '何')).toBe('なに');
  });

  it('不足 — 명사 뒤는 연탁 ぶそく(運動不足), 「が不足し」는 ふそく', async () => {
    expect(await readOf('最近、運動不足で太り気味だ。', '不足')).toBe('ぶそく');
    expect(await readOf('人手が不足している。', '不足')).toBe('ふそく');
  });

  it('開く — が/は 뒤는 자동사 あく, を 뒤는 ひらく', async () => {
    expect(await readOf('ドアが開く。', '開く')).toBe('あく');
    expect(await readOf('このドアは自動で開く。', '開く')).toBe('あく');
    expect(await readOf('ドアが開いた。', '開い')).toBe('あい');
    expect(await readOf('店を開く。', '開く')).toBe('ひらく');
  });

  it('降り — 雨が降り(ふり), バスを降り(おり)', async () => {
    expect(await readOf('雨が降りそうです。', '降り')).toBe('ふり');
    expect(await readOf('バスを降りて歩く。', '降り')).toBe('おり');
  });

  it('十分 — な·に·ある 앞은 じゅうぶん, 시간은 じゅっぷん(11/11)', async () => {
    expect(await readOf('十分な時間がある。', '十分')).toBe('じゅうぶん');
    expect(await readOf('十分待ちます。', '十分')).toBe('じゅっぷん');
  });

  it('中·方·行っ·行き·辛い', async () => {
    expect(await readOf('今日中に終わらせる。', '中')).toBe('じゅう');
    expect(await readOf('授業中に寝た。', '授業中') ?? await readOf('授業中に寝た。', '中')).toMatch(/ちゅう$/);
    expect(await readOf('あの方は先生です。', '方')).toBe('かた');
    expect(await readOf('あちらの方はどなたですか。', '方')).toBe('かた');
    expect(await readOf('駅の方へ行く。', '方')).toBe('ほう');
    expect(await readOf('まっすぐ行ってください。', '行っ')).toBe('いっ');
    expect(await readOf('会議を行った。', '行っ')).toBe('おこなっ');
    expect(await readOf('このでんしゃは、渋谷行きです。', '行き')).toBe('ゆき');
    expect(await readOf('学校へ行きます。', '行き')).toBe('いき');
    expect(await readOf('仮名を覚える。', '仮名')).toBe('かな');   // 平仮名는 한 토큰(ひらがな)이라 무관
    expect(await readOf('辛い物が好きだ。', '辛い')).toBe('からい');
  });
});

describe('③ 수사 + 조수사 — 두 토큰을 한 토큰으로', () => {
  it('二人·一人·三人 — 범인 2·3위(×40·×19)', async () => {
    const t = await toks('二人で行きます。');
    expect(t[0].text).toBe('二人');
    expect(t[0].furigana).toBe('ふたり');
    expect((await toks('一人で住んでいます。'))[0].furigana).toBe('ひとり');
    expect((await toks('三人で来ました。'))[0].furigana).toBe('さんにん');
  });

  it('시각·날짜·분 — 七時 しちじ·九時 くじ·四時 よじ·三日 みっか·十日 とおか·十分 じゅっぷん', async () => {
    expect((await toks('七時に起きます。'))[0].furigana).toBe('しちじ');
    expect((await toks('九時に会いましょう。'))[0].furigana).toBe('くじ');
    expect((await toks('四時です。'))[0].furigana).toBe('よじ');
    expect((await toks('三日かかります。'))[0].furigana).toBe('みっか');
    expect((await toks('十日に行きます。'))[0].furigana).toBe('とおか');
    expect((await toks('一日中忙しい。'))[0].furigana).toBe('いちにち');    // 하루 — 月 뒤가 아니면 ついたち가 아니다(16건 실측)
    const date = await toks('四月一日に始まる。');
    expect(date.find((t) => t.text === '一日')?.furigana).toBe('ついたち');
    expect((await toks('十分待ってください。'))[0].furigana).toBe('じゅっぷん');
    expect((await toks('いもうとは十さいです。')).find((t) => t.text === '十さい')?.furigana).toBe('じゅっさい');   // 가나 조수사
    expect((await toks('卵を十分間茹でた。')).find((t) => t.text === '十分間')?.furigana).toBe('じゅっぷんかん');
  });

  it('음편 — 一本 いっぽん·三本 さんぼん·六匹 ろっぴき·八百 はっぴゃく·三千 さんぜん·二十歳 はたち', async () => {
    expect(readCounted('一', '本')).toBe('いっぽん');
    expect(readCounted('三', '本')).toBe('さんぼん');
    expect(readCounted('六', '匹')).toBe('ろっぴき');
    expect(readCounted('二十', '歳')).toBe('はたち');
    expect(readCounted('二十', '本')).toBe('にじゅっぽん');   // 마지막 글자 음편 + 앞부분
    expect(readNumeral('三百')).toBe('さんびゃく');
    expect(readNumeral('八百')).toBe('はっぴゃく');
    expect(readNumeral('三千')).toBe('さんぜん');
    expect(readNumeral('三十五')).toBe('さんじゅうご');
    expect((await toks('三百円です。'))[0].furigana).toBe('さんびゃくえん');
  });

  it('아라비아 숫자 — kuromoji가 독음을 안 주던 자리(３時 → さんじ)', async () => {
    expect(digitsToKanji('3')).toBe('三');
    expect(digitsToKanji('25')).toBe('二十五');
    expect(digitsToKanji('１０')).toBe('十');
    expect((await toks('３時に会いましょう。'))[0].furigana).toBe('さんじ');
    expect((await toks('10分待ちます。'))[0].furigana).toBe('じゅっぷん');
  });

  it('조수사가 아니면 병합하지 않는다 — 三 + 時間(명사)·二 + の', async () => {
    const t = await toks('三時間かかる。');
    expect(t.map((x) => x.text)).not.toContain('三時間');   // 時間은 표에 없다 — 三/時間 그대로
    expect(JA_COUNTERS['時間']).toBeUndefined();
  });
});
