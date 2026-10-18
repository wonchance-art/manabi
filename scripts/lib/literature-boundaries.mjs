// 정본 문학책 단어 경계 미리 묶기(AOZORA-P1-10, 오너 「고유명사 같은 게 … 형태소로 나눠버리는 상황 빈번함」 2026-10-15 KST).
//
// 문제(실측 34편 621장): 분석기(kuromoji + jaReadingFix·jaKanaSegment·jaCompoundMerge)가 저자가 루비로 한 낱말이라 밝힌 자리를
// 형태소로 쪼갠다 — 苦沙弥 → 苦|沙弥, 兵十 → 兵|十, 李徴 · 杜子春 · 又三郎 · 檸檬 …, 2자 이상 루비 기준 4,400여 곳. 쪼개지면
// 저자 루비도 붙지 않는다(aozoraRuby는 토큰 하나와 정확히 맞을 때만 독음을 덮는다). 루비 없는 카타카나 이름도 쪼갠다(ペ|テロ).
//
// 해법: 분석 전에 「한 단어로 묶기」 기록(viewer v2 AD-R3 metadata.viewerBoundaries)을 장마다 미리 실어 둔다. 분석 경로는 그대로다 —
// analyzeHybrid가 기록을 요청에 싣고 서버가 토큰화 직후·뜻 조회 전에 묶는다(새 낱말의 뜻·품사도 그 자리에서 조회된다).
// 이 모듈은 빌드 때만 돈다(분석기와 같은 tokenizeJaLine으로 경계를 미리 재고, 양 끝이 토큰 경계와 맞는 곳만 기록으로 낸다).
//
// 묶는 자리(우선순위 순 — 장마다 기록 상한 BOUNDARY_LIMITS.maxEdits 안에서):
//   ruby         저자 루비 기준(2자 이상)이 토큰 둘 이상으로 쪼개진 자리
//   ruby-repeat  같은 작품에서 쪼개졌던 루비 기준(한자·카타카나 2자 이상 — 이름은 보통 처음에만 루비가 붙는다)의 다른 자리
//   katakana     카타카나만으로 된 토큰이 맞붙어 쪼개진 자리(가운뎃점 없이 — 외래어·이름·의성어는 한 낱말)
// 묶기 상한(토큰 8개 · 글자 12)을 넘거나 양 끝이 토큰 경계가 아니면(분석기 토큰 안쪽에서 시작) 기록을 내지 않는다 —
// 서버가 적용할 수 없는 기록은 pending으로 남아 소음이 된다.
import { createHash } from 'node:crypto';

export const LITERATURE_BOUNDARY_FILE = 'boundaries.json';
export const LITERATURE_BOUNDARY_VERSION = 1;
// name · name-repeat — 위키문헌 중국어 교정본의 고유명사 밑줄(专名线, metadata.literature.nameMarks — LIT-SRC-WS-1). 루비와 같은 자리 규칙.
export const BOUNDARY_REASONS = Object.freeze(['ruby', 'ruby-repeat', 'katakana', 'name', 'name-repeat']);

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const compact = (value) => String(value ?? '').replace(/\s+/gu, '');
const NAME_LIKE = /^[\p{Script=Han}々〆ヶ\p{Script=Katakana}ー]{2,}$/u;
const KATAKANA = /^[ァ-ヺー]+$/u;

/**
 * 줄 토큰 → 공백 뺀 줄 좌표의 토큰 경계 [{start, end, text}]. 토큰을 이은 글자가 줄과 다르면 null(그 줄은 건너뛴다).
 * spans.gaps = 줄 원문의 공백 자리(공백 뺀 좌표) — 서버는 공백을 사이에 둔 묶기를 whitespace_inside로 거부한다.
 */
function tokenSpans(line, tokens) {
  const spans = [];
  let at = 0;
  for (const token of tokens) {
    const length = compact(token.text).length;
    if (length) spans.push({ start: at, end: at + length, text: compact(token.text) });
    at += length;
  }
  if (compact(tokens.map((token) => token.text).join('')) !== compact(line)) return null;
  spans.gaps = [];
  let seen = 0;
  for (const char of line.trim()) {
    if (/\s/u.test(char)) { if (spans.gaps.at(-1) !== seen) spans.gaps.push(seen); } else seen += char.length;
  }
  return spans;
}

