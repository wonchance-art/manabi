// 한국 한자음 앵커 — 옵트인 '한자 대조'(중국어 뷰어) 1단계(오너 승인 설계).
// 뜻이 아니라 발음 고리다: 老师의 뜻 자리는 '선생님'이 지키고, 이 모듈은 '노사'(老 로→어두
// 두음 노 + 师 사)를 만들어 lǎoshī를 소리로 걸고 같은 글자를 다른 단어에서 재인식하게 한다.
// 테이블(src/lib/data/hanjaKo.json)은 scripts/generate-hanja-ko.mjs가 생성 — 렌더 쪽은
// 토글이 켜질 때만 dynamic import로 지연 로드한다.

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const CHO_N = 2; // ㄴ
const CHO_R = 5; // ㄹ
const CHO_NG = 11; // ㅇ
// 두음법칙에서 ㄹ·ㄴ이 ㅇ으로 가는 이중·전설 계열 모음(ㅑㅒㅕㅖㅛㅠㅣ)의 중성 인덱스
const Y_VOWELS = new Set([2, 3, 6, 7, 12, 17, 20]);

/** 어두 1음절 두음법칙 — 로→노·료→요·려→여·리→이·녀→여(한국어 읽기 관례, 오너 확정). */
export function applyDueum(syllable) {
  const code = syllable?.charCodeAt?.(0);
  if (code == null || code < HANGUL_BASE || code > HANGUL_END) return syllable;
  const offset = code - HANGUL_BASE;
  const cho = Math.floor(offset / 588);
  const jung = Math.floor((offset % 588) / 28);
  const jong = offset % 28;
  let next = null;
  if (cho === CHO_R) next = Y_VOWELS.has(jung) ? CHO_NG : CHO_N; // 려→여, 로→노
  else if (cho === CHO_N && Y_VOWELS.has(jung)) next = CHO_NG; // 녀→여
  if (next == null) return syllable;
  return String.fromCharCode(HANGUL_BASE + (next * 21 + jung) * 28 + jong) + syllable.slice(1);
}

/**
 * 단어의 한국 한자음 — 글자별 음을 이어붙이고 어두에만 두음법칙을 적용한다.
 * 미등재 글자가 하나라도 있으면 null(어중간한 표기는 앵커로서 해롭다 — 표시 생략).
 * @param {string} word - 중국어 표기(간체·정체 모두 테이블에 수록)
 * @param {Record<string, string>} table - hanjaKo.json
 */
export function readHanjaKo(word, table) {
  const chars = [...String(word || '')];
  if (chars.length === 0 || !table) return null;
  const readings = chars.map((ch) => table[ch]);
  if (readings.some((r) => !r)) return null;
  readings[0] = applyDueum(readings[0]);
  return readings.join('');
}

/**
 * 글자 하나의 훈음 라벨(①) — 한국 옥편 표제 관례: '늙을 로(노)'(두음 변형이 있으면
 * 괄호 병기), 변형 없으면 '스승 사'. 훈 또는 음 미등재면 null.
 * @param {string} ch - 한자 1글자
 * @param {Record<string, string>} koTable - hanjaKo.json(자→음)
 * @param {Record<string, string>} hunTable - hanjaHun.json(자→훈)
 */
export function hanjaHunEum(ch, koTable, hunTable) {
  const eum = koTable?.[ch];
  const hun = hunTable?.[ch];
  if (!eum || !hun) return null;
  const dueum = applyDueum(eum);
  return dueum !== eum ? `${hun} ${eum}(${dueum})` : `${hun} ${eum}`;
}

/**
 * 단어의 글자별 훈음 나열 — [{ch, label}]. 훈이 있는 글자만 담고, 전무하면 null
 * (음 앵커는 readHanjaKo가 이미 커버하므로 훈 없는 글자는 조용히 생략).
 */
export function listHanjaHunEum(word, koTable, hunTable) {
  const items = [...String(word || '')]
    .map((ch) => ({ ch, label: hanjaHunEum(ch, koTable, hunTable) }))
    .filter((x) => x.label);
  return items.length ? items : null;
}

/**
 * 훈음 나열이 단어의 전 글자를 커버하는가 — 커버하면 한자음 단독 표기는 글자별 음과
 * 중복이라 생략한다(오너 확정). 훈이 빠진 글자가 있으면 한자음이 유일한 앵커라 유지.
 */
export function hunsCoverWord(word, huns) {
  const n = [...String(word || '')].length;
  return !!huns && n > 0 && huns.length === n;
}

/**
 * 단어(또는 글자)를 일본식 자형으로 — 간체보다 일본식이 익숙하다는 오너 확정에 따라
 * 훈음 줄 글자를 일본식 단독으로 표기한다(본문 간체가 바로 위 헤더에 있어 병기 불요).
 * 테이블은 자형 상이분만 수록(hanjaJa.json) — 미등재는 그대로.
 */
export function toJaForm(word, jaTable) {
  const s = String(word || '');
  if (!jaTable) return s;
  return [...s].map((ch) => jaTable[ch] || ch).join('');
}
