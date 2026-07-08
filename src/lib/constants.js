export function detectLang(word) {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(word) ? 'Japanese' : 'English';
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

export const LEVELS = {
  Japanese: JP_LEVELS,
  English: EN_LEVELS,
  French: FR_LEVELS,
  Chinese: ZH_LEVELS,
};
