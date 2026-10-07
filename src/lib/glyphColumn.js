// 자형 열(正 · 日) 판정 — AE-R3 순수 함수(VIEWER-V2-ROUNDS-001 §6 · 설계서 docs/manabi-viewer-v2-ae-r3.md §3·§4).
// 렌더 배선은 components/viewer/ViewerGlyphColumn.jsx(PR ②). 여기서는 「무엇을 보일지」와 「어떻게 놓을지」만 정한다.
//
// 正 줄은 hanjaKo.js zhengForm(대만 표준 자형, 다를 때만·모호하면 숨김)을 그대로 쓴다.
// 日 줄은 확인된 일본어 표기만 보인다 — 계산한 꼴(toJaForm)은 다대일을 틀리게 고르므로
// (方面 → 方麺, 历史 → 暦史) 이 파일은 글자 변환을 부르지 않는다.
//   ⑴ 사전 행 ja(getJaRef — 단어 단위 대응 판정). null·diff·warn이면 숨김(diff·warn은 「일본어로는」 줄로).
//   ⑵ 같은 단어로 판정됐거나 미판정(undefined — 게스트)이면 확인된 단어 표기(JMdict 파생 표 jaWords.json)가 먼저,
//      표에 없을 때만 사전 행 표기(요미 포함). (PR ② 메인 세션 결정 — 확인 표기 우선)
//   ⑶ 둘 다 없으면 숨김. 글자 단위 폴백(toJaForm)은 확인되지 않은 꼴이라 日 줄에 올리지 않는다(설계서 §3.2).
import { getJaRef, getJaWarn } from './jaRef.js';
import { zhengForm } from './hanjaKo.js';

