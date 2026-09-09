/**
 * 이중 언어 교재 정제 — 순수 부품 (v2-AB R0, #1077 설계 5603827169 §4 · 오너 확정 2026-09-09).
 *
 * 오너 교재(일본어 41과)는 원문이 「일본어 문장 / 한국어 뜻」 교대 줄이다. 그대로 담으면
 * ① 뜻 줄이 문장으로 들어가 kuromoji가 한글을 미지 토큰으로 쪼개고(커버리지·「모르는
 * 단어만」 발음 표기가 흔들린다) ② 과당 줄 수가 뜻 줄까지 세어 과 경계가 어긋난다.
 * 원어만 담는 것은 편의가 아니라 **데이터 정합**이다.
 *
 * 규칙(계약 테스트 bilingualSplit.test.js가 고정):
 *  - 한글 비율 ≥ 60%인 줄 = 뜻 줄. 바로 앞 원어 줄과 짝짓는다.
 *  - 짝이 없는 뜻 줄(장 제목·주석·둘째 뜻)은 **미배정**으로 드러낸다 — 조용히 버리지 않는다.
 *  - 뜻의 키는 줄 번호가 아니라 **문장 그대로** — 원문 수정으로 줄이 밀려도 안 어긋나고,
 *    드래그 번역 캐시 키(문장)와 같은 모양이라 뷰어가 Gemini 전에 바로 본다.
 *
 * 우리 목표어(ja·en·zh·fr) 어느 것도 한글을 쓰지 않으므로 한글 줄은 언제나 뜻·주석이다 —
 * 그래서 언어를 묻지 않고 표기로만 판정해도 안전하다.
 */
import { diffLineMap, remapProcessedJson } from './sourceEdit';

/** 뜻 줄 판정 문턱 — 글자(공백·숫자·구두점 제외) 중 한글 비율. 상수이자 계약. */
export const KO_LINE_THRESHOLD = 0.6;
/** 반입 배너 노출 문턱 — 짝 지어진 뜻 줄 / 원어 줄. */
export const BILINGUAL_HINT_RATIO = 0.4;

const HANGUL_RE = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯ힰ-퟿]/u;
// 글자로 세는 것: 문자(L) + 표의문자 확장. 숫자·구두점·기호·공백은 비율 계산에서 뺀다.
const LETTER_RE = /\p{L}/u;

/** 줄의 한글 비율 — 글자가 없으면 0. */
export function hangulRatio(line) {
  let letters = 0;
  let hangul = 0;
  for (const ch of String(line || '')) {
    if (!LETTER_RE.test(ch)) continue;
    letters += 1;
    if (HANGUL_RE.test(ch)) hangul += 1;
  }
  return letters === 0 ? 0 : hangul / letters;
}

/** 뜻 줄인가 — 한글 비율 ≥ 문턱. 빈 줄·글자 없는 줄은 아니다. */
export function isMeaningLine(line, threshold = KO_LINE_THRESHOLD) {
  const t = String(line || '').trim();
  if (!t) return false;
  return hangulRatio(t) >= threshold;
}

/**
 * 교대 줄 분리.
 * @param {string} text 원문(줄바꿈 구분)
 * @param {{threshold?: number}} [opts]
 * @returns {{
 *   sourceText: string,                 // 뜻 줄을 걷어낸 원문(빈 줄 구조 보존)
 *   sourceLines: string[],              // 원어 줄(trim, 순서대로)
 *   translations: Record<string,string>,// 원어 문장 → 뜻 (정확 일치 키)
 *   unassigned: Array<{line: string, index: number, reason: 'no-source'|'second-meaning'}>,
 *   stats: {source: number, meaning: number, paired: number, unassigned: number, duplicates: number},
 * }}
 */
export function splitBilingual(text, opts = {}) {
  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : KO_LINE_THRESHOLD;
  const rawLines = String(text || '').split('\n');
  const kept = [];
  const sourceLines = [];
  const translations = {};
  const unassigned = [];
  let meaning = 0;
  let paired = 0;
  let duplicates = 0;
  // 직전 원어 줄 — 뜻 줄이 오면 여기에 붙는다. 빈 줄이 끼면 짝이 끊긴다(문단 경계 존중).
  let pendingSource = null;
  let pendingHasMeaning = false;

  rawLines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      kept.push('');
      pendingSource = null;
      pendingHasMeaning = false;
      return;
    }
    if (isMeaningLine(line, threshold)) {
      meaning += 1;
      if (pendingSource == null) {
        unassigned.push({ line, index, reason: 'no-source' });
      } else if (pendingHasMeaning) {
        unassigned.push({ line, index, reason: 'second-meaning' });
      } else {
        pendingHasMeaning = true;
        paired += 1;
        if (Object.prototype.hasOwnProperty.call(translations, pendingSource)) duplicates += 1;
        else translations[pendingSource] = line;
      }
      return;
    }
    kept.push(line);
    sourceLines.push(line);
    pendingSource = line;
    pendingHasMeaning = false;
  });

  // 뜻 줄을 걷어낸 자리에 남은 연속 빈 줄은 하나로 접는다 — 문단 구조는 남기고 빈 문단은 안 만든다.
  const collapsed = [];
  for (const l of kept) {
    if (l === '' && (collapsed.length === 0 || collapsed[collapsed.length - 1] === '')) continue;
    collapsed.push(l);
  }
  while (collapsed.length && collapsed[collapsed.length - 1] === '') collapsed.pop();

  return {
    sourceText: collapsed.join('\n'),
    sourceLines,
    translations,
    unassigned,
    stats: { source: sourceLines.length, meaning, paired, unassigned: unassigned.length, duplicates },
  };
}

