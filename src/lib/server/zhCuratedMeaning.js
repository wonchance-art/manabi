// 중국어 빈 뜻 예방(DATA-TUNE-001 후속, 오케스트레이터 승인 2026-11-06 20:24 KST · 백엔드 자율).
// 분석기가 공유 사전(morpheme_dictionary)에서 뜻을 못 얻은 토큰에만, 이 저장소의 교재 표제어
// (content/chinese/vocab — 사람이 교정한 HSK 단어장)에서 뜻을 빌려 온다. AI 생성 · 유료 API · 새 환경 변수 없음.
// 독립 근거 = 토큰 자체의 병음(분석기가 문장 문맥으로 낸 것):
//   · 두 글자 이상 — 성조를 뺀 글자가 표제어 병음과 같아야 한다(不 · 一 변조는 통과).
//   · 한 글자 — 다음자 · 다의 위험(教 · 曾 · 用 · 经)이 커서 성조까지 같고, 품사도 같아야 한다.
// 공유 사전 행은 읽지도 쓰지도 않는다 — 토큰의 빈 meaning만 채운다(user_verified · 사람 교정 행 무변경).
// 2차 운영 실측: 이 규칙이면 사람 검토 100칸 중 문맥 불일치 4칸 가운데 3칸(用 · 经×2)을 거르고 통과 96칸은 그대로 받는다
// (나머지 1칸 制服은 표제어를 정정해 「제복」 뜻이 들어 있다).

const VOCAB_FILES = [
  () => import('../../content/chinese/vocab/h1'),
  () => import('../../content/chinese/vocab/h1_hsk'),
  () => import('../../content/chinese/vocab/h1_hsk2026'),
  () => import('../../content/chinese/vocab/h1_hsk30'),
  () => import('../../content/chinese/vocab/h2'),
  () => import('../../content/chinese/vocab/h2_hsk'),
  () => import('../../content/chinese/vocab/h2_hsk30'),
  () => import('../../content/chinese/vocab/h3'),
  () => import('../../content/chinese/vocab/h3_hsk'),
  () => import('../../content/chinese/vocab/h3_hsk2026'),
  () => import('../../content/chinese/vocab/h3_hsk30'),
  () => import('../../content/chinese/vocab/h4'),
  () => import('../../content/chinese/vocab/h4_hsk2026'),
  () => import('../../content/chinese/vocab/h4_hsk30'),
  () => import('../../content/chinese/vocab/h4_hsk_a'),
  () => import('../../content/chinese/vocab/h4_hsk_b'),
  () => import('../../content/chinese/vocab/h4_hsk_c'),
  () => import('../../content/chinese/vocab/h5'),
  () => import('../../content/chinese/vocab/h5_hsk2026'),
  () => import('../../content/chinese/vocab/h5_hsk30'),
  () => import('../../content/chinese/vocab/h5_hsk_a'),
  () => import('../../content/chinese/vocab/h5_hsk_b'),
  () => import('../../content/chinese/vocab/h5_hsk_c'),
  () => import('../../content/chinese/vocab/h5_hsk_d'),
  () => import('../../content/chinese/vocab/h5_hsk_e'),
  () => import('../../content/chinese/vocab/h5_hsk_f'),
  () => import('../../content/chinese/vocab/h6'),
  () => import('../../content/chinese/vocab/h6_hsk2026'),
  () => import('../../content/chinese/vocab/h6_hsk30'),
  () => import('../../content/chinese/vocab/h6_hsk_a'),
  () => import('../../content/chinese/vocab/h6_hsk_b'),
  () => import('../../content/chinese/vocab/h6_hsk_c'),
  () => import('../../content/chinese/vocab/h6_hsk_d'),
  () => import('../../content/chinese/vocab/h6_hsk_e'),
  () => import('../../content/chinese/vocab/h7_hsk2026_a'),
  () => import('../../content/chinese/vocab/h7_hsk2026_b'),
  () => import('../../content/chinese/vocab/h7_hsk2026_c'),
  () => import('../../content/chinese/vocab/h7_hsk2026_d'),
  () => import('../../content/chinese/vocab/h7_hsk2026_e'),
  () => import('../../content/chinese/vocab/expansion'), // 보강 세트는 급수 세트 뒤 — 같은 표기면 급수 표제어가 먼저
];

/** 계약 시험용 — vocab 폴더의 모든 파일이 목록에 있어야 한다. */
export const ZH_CURATED_VOCAB_FILE_COUNT = VOCAB_FILES.length;

const HAN = /\p{Script=Han}/u;

/** 병음 비교 키 — 공백 · 붙임표 · 아포스트로피를 걷고 소문자 NFC. tones=false면 성조 부호도 걷는다. */
export function zhPinyinKey(pinyin, { tones = true } = {}) {
  let s = String(pinyin || '').normalize('NFC').toLowerCase().replace(/[\s'’·\-]/g, '');
  if (!tones) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC');
  return s;
}

/** 세트 모듈들 → 표제어 → 항목들(같은 표기의 다른 병음 · 품사를 모두 둔다, 먼저 나온 세트가 앞). */
export function buildZhCuratedIndex(mods) {
  const idx = new Map();
  for (const mod of mods) {
    const data = mod?.default || mod;
    for (const theme of data?.themes || []) {
      for (const w of theme?.words || []) {
        const zh = String(w?.zh || '').trim();
        const ko = String(w?.ko || '').trim();
        if (!zh || !ko || !w?.pinyin) continue;
        if (!idx.has(zh)) idx.set(zh, []);
        idx.get(zh).push({ pinyin: w.pinyin, ko, pos: w.pos || '' });
      }
    }
  }
  return idx;
}

let indexPromise = null;

/** 교재 표제어 색인 지연 로드(첫 사용 때 1회). 실패하면 다음 호출이 다시 시도한다. */
export function loadZhCuratedIndex() {
  indexPromise ||= Promise.all(VOCAB_FILES.map((load) => load()))
    .then(buildZhCuratedIndex)
    .catch((err) => { indexPromise = null; throw err; });
  return indexPromise;
}

/**
 * 공유 사전에 뜻이 없는 토큰의 교재 표제어 뜻. 맞는 항목이 없으면 ''(빈칸 그대로).
 * @param {Map} index buildZhCuratedIndex 결과
 * @param {{ text: string, reading?: string|null, pos?: string|null }} token 표기 · 토큰 병음 · 문맥 품사
 */
export function pickZhCuratedMeaning(index, { text, reading, pos }) {
  const form = String(text || '').trim();
  if (!index || !form || !HAN.test(form) || !reading) return '';
  const entries = index.get(form);
  if (!entries?.length) return '';
  const single = [...form].length === 1;
  const key = zhPinyinKey(reading, { tones: single });
  if (!key) return '';
  const byReading = entries.filter((e) => zhPinyinKey(e.pinyin, { tones: single }) === key);
  if (single) return byReading.find((e) => pos && e.pos === pos)?.ko || '';
  return (byReading.find((e) => pos && e.pos === pos) || byReading[0])?.ko || '';
}