const KANA = /^[ぁ-ゖァ-ヺー]+$/u;
const HAN_ONLY = /^[\p{Script=Han}々]+$/u;
const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** JMdict 파생 표에서 표제어의 일본어 표기·요미. 없으면 null. */
export function jaWordFromTable(word, jaTable) {
  const w = text(word);
  const v = w && jaTable?.words ? jaTable.words[w] : undefined;
  if (typeof v === 'string') return { form: w, yomi: v };
  if (Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string') return { form: v[0], yomi: v[1] };
  return null;
}

/**
 * 수기 동형이의어 경고(jaWords.json warn — scripts/hanja-curated.mjs JA_FALSE_FRIENDS) → {form, meaning}, 없으면 null.
 * 이 단어는 일본어에 같은 표기가 있지만 주된 뜻이 다르다(回复 ↔ 回復 '회복'). 日 줄에 올리지 않고 경고로만 보인다.
 */
export function jaWarnFromTable(word, jaTable) {
  const w = text(word);
  const v = w && jaTable?.warn ? jaTable.warn[w] : undefined;
  return Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string' && v[0] && v[1] ? { form: v[0], meaning: v[1] } : null;
}

/**
 * 사전 행 ja → {form, yomi, diff, warn} (요미를 지키는 검증판). 형식이 어긋나면 null.
 * 요미는 가나만 30자 이하, 표기는 마크업·줄바꿈 없이 80자 이하.
 * (normalizeJapaneseReference도 PR ②부터 요미를 지키지만, 형식이 어긋난 요미를 버리고 표기는 남긴다 — 日 줄은 더 엄격하게
 *  요미까지 맞아야 쓴다.)
 */
export function readDictJa(ja) {
  if (!ja || typeof ja !== 'object' || Array.isArray(ja)) return null;
  const form = text(ja.form);
  const yomi = text(ja.yomi);
  if (!form || form.length > 80 || /[\r\n<>]/.test(form)) return null;
  if (yomi && (yomi.length > 30 || !KANA.test(yomi))) return null;
  return { form, yomi: yomi || null, diff: ja.diff === true, warn: getJaWarn(ja) };
}

const diffOf = (word, form) => {
  const ws = [...word];
  return [...form].map((c, i) => c !== ws[i]);
};

/**
 * 日 줄 — 보일 때만 {form, yomi, source:'dict'|'jmdict', diff}, 아니면 null.
 * 같은 단어만 올린다: 표기가 한자로만 되고 글자 수가 표제어와 같아야 한다(熊猫 → パンダ 숨김).
 * 꼴이 표제어와 같아도(眼前 がんぜん) 요미가 있으므로 보인다. diff[i] = 간체와 다른 글자(초록 칠).
 * JMdict 파생 표에 표제어가 있으면 그 표기·요미(source 'jmdict')가 사전 행 표기보다 먼저다 — 사전 행은 AI가 적은 값이라
 * 以后 → 以后처럼 글자 변환 꼴이 섞일 수 있고, JMdict는 사전 원천이다(설계서 §3.3 ⑴ 제안을 표기까지 넓힘 — PR ② 결정).
 * @param {{word:string, dictEntry?:object, jaTable?:object}} input
 */
export function jaGlyphRow({ word, dictEntry, jaTable } = {}) {
  const w = text(word);
  if (!w || !/\p{Script=Han}/u.test(w)) return null;
  const n = [...w].length;
  const table = jaWordFromTable(w, jaTable);
  const ok = (form, yomi) => !!form && !!yomi && HAN_ONLY.test(form) && [...form].length === n && KANA.test(yomi);
  if (jaWarnFromTable(w, jaTable)) return null; // 수기 동형이의어 — 사전 행이 같은 표기라 해도 日 줄에 올리지 않는다
  const ja = getJaRef(dictEntry);
  if (ja === null) return null; // 판정 완료 · 대응 없음
  const fromTable = table && ok(table.form, table.yomi)
    ? { form: table.form, yomi: table.yomi, source: 'jmdict', diff: diffOf(w, table.form) } : null;
  if (ja !== undefined) {
    const ref = readDictJa(ja);
    if (!ref || ref.diff || ref.warn) return null; // 다른 말 · 동형이의어 경고 → 더 알아보기 「일본어로는」 줄
    // 확인된 단어 표기(JMdict) 우선 — 사전 행은 「같은 단어인가」 판정만 가르고, 표기는 사전 원천이 정한다
    // (AE-R3 PR ② 메인 세션 결정: 사전 행이 以后·准備처럼 글자 변환 꼴을 적어도 以後·準備).
    if (fromTable) return fromTable;
    if (!ok(ref.form, ref.yomi)) return null;
    return { form: ref.form, yomi: ref.yomi, source: 'dict', diff: diffOf(w, ref.form) };
  }
  return fromTable;
}

/**
 * 자형 열 두 줄을 한 번에 — {zheng, ja}. 둘 다 null이면 자형 열이 없다.
 * @param {{word:string, tradTable?:object, dictEntry?:object, jaTable?:object}} input
 */
export function glyphRows({ word, tradTable, dictEntry, jaTable } = {}) {
  return { zheng: zhengForm(word, tradTable), ja: jaGlyphRow({ word, dictEntry, jaTable }) };
}

// ── 안 1 / 안 2 폭 판정 ────────────────────────────────────────────
// em 추정 + 컨테이너 폭 1회 읽기(설계서 §4). CJK·가나는 모든 글꼴에서 1em이라 웹 글꼴 도착 전후로
// 결과가 같다. 시작값(설계서 시안 맞춤): 표제어 칸 = max(글자 1em, 병음 칸 3.1rem) — AE-R1 루비 셀과
// 같은 식(reader-controls.css `ruby[data-pinyin]{width:max(1em,3.1rem)}`), 열 글자·요미 16px, 간격 약 10px.
// 실글꼴 e2e로 보정했다(PR ②, 2026-10-08 KST): 안 1 열은 표제어와의 구분선(왼쪽 padding 12px + 테두리 1px)을 갖는다 —
// colPadPx. 라벨(.8125rem 1칸 = 13px)·간격(.65em = 10.4px)은 추정(16 · 10.5)보다 작아 추정이 실측보다 3px 남짓 넉넉하다.
// 壮观: 표제어 2 × 49.6 + 간격 16 + 구분선 13 + 열 (1+2+4)×16 + 2×10.5 = 261px.
export const GLYPH_COLUMN_EM = Object.freeze({
  rootPx: 16, // 1rem
  headCharEm: 2.25, // .word-fit 글꼴 상한 clamp(2rem,4cqi,2.25rem)
  pinyinCellRem: 3.1, // 병음 루비 칸 최소 폭
  colPx: 16, // 열 글자(正·日 표기·라벨) 크기
  yomiPx: 16, // 요미 글자 크기
  innerGapPx: 10.5, // 라벨↔표기, 표기↔요미 간격
  sideGapPx: 16, // 표제어 ↔ 오른쪽 열 간격
  colPadPx: 13, // 오른쪽 열 구분선(padding-inline-start 12px + border 1px — reader-controls.css .reader-card-glyph[data-layout="side"])
  tableGutterRem: 1.75, // 안 2 라벨 칸(正·日) — 표제어를 이만큼 들인다(.word-fit margin-inline-start)
});

/**
 * 안 1('side' — 표제어 오른쪽 열) / 안 2('table' — 글자 칸에 맞춘 표) / 안 2b('stack' — 표제어 아래 두 줄 묶음) 판정.
 * 오른쪽 열에 正·日 두 줄(日은 요미까지 한 줄)이 들어가면 안 1, 아니면 안 2. 글자 수가 아니라 폭으로 정한다.
 * 안 2 표마저 넘치면(라벨 칸만큼 들인 표제어가 한 줄에 안 들어가 글자 칸이 줄바꿈되면 — 글자 200%·긴 단어) 칸 맞춤을
 * 포기하고 표제어 아래 두 줄 묶음(안 2b, 설계서 §4 · Q4 제안 — PR ② 실글꼴 실측: 390·320 × 200%에서 표 칸이 겹쳤다).
 * @param {object} p
 * @param {number} p.chars - 표제어 글자 수
 * @param {boolean} [p.zheng] - 正 줄이 있는가
 * @param {{yomi:string}|null} [p.ja] - 日 줄(요미 길이를 쓴다)
 * @param {number} p.containerPx - 표제어 덩어리 내용 폭(.reader-card-lexeme clientWidth)
 * @param {number} [p.scale=1] - 글자 크기 배율(설정 「글자 크기」 200% = 2)
 * @param {number[]} [p.hunPx] - 글자별 훈음 칸 폭(있으면 칸 폭 계산에 넣는다)
 * @returns {'side'|'table'|'stack'|null} 자형 열이 없거나 입력이 잘못되면 null
 */
export function glyphColumnLayout({ chars, zheng = false, ja = null, containerPx, scale = 1, hunPx = [] } = {}) {
  const n = Math.floor(Number(chars));
  if (!(n >= 1) || !(containerPx > 0) || !(scale > 0)) return null;
  if (!zheng && !ja) return null;
  const k = GLYPH_COLUMN_EM;
  const cell = (i) => Math.max(k.headCharEm * k.rootPx * scale, k.pinyinCellRem * k.rootPx * scale, Number(hunPx[i]) || 0);
  let headPx = 0;
  for (let i = 0; i < n; i++) headPx += cell(i);
  const col = k.colPx * scale;
  const rowBase = (1 + n) * col + k.innerGapPx * scale; // 라벨 + 표기 n자 + 간격
  const zhengPx = zheng ? rowBase : 0;
  const yomiLen = ja ? [...text(ja.yomi)].length : 0;
  const jaPx = ja ? rowBase + k.innerGapPx * scale + yomiLen * k.yomiPx * scale : 0;
  const need = headPx + k.sideGapPx * scale + k.colPadPx + Math.max(zhengPx, jaPx);
  if (need <= containerPx) return 'side';
  return headPx + k.tableGutterRem * k.rootPx * scale <= containerPx ? 'table' : 'stack';
}
