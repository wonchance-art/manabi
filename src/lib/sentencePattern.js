// [문장] 탭 패턴 카드의 재료 — 문형 사전(src/content/{chinese,japanese}/bunkei)에서 이 문장이 쓰는 문형을 고르고,
// 공식을 칸으로 나누고, 원문 위 표시(고정 글자 · 자리)를 만든다. 순수 함수만 둔다(목업 U 4판 · 오너 10-24).
//
// 고르기는 두 겹이다.
// ① 사전 후보(결정적, 요청 0): 「한자」 탭과 같은 전체 커널 스캔(allKernels)으로 이 문장 토큰에 걸린 문형을 모으고,
//    공식의 고정 글자가 문장에 모두 있는 것만 남긴 뒤 「맞은 고정 글자 수 → 사전 순서(쉬운 급수 먼저)」로 줄 세운다.
//    한 글자 표지(很 · 是)는 문법 표시 밑줄에서는 배경이라 버리지만, 한 문장 안에서 고르는 일에는 필요하다.
// ② AI 고르기: 번역 요청 하나에 후보 목록을 실어 보내고(sentenceTranslation), 모델이 번호와 칸 대응(주어=今天天气)을
//    돌려준다. 사전에 맞는 것이 없으면 공식 · 뜻 · 예문을 직접 쓴다 — 그때는 급수 · 담기 · 목록 링크가 없다(근거 없는 급수 금지).
// 캐시된 옛 번역 · 교재 뜻(요청 0)처럼 AI 답이 없으면 ①의 첫 후보를 쓰고 원문에는 고정 글자만 굵게 한다.
// 이 파일은 의존 없는 순수 함수만 둔다 — 서버 화면(문법 복습)도 읽는다. 스캔 · 인덱스 적재는 sentencePatternScan.js.

const FIXED_RUN = /[぀-ヿ一-鿿々]+(?:[/・][぀-ヿ一-鿿々]+)*/gu;
const PUNCT = /^[\s,，、。.!！?？()（）]*$/u;

/** 사전 후보 상한 — 프롬프트에 싣는 줄 수(把는 혼자 14개). */
export const PATTERN_CANDIDATE_LIMIT = 8;
/** 카드 상한 — AI가 둘을 골라도 세 번째는 그리지 않는다. */
export const PATTERN_CARD_LIMIT = 2;

/**
 * 공식 → 칸. slot = 자리 이름(주어 · 형용사 · A · 〜 · …), fixed = 고정 글자(去/来처럼 고르는 꼴은 한 칸).
 * 「(+ 呢)」 같은 선택 요소는 optional 칸이 된다(문장에 없어도 된다).
 * @returns {Array<{kind:'slot'|'fixed', text:string, optional?:boolean}>}
 */
