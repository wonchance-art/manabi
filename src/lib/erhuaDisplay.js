// 얼화(儿化) 병음 표시 규칙(ZH-ERHUA, 오너 「권장대로」 2026-11-11 KST).
// 저장은 글자마다 한 음절(哪儿 = 「nǎ r」 — 儿 자리의 음절이 r)이고, 본문 · 단어 카드 · 한자 창은 그대로 글자 위에 nǎ | r를 얹는다.
// 낱말 꼴로 읽기를 보이는 자리(담은 표현 목록 · 표현 카드 · 복습 카드)만 r을 앞 음절에 붙여 표준 표기 「nǎr」로 보인다 —
// 교재 정답 병음 · HSK 단어 페이지와 같은 꼴. 저장 값은 바꾸지 않는다(표시만).
// 실음절 ér(女儿 nǚ ér · 儿子 ér zi)은 r 한 글자가 아니라서 닿지 않는다.

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
