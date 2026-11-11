// 얼화(儿化) 병음 표시 규칙(ZH-ERHUA, 오너 「권장대로」 2026-11-11 KST).
// 저장은 글자마다 한 음절(哪儿 = 「nǎ r」 — 儿 자리의 음절이 r)이고, 본문 · 단어 카드 · 한자 창은 그대로 글자 위에 nǎ | r를 얹는다.
// 낱말 꼴로 읽기를 보이는 자리(담은 표현 목록 · 표현 카드 · 복습 카드)만 r을 앞 음절에 붙여 표준 표기 「nǎr」로 보인다 —
// 교재 정답 병음 · HSK 단어 페이지와 같은 꼴. 저장 값은 바꾸지 않는다(표시만).
// 실음절 ér(女儿 nǚ ér · 儿子 ér zi)은 r 한 글자가 아니라서 닿지 않는다.
import { splitPinyinSyllables } from './viewerHanjaPanel';

// 홀로 선 음절 「r」(앞이 공백 · 뒤가 공백/구두점/끝)만 앞 음절에 붙인다.
const LONE_R = /(\S)\s+r(?=$|[\s,.;:!?，。；：！？、])/gu;

/** 「nǎ r」 → 「nǎr」, 「yì diǎn r」 → 「yì diǎnr」. 문자열이 아니거나 해당이 없으면 그대로. */
export function joinErhuaPinyin(reading) {
  if (typeof reading !== 'string' || !reading.includes('r')) return reading;
  return reading.replace(LONE_R, '$1r');
}

/** 담은 표현 행의 읽기를 보일 꼴로 — 중국어만 얼화를 붙이고, 다른 언어 읽기는 그대로. */
export function displayReading(reading, language) {
  return language === 'Chinese' ? joinErhuaPinyin(reading) : reading;
}

const HAN_WORD = /^\p{Script=Han}+$/u;
/**
 * 붙인 꼴을 저장 꼴로 되돌린다(CSV 가져오기 — 내보내기는 「nǎr」로 내보낸다). 낱말이 儿로 끝나고, 음절 분할(splitPinyinSyllables —
 * 표준 음절이 먼저, 안 되면 얼화)이 끝을 「r」로 뗄 때만 그 r을 따로 둔다: 哪儿 「nǎr」 → 「nǎ r」, 一点儿 「yì diǎnr」 → 「yì diǎn r」.
 * 婴儿 「yīngér」 · 女儿 「nǚ ér」처럼 실음절 ér이면 그대로 — 저장의 「글자 1 = 음절 1」을 지킨다.
 */
export function splitErhuaPinyin(reading, word) {
  if (typeof reading !== 'string' || typeof word !== 'string') return reading;
  const w = word.trim(); const src = reading.trim(); const n = [...w].length;
  if (n < 2 || !w.endsWith('儿') || !HAN_WORD.test(w) || !src) return reading;
  if (src.split(/\s+/).length === n) return reading;             // 이미 글자마다 한 음절
  const sylls = splitPinyinSyllables(src, n, { erhua: true });
  if (!sylls || sylls.at(-1) !== 'r' || !/r$/u.test(src)) return reading;
  return `${src.slice(0, -1).trimEnd()} r`;
}