/** [start, end)가 토큰 경계에서 시작·끝나고 토큰 둘 이상을 덮는가(사이에 공백 없이) — 덮는 토큰들(아니면 null). */
function splitRegion(spans, start, end, limits) {
  const first = spans.findIndex((span) => span.start === start);
  const last = spans.findIndex((span) => span.end === end);
  if (first < 0 || last < 0 || last <= first) return null;
  if ((spans.gaps || []).some((gap) => gap > start && gap < end)) return null;
  const covered = spans.slice(first, last + 1);
  if (covered.length > limits.maxTokens || end - start > limits.maxChars) return null;
  return covered;
}

/**
 * 한 작품의 장들 → 장마다 묶기 기록 [{order, textSha256, edits: [{line, start, end, text, reason}]}].
 * chapters: 빌드 초안의 장({order, rawText, metadata.literature.rubyLocks | nameMarks}) · tokenizeLine: async (줄) => [{text}] (분석기와 같은 것).
 * 표시 자리({start, base} — 장 원문 좌표)는 아오조라 저자 루비(rubyLocks → ruby)와 위키문헌 고유명사 밑줄(nameMarks → name)을 같은 규칙으로 쓴다.
 */
export async function literatureBoundaryMerges(chapters, tokenizeLine, limits = { maxTokens: 8, maxChars: 12, maxEdits: 200 }) {
  // 1) 장마다 줄 토큰 경계를 한 번만 잰다.
  const measured = [];
  for (const chapter of chapters) {
    const lines = chapter.rawText.split('\n');
    const spansByLine = [];
    for (const line of lines) spansByLine.push(line.trim() ? tokenSpans(line, await tokenizeLine(line)) : []);
    measured.push({ chapter, lines, spansByLine });
  }
  // 2) 저자 루비 자리 — 쪼개진 기준은 작품 전체의 「이름 같은 낱말」 목록에도 올린다(다른 자리 묶기).
  const names = new Map(); // 쪼개졌던 표시 낱말 → 다른 자리의 이유(ruby-repeat | name-repeat)
  const lineStarts = (lines) => { const starts = []; let at = 0; for (const line of lines) { starts.push(at); at += line.length + 1; } return starts; };
  const rubyByChapter = measured.map(({ chapter, lines, spansByLine }) => {
    const starts = lineStarts(lines);
    const edits = [];
    const literature = chapter.metadata.literature;
    const marks = [...(literature.rubyLocks || []).map((lock) => ({ ...lock, reason: 'ruby' })), ...(literature.nameMarks || []).map((mark) => ({ ...mark, reason: 'name' }))];
    for (const lock of marks) {
      if (lock.base.length < 2) continue;
      let line = starts.length - 1;
      while (line > 0 && starts[line] > lock.start) line -= 1;
      const spans = spansByLine[line];
      if (!spans) continue;
      const start = compact(lines[line].slice(0, lock.start - starts[line])).length;
      const end = start + compact(lock.base).length;
      if (!splitRegion(spans, start, end, limits)) continue;
      edits.push({ line, start, end, text: compact(lock.base), reason: lock.reason });
      if (NAME_LIKE.test(lock.base)) names.set(compact(lock.base), `${lock.reason}-repeat`);
    }
    return edits;
  });
  // 3) 같은 낱말의 다른 자리 · 쪼개진 카타카나 — 루비 자리와 겹치지 않게 우선순위대로 담는다.
  return measured.map(({ chapter, lines, spansByLine }, index) => {
    const taken = new Map(); // line → [[start, end]]
    const free = (line, start, end) => !(taken.get(line) || []).some(([s, e]) => start < e && end > s);
    const out = [];
    const take = (edit) => {
      if (out.length >= limits.maxEdits || !free(edit.line, edit.start, edit.end)) return;
      if (!taken.has(edit.line)) taken.set(edit.line, []);
      taken.get(edit.line).push([edit.start, edit.end]);
      out.push(edit);
    };
    rubyByChapter[index].forEach(take);
    spansByLine.forEach((spans, line) => {
      if (!spans) return;
      const text = compact(lines[line]);
      for (const [name, reason] of names) {
        for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + 1)) {
          if (splitRegion(spans, at, at + name.length, limits)) take({ line, start: at, end: at + name.length, text: name, reason });
        }
      }
    });
    spansByLine.forEach((spans, line) => {
      if (!spans) return;
      for (let k = 0; k < spans.length;) {
        let j = k;
        while (j + 1 < spans.length && KATAKANA.test(spans[k].text) && KATAKANA.test(spans[j + 1].text) && spans[j].end === spans[j + 1].start) j += 1;
        if (j > k && splitRegion(spans, spans[k].start, spans[j].end, limits)) {
          take({ line, start: spans[k].start, end: spans[j].end, text: spans.slice(k, j + 1).map((span) => span.text).join(''), reason: 'katakana' });
        }
        k = j + 1;
      }
    });
    out.sort((a, b) => a.line - b.line || a.start - b.start);
    return { order: chapter.order, textSha256: sha256(chapter.rawText), edits: out };
  });
}