/** 반입 배너 판정 — 짝 지어진 뜻 줄이 원어 줄의 40% 이상이고 2쌍 이상. */
export function looksBilingual(text, ratio = BILINGUAL_HINT_RATIO) {
  const { stats } = splitBilingual(text);
  if (stats.source === 0 || stats.paired < 2) return false;
  return stats.paired / stats.source >= ratio;
}

/** 확인 문구 재료 — 「원어 X줄 · 뜻 Y줄 · 미배정 Z줄」. */
export function summarizeSplit(stats) {
  const s = stats || {};
  const parts = [`원어 ${Number(s.source) || 0}줄`, `뜻 ${Number(s.paired) || 0}줄`];
  if (Number(s.unassigned) > 0) parts.push(`미배정 ${Number(s.unassigned)}줄`);
  return parts.join(' · ');
}

/**
 * 뜻 조회 — 정확 일치만(부분 추측 금지). 여러 줄 지정은 **모든 줄**이 있을 때만 줄바꿈으로 잇는다.
 * @returns {string|null}
 */
export function lookupTranslation(translations, text) {
  if (!translations || typeof translations !== 'object') return null;
  const whole = String(text || '').trim();
  if (!whole) return null;
  if (typeof translations[whole] === 'string' && translations[whole]) return translations[whole];
  const lines = whole.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const found = lines.map((l) => (typeof translations[l] === 'string' && translations[l] ? translations[l] : null));
  return found.every(Boolean) ? found.join('\n') : null;
}

/** 뷰어 좌 패널용 본문 — formatDetail이 **번역**을 섹션 제목으로 세운다(Gemini 응답과 같은 모양). */
export function bookMeaningPanelText(meaning) {
  return `**번역**\n${meaning}\n\n📘 교재에 실린 뜻이에요.`;
}

/**
 * 이미 올린 과 걷어내기 계획 — 뜻 줄 삭제는 **재분석 없이 리맵**만(원어 토큰은 살고 한글
 * 토큰만 사라진다). buildEditPlan을 쓰지 않는 이유: 그쪽은 문단 자동 분리를 먼저 걸어
 * 문장 목록에 빈 줄을 끼워 넣을 수 있다(bookSplit §문장 목록 반입).
 * @param {{raw_text?: string, processed_json?: object}} material
 * @returns {{ok:true, noop:boolean, newText:string, remapped:object, translations:object,
 *            stats:object, unassigned:Array, analyzeCount:0}|{ok:false, reason:string}}
 */
export function planRefine(material) {
  const oldText = String(material?.raw_text ?? '');
  const split = splitBilingual(oldText);
  const existing = material?.processed_json?.metadata?.translations;
  const translations = { ...(existing && typeof existing === 'object' ? existing : {}), ...split.translations };
  if (split.stats.meaning === 0) {
    return { ok: true, noop: true, newText: oldText, remapped: material?.processed_json || null, translations, stats: split.stats, unassigned: [], analyzeCount: 0 };
  }
  const d = diffLineMap(oldText.split('\n'), split.sourceText.split('\n'));
  if (!d.ok) return { ok: false, reason: '자료가 너무 커서 정제 계획을 세우지 못했어요.' };
  if (d.changedNew.length > 0) return { ok: false, reason: '뜻 줄만 걷어내는 계획이 아닙니다(바뀐 줄 존재) — 정제를 중단합니다.' };
  const base = material?.processed_json || { sequence: [], dictionary: {}, failed_indices: [] };
  const r = remapProcessedJson(base, d.pairs);
  if (!r.ok) return { ok: false, reason: '기존 분석을 옮길 수 없어 정제를 중단합니다.' };
  const remapped = {
    ...r.json,
    metadata: { ...(base.metadata || {}), translations },
  };
  return {
    ok: true,
    noop: false,
    newText: split.sourceText,
    remapped,
    translations,
    stats: split.stats,
    unassigned: split.unassigned,
    analyzeCount: 0,
  };
}
