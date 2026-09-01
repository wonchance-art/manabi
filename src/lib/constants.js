/* ── 표기로 언어 알아내기 ────────────────────────────────────────────────────────
 * 이건 `user_vocabulary.language`가 **비어 있을 때만** 쓰는 폴백이다. 저장 경로 6곳은
 * 전부 언어를 제대로 싣는다(계약: langDetect.test.js).
 *
 * ⚠ 「보여 줄 값」과 「저장해도 되는 값」은 다른 질문이다. 예전에는 그 둘이 한 함수였고,
 * `vocabIO`가 같은 2트랙 판별을 **복제한 뒤 결과를 DB에 UPDATE로 박고** 있었다 —
 * 옛 중국어 행이 단어장을 여는 순간 `Japanese`로 굳었다(프랑스어는 `English`로).
 * 표기만 보고 갈 수 없는 것을 되돌릴 수 없게 만든 셈이라, 둘을 갈랐다.
 * ────────────────────────────────────────────────────────────────────────────── */

/** 가나 — 일본어의 결정적 증거(중국어에는 없다). */
const KANA = /[\u3040-\u30ff]/;
/** 한자(CJK 통합) — ja·zh가 **공유**한다. 이것만으로는 못 가른다. */
const HAN = /[\u4e00-\u9fff]/;
/** 프랑스어 전용 발음부호 — 영어 표제어에는 사실상 안 나온다. */
const FR_DIACRITIC = /[àâäæçéèêëîïôœùûü]/i;

/**
 * **확신할 수 있을 때만** 답한다. 애매하면 `null`.
 * 영속화(backfill·저장)는 반드시 이걸 쓴다 — 방어할 수 없는 추측을 DB에 박지 않는다.
 *
 * · 가나 있음 → 일본어(결정적)
 * · 프랑스어 발음부호 있음 → 프랑스어
 * · 한자만 → **null** (ja↔zh를 표기로 못 가른다. `会社`도 `学生`도 양쪽에 있다)
 * · 라틴만 → **null** (en↔fr을 못 가른다. `table`·`important`는 양쪽 단어다)
 */
export function detectLangConfident(word) {
  const s = String(word || '');
  if (KANA.test(s)) return 'Japanese';
  if (FR_DIACRITIC.test(s)) return 'French';
  return null;
}

/**
 * 화면에 쓸 값 — 확신이 없으면 문자 종류로 **기본값**을 고른다(한자→일본어, 그 외→영어).
 * 기본값은 예전 동작 그대로다. 달라진 건 프랑스어 발음부호 단어가 이제 프랑스어로
 * 읽히는 것뿐이다(TTS 목소리). **저장에는 쓰지 않는다** — 그건 위 `detectLangConfident`.
 */
export function detectLang(word) {
  return detectLangConfident(word) || (HAN.test(String(word || '')) ? 'Japanese' : 'English');
}

/**
 * BCP-47 언어 태그(`ja`·`en-US`·`zh-Hans`) → 정본 언어. **표기 추측이 아니다** —
 * 파일이 스스로 선언한 값을 우리 이름으로 옮길 뿐이라 확신 문제가 없다.
 * ⚠ 목록이 `LEVELS`를 덮는지는 계약이 지킨다(EPUB 반입에서 중국어·프랑스어가
 * 빠진 채 `null`로 떨어지고 있었다 — 언어가 늘 때 이 표가 안 따라왔다).
 */
const BCP47_LANG = { ja: 'Japanese', en: 'English', zh: 'Chinese', fr: 'French' };
export function langFromBcp47(tag) {
  return BCP47_LANG[String(tag || '').slice(0, 2).toLowerCase()] || null;
}

/**
 * 표기가 CJK인가 — **언어 판별이 아니라 표기 판별**이다. 대소문자가 없는 표기를
 * `toLowerCase()` 하지 않으려고 쓴다(`Tシャツ`의 `T`가 소문자로 굳지 않게).
 * 언어를 묻는 자리에서 이걸 쓰면 안 된다 — 한자는 ja·zh 공유다.
 */
export function hasCjkText(word) {
  const s = String(word || '');
  return KANA.test(s) || HAN.test(s);
}

// \ub2e8\uc5b4 \ud45c\uc2dc\uc6a9 \u2014 \uace0\uc720\uba85\uc0ac/\uc57d\uc5b4 \ub4f1 \ud2b9\ubcc4\ud55c \uacbd\uc6b0\uac00 \uc544\ub2c8\uba74 \uccab \uae00\uc790\ub97c \uc18c\ubb38\uc790\ub85c.
// (\ubb38\uc7a5 \uccab\uba38\ub9ac\uc5d0\uc11c \uc218\uc9d1\ub3fc \ub300\ubb38\uc790\uac00 \ub41c \uc77c\ubc18\uc5b4\ub97c \uc18c\ubb38\uc790\ub85c \ubcf4\uc774\uac8c. \ub370\uc774\ud130\ub294 \ubd88\ubcc0.)
export function displayWord(word, pos) {
  if (!word) return word;
  const c = word[0];
  if (!/[A-Z\u00c0-\u00d6\u00d8-\u00de]/.test(c)) return word;                 // \uccab \uae00\uc790\uac00 \ub77c\ud2f4 \ub300\ubb38\uc790\uac00 \uc544\ub2d8(\ud55c\uc790\u00b7\uac00\ub098 \ub4f1)
  if (word.length > 1 && word === word.toUpperCase()) return word; // \uc804\uccb4 \ub300\ubb38\uc790(\uc57d\uc5b4) \uc720\uc9c0
  if (/prop|propre|\u56fa\u6709|\uace0\uc720/i.test(pos || '')) return word;       // \uace0\uc720\uba85\uc0ac(\ud488\uc0ac \ud45c\uc2dc) \uc720\uc9c0
  return c.toLowerCase() + word.slice(1);
}