/** boundaries.json 직렬화 정본 — 2칸 들여쓰기 + 끝 개행(결정적). */
export function serializeBoundaries(chapters, tokenizer) {
  return `${JSON.stringify({ schemaVersion: LITERATURE_BOUNDARY_VERSION, tokenizer, chapters }, null, 2)}\n`;
}

/**
 * 빌드: boundaries.json → 장 metadata.viewerBoundaries(분석 요청에 실리는 「한 단어로 묶기」 기록, 모두 pending으로 시작).
 * 장 원문 해시가 다르면 throw — 원문·장 나눔이 바뀐 뒤 낡은 좌표로 엉뚱한 자리를 묶지 않게(다시 만든다).
 * prefix: 기록 id·source의 출처 이름(아오조라 'aozora' · 위키문헌 'wikisource').
 */
export function withBoundaryMerges(draft, boundaries, prefix = 'aozora') {
  if (!boundaries) return draft;
  if (boundaries.schemaVersion !== LITERATURE_BOUNDARY_VERSION || !Array.isArray(boundaries.chapters)) throw new Error(`${LITERATURE_BOUNDARY_FILE} 형식이 아니다`);
  const byOrder = new Map(boundaries.chapters.map((chapter) => [chapter.order, chapter]));
  if (byOrder.size !== draft.chapters.length) throw new Error(`${LITERATURE_BOUNDARY_FILE}의 장 수가 다르다 — node scripts/literature/boundaries.mjs로 다시 만든다`);
  return {
    ...draft,
    chapters: draft.chapters.map((chapter) => {
      const entry = byOrder.get(chapter.order);
      if (!entry || entry.textSha256 !== sha256(chapter.rawText)) throw new Error(`${LITERATURE_BOUNDARY_FILE} ${chapter.order}장이 원문과 다르다 — node scripts/literature/boundaries.mjs로 다시 만든다`);
      if (!entry.edits.length) return chapter;
      const lines = chapter.rawText.split('\n');
      const edits = entry.edits.map((edit, k) => {
        if (!BOUNDARY_REASONS.includes(edit.reason) || compact(lines[edit.line] ?? '').slice(edit.start, edit.end) !== edit.text) {
          throw new Error(`${LITERATURE_BOUNDARY_FILE} ${chapter.order}장 기록 ${k + 1}이 원문 자리와 다르다`);
        }
        return { id: `${prefix}_${chapter.order}_${k}`, line: edit.line, start: edit.start, end: edit.end, text: edit.text, cuts: [], base: [], status: 'pending', source: `${prefix}-${edit.reason}` };
      });
      return { ...chapter, metadata: { ...chapter.metadata, viewerBoundaries: { version: 1, edits } } };
    }),
    diagnostics: { ...draft.diagnostics, boundaryMergeCount: entryCount(boundaries) },
  };
}
const entryCount = (boundaries) => boundaries.chapters.reduce((sum, chapter) => sum + chapter.edits.length, 0);
