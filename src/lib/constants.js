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

export const JP_LEVELS = ['N5 기초', 'N4 기본', 'N3 중급', 'N2 상급', 'N1 심화'];
export const EN_LEVELS = ['A1 기초', 'A2 초급', 'B1 중급', 'B2 상급', 'C1 고급', 'C2 마스터'];
export const FR_LEVELS = ['A0 입문', 'A1 기초', 'A2 초급', 'B1 중급', 'B2 상급', 'C1 고급', 'C2 마스터'];

export const LEVELS = {
  Japanese: JP_LEVELS,
  English: EN_LEVELS,
  French: FR_LEVELS,
};