// \ubb38\uc7a5\uc5d0\uc11c \ub300\uc0c1 \ub2e8\uc5b4\ub97c \uac10\uc2fc \uc870\uac01\ub4e4\ub85c \ubd84\ud560 \u2014 \ubcf5\uc2b5 \ub9c8\uc2a4\ud0b9\u00b7\ud558\uc774\ub77c\uc774\ud2b8 \uacf5\uc6a9 \ud5ec\ud37c.
// listen \uc800\uc7a5 \ub2e8\uc5b4\ub294 word_text\uac00 \uae30\ubcf8\ud615(\u601d\u3046)\uc778\ub370 source_sentence\ub294 \ud65c\uc6a9\ud615(\u601d\u3044\u307e\u3059)\uc744
// \ub2f4\uace0 \uc788\uc5b4 word_text\ub85c split\ud558\uba74 \ubd88\uc77c\uce58(\uc870\uac01 1\uac1c)\ud55c\ub2e4. \uadf8\ub798\uc11c \ud3f4\ubc31 \uccb4\uc778:
//   word_text\ub85c \ub9e4\uce6d \u2192 \uc548 \ub418\uba74 base_form\uc73c\ub85c \u2192 \uadf8\ub798\ub3c4 \uc548 \ub418\uba74 \ud1b5\uc9dc(\ud604\ud589)\ub85c.
// \ubc18\ud658 { parts, term }: parts\ub294 split \uacb0\uacfc, term\uc740 \uc2e4\uc81c\ub85c \ub9e4\uce6d\ub41c \ud45c\uae30(\ubabb \ucc3e\uc73c\uba74 null).
// term\uc774 null\uc774\uba74 parts\ub294 [\ubb38\uc7a5] \ud558\ub098\ubfd0 \u2014 \ud638\ucd9c\ubd80\uac00 \ub9c8\ud06c \uc5c6\uc774 \ud1b5\uc9dc\ub85c \ub80c\ub354\ud55c\ub2e4.
export function splitSentenceAroundWord(sentence, wordText, baseForm) {
  const s = sentence || '';
  for (const term of [wordText, baseForm]) {
    if (!term) continue;
    const parts = s.split(term);
    if (parts.length > 1) return { parts, term };
  }
  return { parts: [s], term: null };
}

export const JP_LEVELS = ['N5 기초', 'N4 기본', 'N3 중급', 'N2 상급', 'N1 심화'];
export const EN_LEVELS = ['A1 기초', 'A2 초급', 'B1 중급', 'B2 상급', 'C1 고급', 'C2 마스터'];
export const FR_LEVELS = ['A0 입문', 'A1 기초', 'A2 초급', 'B1 중급', 'B2 상급', 'C1 고급', 'C2 마스터'];
// 중국어(HSK) — OT(오리엔테이션) + H1~H6. src/content/chinese/index.js ZH_LEVEL_META와 같은 학습 순서.
export const ZH_LEVELS = ['OT 입문', 'H1 기초', 'H2 초급', 'H3 중급', 'H4 상급', 'H5 고급', 'H6 마스터'];

/** 언어 키 → 한국어 이름 — AI 프롬프트·라벨 공용. 2트랙 삼항 하드코딩 재발 방지(자가 감사 ⑥). */
export const LANG_NAME_KO = { Japanese: '일본어', English: '영어', French: '프랑스어', Chinese: '중국어' };
export function langNameKo(lang) { return LANG_NAME_KO[lang] || '일본어'; }

export const LEVELS = {
  Japanese: JP_LEVELS,
  English: EN_LEVELS,
  French: FR_LEVELS,
  Chinese: ZH_LEVELS,
};

/** 언어 → `profiles`의 학습 수준 컬럼. 컬럼 이름을 아는 곳은 여기 하나여야 한다. */
export const PROFILE_LEVEL_COLUMN = Object.freeze({
  Japanese: 'learning_level_japanese',
  English: 'learning_level_english',
  French: 'learning_level_french',
  Chinese: 'learning_level_chinese',
});

/**
 * 그 언어에 대한 사용자의 학습 수준. 없으면 null(호출부가 "수준 미설정"으로 다룬다).
 *
 * 정본이 없어서 벌어진 일: 추천 카드 필터가 `lang === 'Japanese' ? 일본어 : 영어`였고,
 * F R2가 프랑스어 공급을 연 순간 **프랑스어 카드가 사용자의 영어 수준으로 걸러졌다**
 * (영어가 C1이면 프랑스어 B1 카드가 diff 2로 숨는다). 컬럼은 이미 4개가 다 있었다
 * (`20260810120000_profile_levels_fr_zh`) — 없던 건 데이터가 아니라 이 함수다.
 */
export function profileLevel(profile, language) {
  const col = PROFILE_LEVEL_COLUMN[language];
  return (col && profile?.[col]) || null;
}

/**
 * 그 언어의 학습 순서상 위치(0부터). 모르는 값은 null.
 * 순서는 `LEVELS` 배열 자체에서 나온다 — 지역 순서표를 또 만들면 언어가 늘 때마다
 * 갈린다(실측: MaterialsPage의 `LEVEL_ORDER`가 ja/en만 알고 있었다).
 */
export function levelRank(language, level) {
  const i = (LEVELS[language] || []).indexOf(level);
  return i < 0 ? null : i;
}