export function patternCells(pattern) {
  const cells = [];
  const src = String(pattern || '').replace(/\(\s*\+\s*/gu, '+ (');
  for (const part of src.split(/\s*\+\s*/u)) {
    for (const piece of part.split(/\s+/u)) {
      if (!piece) continue;
      const optional = /^[(（]/u.test(piece);
      let at = 0;
      for (const m of piece.matchAll(FIXED_RUN)) {
        const slot = piece.slice(at, m.index).replace(/[()（）,，、]/gu, '').trim();
        if (slot && !PUNCT.test(slot)) cells.push({ kind: 'slot', text: slot });
        cells.push(optional ? { kind: 'fixed', text: m[0], optional: true } : { kind: 'fixed', text: m[0] });
        at = m.index + m[0].length;
      }
      const tail = piece.slice(at).replace(/[()（）,，、]/gu, '').trim();
      if (tail && !PUNCT.test(tail)) cells.push({ kind: 'slot', text: tail });
    }
  }
  return cells;
}

const alternativesOf = (fixed) => fixed.split(/[/・]/u).filter(Boolean);

/**
 * 고정 글자 칸마다 문장에서 찾은 꼴(앞에서부터 차례로). 하나라도 못 찾으면 null — 이 문장의 문형이 아니다.
 * bounds(토큰 경계 시작 · 끝 위치 집합)를 주면 그 경계에 맞는 자리만 친다 — 중국어 除了의 了가 「동사 + 了」로 잡히지 않게.
 * 일본어는 활용 어미(〜てから)가 토큰 안팎에 걸쳐 경계를 주지 않는다.
 */
export function locateFixedCells(cells, text, bounds = null) {
  const s = String(text || '');
  const found = [];
  let cursor = 0;
  const fits = (at, end) => !bounds || (bounds.starts.has(at) && bounds.ends.has(end));
  for (const cell of cells) {
    if (cell.kind !== 'fixed') continue;
    let best = null;
    for (const alt of alternativesOf(cell.text)) {
      for (let at = s.indexOf(alt, cursor); at >= 0; at = s.indexOf(alt, at + 1)) {
        if (!fits(at, at + alt.length)) continue;
        if (!best || at < best.start) best = { start: at, end: at + alt.length, text: alt };
        break;
      }
    }
    if (!best) {
      if (cell.optional) continue;
      return null;
    }
    found.push(best);
    cursor = best.end;
  }
  return found;
}

/** 토큰 → 경계 위치 집합(locateFixedCells bounds). */
export function tokenBounds(tokens) {
  const starts = new Set(), ends = new Set();
  let at = 0;
  for (const t of tokens || []) {
    const len = String(t?.text || '').length;
    starts.add(at);
    at += len;
    ends.add(at);
  }
  return { starts, ends };
}

/** 사전 항목의 담기 열쇠 — grammar_review slug(`bk:` 접두, 레벨 + 공식). 문형 사전 표기가 바뀌지 않는 한 같다. */
export const PATTERN_SLUG_PREFIX = 'bk:';
export function patternSlug(entry) {
  return entry?.level && entry?.pattern ? `${PATTERN_SLUG_PREFIX}${entry.level}:${entry.pattern}` : null;
}
export function parsePatternSlug(slug) {
  if (typeof slug !== 'string' || !slug.startsWith(PATTERN_SLUG_PREFIX)) return null;
  const rest = slug.slice(PATTERN_SLUG_PREFIX.length);
  const at = rest.indexOf(':');
  return at > 0 ? { level: rest.slice(0, at), pattern: rest.slice(at + 1) } : null;
}
export const isPatternSlug = (slug) => !!parsePatternSlug(slug);

/** 레벨 문형 목록의 항목 앵커 — 공식 문자열의 짧은 해시(FNV-1a). 목록 순서가 바뀌어도 링크가 같은 항목을 연다. */
export function patternAnchor(pattern) {
  let h = 0x811c9dc5;
  for (const ch of String(pattern || '')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `bk-${h.toString(36)}`;
}

/** 레벨 문형 목록 주소 + 앵커 — 'H1' → /chinese/bunkei/h1#bk-…, 'N4' → /japanese/bunkei/n4#bk-…. */
export function patternListHref(entry) {
  const level = String(entry?.level || '');
  const base = /^H[1-6]$/u.test(level) ? '/chinese/bunkei/' : /^N[1-5]$/u.test(level) ? '/japanese/bunkei/' : null;
  return base && entry?.pattern ? `${base}${level.toLowerCase()}#${patternAnchor(entry.pattern)}` : null;
}

/** 급수 태그 — 'H1' → 'HSK 1', 'N4' → 'JLPT N4'. */
export function patternLevelTag(level) {
  const l = String(level || '');
  if (/^H[1-6]$/u.test(l)) return `HSK ${l.slice(1)}`;
  if (/^N[1-5]$/u.test(l)) return `JLPT ${l}`;
  return '';
}

/* ── 번역 요청에 싣는 문형 칸 ─────────────────────────────────────────────── */

/** 프롬프트 후보 줄 — `번호 | 공식 | 뜻`. */
export function formatPatternCandidates(candidates) {
  return (candidates || []).map((entry, i) => `${i + 1} | ${entry.pattern} | ${entry.ko}`).join('\n');
}

/**
 * 번역 프롬프트 뒤에 붙는 문형 칸 지시 — 형식 블록과 규칙 블록. 후보가 없어도 「직접 쓰기」로 문형을 받는다.
 * @param {string} language materialLang
 * @param {Array<object>} candidates sentencePatternCandidates 산출
 */
export function buildPatternPromptBlock(language, candidates) {
  const list = formatPatternCandidates(candidates);
  const reading = language === 'Chinese' ? ' / 병음' : language === 'Japanese' ? ' / 요미' : '';
  return {
    format: `**문형**
${list ? '번호: (아래 후보 중 이 문장이 쓰는 문형 번호. 둘이면 「2, 5」, 최대 2개)\n' : ''}공식: (${list ? '후보에 맞는 것이 없을 때만 ' : ''}이 문장의 핵심 문형을 「주어 + 很 + 형용사」처럼 자리 이름과 고정 글자로)
뜻: (공식을 쓴 경우만 — 문형의 뜻 한 줄)
예문: (공식을 쓴 경우만 — 같은 문형의 다른 짧은 예문${reading} / 한국어 뜻)
칸: (자리 이름 또는 고정 글자=이 문장의 해당 부분을 「 | 」로 — 예: 주어=今天天气 | 很=很 | 형용사=好)`,
    rules: `${list ? `## 문형 후보 (번호 | 공식 | 뜻)\n${list}\n\n` : ''}문형 규칙: 칸의 오른쪽은 이 문장에 있는 글자 그대로. 문형이라 할 만한 구조가 없으면 **문형** 항목(제목 포함)을 통째로 생략`,
  };
}

const FIELD = /^\s*(번호|공식|뜻|예문|칸)\s*[:：]\s*(.*?)\s*$/u;

/**
 * 번역 결과에서 문형 칸을 떼어 낸다.
 * @returns {{text:string, pick:null|{numbers:number[], formula:string, ko:string, ex:null|{text:string, reading:string, ko:string}, slots:Array<{label:string, text:string}>}}}
 */
export function splitPatternSection(raw) {
  const lines = String(raw || '').split('\n');
  const start = lines.findIndex((l) => /^\s*\*\*\s*문형\s*\*\*\s*$/u.test(l));
  if (start < 0) return { text: String(raw || ''), pick: null };
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) if (/^\s*\*\*.+\*\*\s*$/u.test(lines[i])) { end = i; break; }
  const fields = {};
  for (const line of lines.slice(start + 1, end)) {
    const m = FIELD.exec(line.replace(/\*\*/gu, ''));
    if (m && m[2] && !/^\(.*\)$/u.test(m[2])) fields[m[1]] = m[2];
  }
  const text = [...lines.slice(0, start), ...lines.slice(end)].join('\n').replace(/\n{3,}/gu, '\n\n').trim();
  const numbers = (fields['번호'] || '').match(/\d+/gu)?.map(Number).slice(0, PATTERN_CARD_LIMIT) || [];
  const slots = (fields['칸'] || '').split(/\s*[|｜]\s*/u).map((pair) => {
    const at = pair.search(/[=＝]/u);
    return at > 0 ? { label: pair.slice(0, at).trim(), text: pair.slice(at + 1).trim() } : null;
  }).filter((s) => s?.label && s.text);
  const exParts = (fields['예문'] || '').split(/\s+\/\s+/u).map((s) => s.trim());
  const ex = exParts[0] ? { text: exParts[0], reading: exParts.length > 2 ? exParts[1] : '', ko: exParts.length > 2 ? exParts[2] : exParts[1] || '' } : null;
  const formula = fields['공식'] || '';
  if (!numbers.length && !formula) return { text, pick: null };
  return { text, pick: { numbers, formula, ko: fields['뜻'] || '', ex, slots } };
}

/**
 * 그릴 카드 — AI 번호가 가리키는 사전 항목(후보 범위 안만), 없으면 AI 공식, 그도 없으면 사전 첫 후보.
 * dictionary 카드는 사전의 뜻 · 주의 · 예문을 쓰고 AI는 칸 대응만 맡는다.
 * @returns {Array<{key:string, entry:object|null, pattern:string, cells:Array, ko:string, note:string, ex:object|null, slots:Array}>}
 */
export function resolvePatternCards({ candidates = [], pick = null } = {}) {
  const fromEntry = (entry, slots = []) => ({
    key: entry.id, entry, pattern: entry.pattern, cells: patternCells(entry.pattern), ko: entry.ko, note: entry.note || '',
    ex: exampleOf(entry.ex), slots,
  });
  if (pick?.numbers?.length) {
    const picked = pick.numbers.map((n) => candidates[n - 1]).filter(Boolean);
    const unique = picked.filter((entry, i) => picked.findIndex((e) => e.id === entry.id) === i);
    if (unique.length) return unique.slice(0, PATTERN_CARD_LIMIT).map((entry, i) => fromEntry(entry, i === 0 ? pick.slots : []));
  }
  if (pick?.formula) {
    const cells = patternCells(pick.formula);
    if (cells.some((c) => c.kind === 'fixed') && cells.some((c) => c.kind === 'slot')) {
      return [{ key: `ai:${pick.formula}`, entry: null, pattern: pick.formula, cells, ko: pick.ko, note: '', ex: pick.ex, slots: pick.slots }];
    }
  }
  return candidates.length ? [fromEntry(candidates[0])] : [];
}

/** 사전 예문 { zh|ja, pinyin|yomi, ko } → { text, reading, ko }. */
export function exampleOf(ex) {
  const text = ex?.zh || ex?.ja;
  return text ? { text, reading: ex.pinyin || ex.yomi || '', ko: ex.ko || '' } : null;
}

/**
 * 원문 위 표시 — 고정 글자(굵게 + 진한 밑줄) · 자리(옅은 밑줄 + 작은 이름) · 누른 단어(칠). 겹치지 않는 묶음으로 원문 전체를 덮는다.
 * 자리 표시는 AI 칸 대응이 있을 때만(추측 금지) — 없으면 고정 글자만.
 * @param {{text:string, card?:object|null, term?:{start:number,end:number}|null}} input
 * @returns {Array<{kind:'plain'|'fixed'|'slot', label?:string, pieces:Array<{text:string, term:boolean}>}>}
 */
export function sentencePatternMarks({ text, card = null, term = null, bounds = null } = {}) {
  const s = String(text || '');
  const ranges = [];
  if (card) {
    const fixedTexts = new Set(card.cells.filter((c) => c.kind === 'fixed').flatMap((c) => alternativesOf(c.text)));
    if (card.slots?.length) {
      let cursor = 0;
      for (const slot of card.slots) {
        const at = s.indexOf(slot.text, cursor);
        if (at < 0) continue;
        const kind = fixedTexts.has(slot.text) || fixedTexts.has(slot.label) ? 'fixed' : 'slot';
        ranges.push({ start: at, end: at + slot.text.length, kind, label: kind === 'slot' ? slot.label : undefined });
        cursor = at + slot.text.length;
      }
    }
    // AI가 칸에 고정 글자를 안 적었으면(자리 이름만) 고정 글자는 사전 공식으로 찾아 겹치지 않는 자리에 더한다.
    if (!ranges.some((r) => r.kind === 'fixed')) {
      for (const f of locateFixedCells(card.cells, s, bounds) || []) {
        if (!ranges.some((r) => f.start < r.end && r.start < f.end)) ranges.push({ start: f.start, end: f.end, kind: 'fixed' });
      }
    }
  }
  const groups = [];
  let at = 0;
  const push = (start, end, kind, label) => {
    if (end <= start) return;
    const pieces = [];
    const cuts = [start, end, ...(term ? [term.start, term.end] : [])].filter((c) => c >= start && c <= end);
    const points = [...new Set(cuts)].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i], b = points[i + 1];
      if (b > a) pieces.push({ text: s.slice(a, b), term: !!term && a >= term.start && b <= term.end });
    }
    groups.push(label ? { kind, label, pieces } : { kind, pieces });
  };
  for (const r of ranges.sort((a, b) => a.start - b.start)) {
    if (r.start < at) continue;
    push(at, r.start, 'plain');
    push(r.start, r.end, r.kind, r.label);
    at = r.end;
  }
  push(at, s.length, 'plain');
  // 표시 칸 바로 뒤 닫는 문장부호(。，」 …)는 칸에 붙인다(tail) — 칸이 한 덩어리라 부호만 다음 줄로 떨어지지 않게.
  for (let i = 0; i < groups.length - 1; i += 1) {
    const next = groups[i + 1], first = next.pieces[0];
    if (groups[i].kind === 'plain' || next.kind !== 'plain' || !first || first.term) continue;
    const tail = /^[\p{Pe}\p{Pf}\p{Po}]+/u.exec(first.text)?.[0];
    if (!tail) continue;
    groups[i].tail = tail;
    if (tail.length === first.text.length) next.pieces.shift(); else next.pieces[0] = { ...first, text: first.text.slice(tail.length) };
  }
  return groups.filter((g) => g.pieces.length || g.kind !== 'plain');
}
