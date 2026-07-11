#!/usr/bin/env node
/**
 * 콘텐츠 무결성 린트 — prebuild에서 실행되어 회귀를 막는다.
 * 하드 실패(exit 1): 슬러그 중복, 끊어진 ch 링크, 문형 사전 필수 필드(pattern/ko/ex/ex2) 누락,
 *                    patternKo 없는 챕터 패턴, (ja) 요미가나 정렬 실패,
 *                    (P9) 챕터 레벨 초과 한자 — 학습 텍스트 필드 기준, kanjiExempt 미태깅분
 * 소프트 경고:       챕터 퀴즈 최소 요건 미달(표현문항<2·예문<4), 어휘 예문률 70% 미만
 * 사용: node scripts/check-content.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { allowedKanjiSet, KANJI_TO_LEVEL, isKanjiChar } from './kanji-levels.mjs';

// ── P9 챕터 한자 레벨 검사기 자가 테스트 (인라인 assert) ──
// N5 세트에 있는 한자(人)와 없는 한자(公=N3) 각 1개로 누적 허용 집합 동작을 확인한다.
{
  const n5 = allowedKanjiSet('N5');
  if (!n5.has('人')) throw new Error('[kanji self-test] 人(N5)가 N5 허용집합에 없음');
  if (n5.has('公')) throw new Error('[kanji self-test] 公(N3)가 N5 허용집합에 잘못 포함됨');
  if (!allowedKanjiSet('N3').has('公')) throw new Error('[kanji self-test] 公(N3)가 N3 허용집합에 없음');
  if (KANJI_TO_LEVEL.get('人') !== 'N5' || KANJI_TO_LEVEL.get('公') !== 'N3')
    throw new Error('[kanji self-test] 급 배정 불일치');
}

// P9: 한자 레벨 검사 대상 — 두 갈래로 나눠 챕터의 '일본어'를 빠짐없이 검사한다.
//
//  (A) 순수 일본어 학습 필드 — 사용자가 읽고 따라 쓰는 학습 문장. 문자열 전체가 일본어라
//      한자 런을 전부(고립 한자 포함, 예 "渋谷。") 검사한다. 한글이 섞인 문자열은 한국어
//      대조행/브리지("學生은 學校에서…", "約束=약속")라 통째로 제외.
//        section.pattern · examples[].ja · table.rows 셀 · story.body[].ja · media.line.ja
//
//  (B) 혼합 한국어 산문 필드 — 해설·훅·주석. 한국어 사이에 일본어 인용이 섞인다.
//      여기서도 '일본어 한자'는 챕터 레벨을 지켜야 한다(정책-검사 정합, P9). 다만 한국
//      한자음 브리지로 병기한 정자체 한자(學·爲·增·氣·大槪·約束=약속·(大槪) 등)를
//      오탐하면 안 되므로, '가나 인접' 여부로 일본어 런과 한국어 주석을 가른다:
//        · 한자 런 바로 앞이나 뒤에 가나(ひらがな·カタカナ·ー)가 있으면 → 일본어 인용 → 검사.
//          (예 "ちょっと待って" 待↔って, "公です" 公↔で)
//        · 앞뒤에 가나가 없으면(한글·공백·괄호·=·문장부호·경계로 둘러싸임) → 한국어 한자음
//          주석 → 면제. 이 한 규칙이 "한자+한글", "약속=약속", "(大槪)", "大槪 이런 식"을
//          모두 자연스럽게 덮는다.
//      검사 필드: heading · body · tip · pitfall · summary · vsKo · patternKo ·
//                 table.caption · examples[].note.
//
//  kanjiExempt(챕터별 문화 소재·고유명사·문자 시연)는 (A)(B) 공통으로 면제한다.
const hasHangul = s => /[가-힣]/.test(s);
const isKana = c => /[ぁ-ゖァ-ヺ]/.test(c) || c === 'ー';
// (A) 순수 일본어 학습 필드 — 한글 없는 문자열만, 한자 런 전부 검사
function collectKanjiCheckStrings(ch, out) {
  const push = s => { if (typeof s === 'string' && !hasHangul(s)) out.push(s); };
  for (const sec of (ch.sections || [])) {
    push(sec.pattern);
    for (const ex of (sec.examples || [])) if (ex) push(ex.ja);
    if (sec.table && Array.isArray(sec.table.rows))
      for (const row of sec.table.rows) if (Array.isArray(row)) for (const cell of row) push(cell);
    if (sec.story && Array.isArray(sec.story.body))
      for (const b of sec.story.body) if (b) push(b.ja);
    if (sec.media && sec.media.line) push(sec.media.line.ja);
  }
}
// (B) 혼합 한국어 산문 필드
function collectProseStrings(ch, out) {
  const push = s => { if (typeof s === 'string') out.push(s); };
  for (const sec of (ch.sections || [])) {
    push(sec.heading); push(sec.body); push(sec.tip); push(sec.pitfall);
    push(sec.summary); push(sec.vsKo); push(sec.patternKo);
    if (sec.table) push(sec.table.caption);
    for (const ex of (sec.examples || [])) if (ex) push(ex.note);
  }
}
// 산문 문자열에서 '가나 인접' 한자 런만 골라 초과분 집계
function tallyProseKanji(s, allowed, exempt, viol) {
  if (typeof s !== 'string') return;
  const a = [...s];
  for (let i = 0; i < a.length;) {
    if (!isKanjiChar(a[i])) { i++; continue; }
    let j = i; while (j < a.length && isKanjiChar(a[j])) j++;
    const before = i > 0 ? a[i - 1] : '', after = j < a.length ? a[j] : '';
    if (isKana(before) || isKana(after))          // 일본어 인용 런만 검사(한국어 주석 면제)
      for (let k = i; k < j; k++) {
        const c = a[k];
        if (!allowed.has(c) && !exempt.has(c)) viol.set(c, (viol.get(c) || 0) + 1);
      }
    i = j;
  }
}
// P9: 챕터 레벨 초과 한자를 집계((A)+(B)). kanjiExempt 문자열의 한자는 면제. → Map(kanji→등장수)
function chapterKanjiViolations(ch) {
  const allowed = allowedKanjiSet(ch.level);
  const exempt = new Set();
  for (const s of (ch.kanjiExempt || [])) for (const c of s) if (isKanjiChar(c)) exempt.add(c);
  const viol = new Map();
  const jaStrings = [];
  collectKanjiCheckStrings(ch, jaStrings);
  for (const s of jaStrings)
    for (const c of s) {
      if (!isKanjiChar(c) || allowed.has(c) || exempt.has(c)) continue;
      viol.set(c, (viol.get(c) || 0) + 1);
    }
  const proseStrings = [];
  collectProseStrings(ch, proseStrings);
  for (const s of proseStrings) tallyProseKanji(s, allowed, exempt, viol);
  return viol;
}
// ── P9 자가 테스트 ──
// (1) ja 학습 텍스트의 초과 한자(公=N3)는 검출.
// (2) 한글 섞인 table 대조행("學生은…")·ko는 (A) 제외.
// (3) 산문(B) 속 '가나 인접' 일본어 한자(待=N4, 待って)는 검출; 한국어 한자음 브리지
//     (學·爲·氣·大槪·工夫한다·約束=약속·(大槪))는 가나 비인접이라 면제.
// (4) kanjiExempt로 태깅한 문화 소재 한자(渋·谷)는 (A)(B) 공통 면제.
{
  const fake = { level: 'N5', kanjiExempt: ['渋谷'], sections: [{
    pattern: 'AはBです',
    heading: '待って — 라고 말하고 싶을 때',      // 待(N4) 가나 인접 → 검출
    examples: [
      { ja: '公です', ko: '學(한국 한자음 브리지) 설명', note: '爲·氣 병기' }, // 公(N3) 검출 / 爲·氣 면제
      { ja: 'まもなく、渋谷。', ko: '곧 시부야' },   // 渋谷 kanjiExempt 면제
    ],
    table: { rows: [['學生은 學校에서 工夫한다', '토씨']], caption: '約束=약속 표' }, // 한국어 — 면제
    tip: '大槪 이런 식, 工夫한다처럼',              // 大·槪·工·夫 가나 비인접 → 면제
  }] };
  const v = chapterKanjiViolations(fake);
  if (!v.has('公')) throw new Error('[kanji self-test] ja 학습텍스트의 초과 한자(公)를 놓침');
  if (!v.has('待')) throw new Error('[kanji self-test] 산문(heading)의 가나 인접 일본어 한자(待って)를 놓침');
  if (v.has('學') || v.has('爲') || v.has('氣') || v.has('槪') || v.has('大') || v.has('工') || v.has('夫') || v.has('約') || v.has('束'))
    throw new Error('[kanji self-test] 한국어 한자음 브리지(정자체·비가나인접)를 오탐');
  if (v.has('渋') || v.has('谷')) throw new Error('[kanji self-test] kanjiExempt 태깅 한자(渋谷)가 면제되지 않음');
}

const LANGS = {
  japanese: { g: ['ot', 'n5', 'n4', 'n3', 'n2', 'n1'], b: ['n5', 'n4', 'n3', 'n2', 'n1'], v: ['n5', 'n4', 'n3', 'n2', 'n1'] },
  english:  { g: ['ot', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'], b: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'], v: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] },
  french:   { g: ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'], b: ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'], v: ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'] },
  chinese:  { g: ['ot', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], b: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], v: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] },
};
const root = new URL('../src/content/', import.meta.url);

// ── 스토리 섹션(story) 검증 헬퍼 ──
// grammar 챕터의 story.body {ja,yomi} 대사도 examples와 동일하게 후리가나 정렬을 검사하고,
// story.questions(order/fill/produce)의 필수 필드를 게이트한다.
// 후리가나 정렬은 scripts/check-furigana.mjs의 alignFurigana와 동일 로직(그 스크립트는 examples만
// 순회하므로 story.body는 이 파일에서 동일 규약으로 직접 검사한다).
const FILL_BLANK = '［　］';
const isKanjiLike = ch => /[一-鿿々〆ヶ0-9０-９]/.test(ch);
const kataToHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const FURI_PUNCT = '。、・！？!?,. 　「」『』();（）:〜';
const isKanaCh = c => (c >= 'ぁ' && c <= 'ゖ') || c === 'ー';
const RT_BAD_START = 'んっーゃゅょぁぃぅぇぉゎ';
const UO_VOWEL = 'うくすつぬふむゆるぐずづぶぷぅゅょおこそとのほもよろをごぞどぼぽぉ';
const SMALL_KANA = 'ぁぃぅぇぉゃゅょゎっー';
const moraLen = rt => rt.reduce((n, c) => n + (SMALL_KANA.includes(c) ? 0 : 1), 0);
function alignFurigana(ja, yomiRaw) {
  if (!ja || !yomiRaw) return null;
  if (/[가-힣]/.test(yomiRaw)) return 'KO_MIXED';
  if (![...ja].some(isKanjiLike)) return 'NO_KANJI';
  const yomi = [...kataToHira(yomiRaw.replace(/[\s　]+/g, ''))];
  const segs = [];
  for (const ch of ja) {
    const t = isKanjiLike(ch) ? 'k' : 'p';
    if (segs.length && segs[segs.length - 1].t === t) segs[segs.length - 1].s += ch;
    else segs.push({ t, s: ch });
  }
  const N = yomi.length;
  const memo = new Map();
  function solve(si, yi, afterRt) {
    if (si === segs.length) {
      let j = yi;
      while (j < N && FURI_PUNCT.includes(yomi[j])) j++;
      return j === N ? { cost: 0, parts: [] } : null;
    }
    const key = (si * 4096 + yi) * 2 + (afterRt ? 1 : 0);
    if (memo.has(key)) return memo.get(key);
    const seg = segs[si];
    let best = null;
    if (seg.t === 'p') {
      const norm = kataToHira(seg.s.replace(/[\s　]+/g, ''));
      let j = yi, ok = true;
      for (const c of norm) {
        while (j < N && yomi[j] !== c && FURI_PUNCT.includes(yomi[j])) j++;
        if (j < N && yomi[j] === c) j++;
        else if (FURI_PUNCT.includes(c)) continue;
        else { ok = false; break; }
      }
      if (ok) {
        const rest = solve(si + 1, j, j === yi ? afterRt : false);
        if (rest) best = { cost: rest.cost, parts: [{ text: seg.s }, ...rest.parts] };
      }
    } else {
      let nextFirst = null;
      if (segs[si + 1]) {
        const nn = kataToHira(segs[si + 1].s.replace(/[\s　]+/g, ''));
        nextFirst = [...nn].find(c => !FURI_PUNCT.includes(c)) || null;
      }
      for (let end = N; end > yi; end--) {
        const rt = yomi.slice(yi, end);
        if (!rt.every(isKanaCh)) continue;
        if (RT_BAD_START.includes(rt[0])) continue;
        if (rt[0] === 'う' && afterRt && yi > 0 && UO_VOWEL.includes(yomi[yi - 1])) continue;
        const rest = solve(si + 1, end, true);
        if (!rest) continue;
        const d = moraLen(rt) - seg.s.length;
        const cost = rest.cost + 8 * d * d + (nextFirst && rt.includes(nextFirst) ? 1 : 0);
        if (!best || cost < best.cost)
          best = { cost, parts: [{ text: seg.s, rt: rt.join('') }, ...rest.parts] };
      }
    }
    memo.set(key, best);
    return best;
  }
  const r = solve(0, 0, false);
  return r ? r.parts : null;
}

const nonEmptyStr = x => typeof x === 'string' && x.trim().length > 0;
const STORY_Q_TYPES = new Set(['order', 'fill', 'produce']);
function multisetEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const count = new Map();
  for (const x of a) count.set(x, (count.get(x) || 0) + 1);
  for (const x of b) { const c = count.get(x) || 0; if (c <= 0) return false; count.set(x, c - 1); }
  return true;
}
/** grammar 챕터의 story 섹션 검증 — body 후리가나 + 문항 스키마. errors 배열에 push. */
function checkStorySection(sec, chSlug, errors) {
  const st = sec.story;
  // ── body: 대사(ja) 줄은 yomi 필수 + 후리가나 정렬 ──
  (st.body || []).forEach((b, i) => {
    if (b.ja == null && b.narr == null)
      errors.push(`[story ${chSlug}] body[${i}]: ja·narr 둘 다 없음`);
    if (b.ja == null) return; // 내레이션 문단
    if (b.speaker !== undefined && !nonEmptyStr(b.speaker))
      errors.push(`[story ${chSlug}] body[${i}] speaker가 비어있는 문자열: ${b.ja}`);
    if (!nonEmptyStr(b.yomi)) { errors.push(`[story ${chSlug}] body[${i}] yomi 누락: ${b.ja}`); return; }
    if (!nonEmptyStr(b.ko)) errors.push(`[story ${chSlug}] body[${i}] ko 누락: ${b.ja}`);
    if (alignFurigana(b.ja, b.yomi) === null)
      errors.push(`[furigana-story] ${chSlug} body[${i}] 요미 정렬 실패:\n    ja:   ${b.ja}\n    yomi: ${b.yomi}`);
  });
  // ── questions: order/fill/produce 필수 필드 ──
  const ids = new Set();
  const idRe = new RegExp(`^${chSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-sq\\d+$`);
  for (const q of (st.questions || [])) {
    const id = q.id || '(id 없음)';
    if (!nonEmptyStr(q.id)) errors.push(`[story ${chSlug}] 문항 id 누락`);
    else {
      if (!idRe.test(q.id)) errors.push(`[story ${chSlug}] 문항 id 형식 위반(<slug>-sqN): ${q.id}`);
      if (ids.has(q.id)) errors.push(`[story ${chSlug}] 문항 id 중복: ${q.id}`);
      ids.add(q.id);
    }
    if (!STORY_Q_TYPES.has(q.type)) { errors.push(`[story ${chSlug}] 문항 type 위반(order/fill/produce): ${q.type} (${id})`); continue; }
    if (q.type === 'order') {
      if (!nonEmptyStr(q.q)) errors.push(`[story ${chSlug}] order q 누락: ${id}`);
      if (!nonEmptyStr(q.pattern)) errors.push(`[story ${chSlug}] order pattern 누락: ${id}`);
      const tiles = Array.isArray(q.tiles) ? q.tiles : [];
      const answer = Array.isArray(q.answer) ? q.answer : [];
      if (!tiles.length || !tiles.every(nonEmptyStr)) errors.push(`[story ${chSlug}] order tiles가 비어있거나 비문자열/빈 원소: ${id}`);
      if (!answer.length || !answer.every(nonEmptyStr)) errors.push(`[story ${chSlug}] order answer가 비어있거나 비문자열/빈 원소: ${id}`);
      else if (tiles.every(nonEmptyStr) && !multisetEqual(tiles, answer)) errors.push(`[story ${chSlug}] order answer가 tiles의 순열 아님: ${id}`);
      if (!nonEmptyStr(q.ko)) errors.push(`[story ${chSlug}] order ko 누락: ${id}`);
      if (!nonEmptyStr(q.why)) errors.push(`[story ${chSlug}] order why 누락: ${id}`);
    } else if (q.type === 'fill') {
      if (!nonEmptyStr(q.q)) errors.push(`[story ${chSlug}] fill q 누락: ${id}`);
      if (!nonEmptyStr(q.pattern)) errors.push(`[story ${chSlug}] fill pattern 누락: ${id}`);
      const blanks = (String(q.ja || '').match(/［　］/g) || []).length;
      if (blanks !== 1) errors.push(`[story ${chSlug}] fill ja에 빈칸 ${FILL_BLANK} ${blanks}개(≠1): ${id}`);
      if (!nonEmptyStr(q.answer)) errors.push(`[story ${chSlug}] fill answer 누락: ${id}`);
      if (q.accept !== undefined && (!Array.isArray(q.accept) || !q.accept.every(nonEmptyStr)))
        errors.push(`[story ${chSlug}] fill accept가 배열이 아니거나 비문자열/빈 원소: ${id}`);
      if (!nonEmptyStr(q.why)) errors.push(`[story ${chSlug}] fill why 누락: ${id}`);
    } else if (q.type === 'produce') {
      if (!nonEmptyStr(q.prompt)) errors.push(`[story ${chSlug}] produce prompt 누락: ${id}`);
      if (!Array.isArray(q.model) || q.model.length < 1 || !q.model.every(nonEmptyStr))
        errors.push(`[story ${chSlug}] produce model이 비어있거나(≥1 필요) 비문자열/빈 원소: ${id}`);
      if (!nonEmptyStr(q.guide)) errors.push(`[story ${chSlug}] produce guide 누락: ${id}`);
    }
  }
}

// ── 미디어 섹션(media) 검증 헬퍼 ──
// 챕터의 '노래로 만나기' 모듈: youtubeId 형식(영숫자·-·_ 11자), line{ja,yomi} 후리가나 정렬
// (story/examples와 동일 로직 재사용), songTitle/artist 필수를 게이트한다.
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
function checkMediaSection(sec, chSlug, errors) {
  const m = sec.media;
  if (!YT_ID_RE.test(m.youtubeId || ''))
    errors.push(`[media ${chSlug}] youtubeId 형식 위반(영숫자·-·_ 11자): ${m.youtubeId}`);
  if (!nonEmptyStr(m.songTitle)) errors.push(`[media ${chSlug}] songTitle 누락`);
  if (!nonEmptyStr(m.artist)) errors.push(`[media ${chSlug}] artist 누락`);
  const ln = m.line;
  if (!ln || typeof ln !== 'object') { errors.push(`[media ${chSlug}] line 누락`); return; }
  if (!nonEmptyStr(ln.ja)) errors.push(`[media ${chSlug}] line.ja 누락`);
  if (!nonEmptyStr(ln.yomi)) errors.push(`[media ${chSlug}] line.yomi 누락`);
  if (!nonEmptyStr(ln.ko)) errors.push(`[media ${chSlug}] line.ko 누락`);
  if (nonEmptyStr(ln.ja) && nonEmptyStr(ln.yomi) && alignFurigana(ln.ja, ln.yomi) === null)
    errors.push(`[furigana-media] ${chSlug} line 요미 정렬 실패:\n    ja:   ${ln.ja}\n    yomi: ${ln.yomi}`);
}

const errors = [];
const warns = [];

for (const [lang, cfg] of Object.entries(LANGS)) {
  // ── 챕터: 슬러그 중복 + 퀴즈 최소 요건 + patternKo ──
  const slugs = new Set();
  for (const lv of cfg.g) {
    const m = await import(new URL(`${lang}/grammar/${lv}.js`, root));
    for (const ch of m.default) {
      if (slugs.has(ch.slug)) errors.push(`[${lang}/${lv}] 슬러그 중복: ${ch.slug}`);
      slugs.add(ch.slug);
      const own = (ch.sections || []).filter(s => s.pattern && s.patternKo).length;
      const noKo = (ch.sections || []).filter(s => s.pattern && !s.patternKo).length;
      const exs = (ch.sections || []).flatMap(s => s.examples || []).filter(e => e && e.ko).length;
      if (noKo > 0) errors.push(`[${lang}/${lv}] ${ch.slug}: patternKo 없는 패턴 ${noKo}개`);
      if (own < 2) warns.push(`[${lang}/${lv}] ${ch.slug}: 퀴즈 표현 문항 부족 (${own})`);
      if (exs < 4) warns.push(`[${lang}/${lv}] ${ch.slug}: 예문 부족 (${exs})`);
      // ── P9 챕터 한자 레벨 검사 (japanese grammar 전용) — 오류로 게이트화(교정 웨이브 후 승격) ──
      // 학습 텍스트 필드(pattern·examples[].ja·table·story.body[].ja·media.line.ja)에 챕터 레벨
      // 초과 한자가 있으면 실패. 문화 소재·고유명사·문자 학습 시연 등은 각 챕터 kanjiExempt로 면제.
      if (lang === 'japanese') {
        const viol = chapterKanjiViolations(ch);
        if (viol.size) {
          const total = [...viol.values()].reduce((a, b) => a + b, 0);
          const list = [...viol.entries()].sort((a, b) => b[1] - a[1])
            .map(([k, n]) => `${k}(${KANJI_TO_LEVEL.get(k) || '非JLPT'}·${n})`).join(' ');
          errors.push(`[kanji ${lang}/${lv}] ${ch.slug}(레벨 ${ch.level}) 초과 한자 ${viol.size}종·${total}회: ${list}\n    → ja 표기를 가나로 바꾸거나, 문화 소재·고유명사면 챕터 kanjiExempt에 추가하세요.`);
        }
      }
      // ── 스토리 섹션(story) — body 후리가나 + 문항 스키마 게이트 ──
      for (const sec of (ch.sections || [])) if (sec.story) checkStorySection(sec, ch.slug, errors);
      // ── 미디어 섹션(media) — youtubeId·line 후리가나·songTitle/artist 게이트 ──
      for (const sec of (ch.sections || [])) if (sec.media) checkMediaSection(sec, ch.slug, errors);
    }
  }
  // ── 문형 사전: ch 유효성 + 필수 필드 ──
  for (const lv of cfg.b) {
    const m = await import(new URL(`${lang}/bunkei/${lv}.js`, root));
    for (const t of m.default.themes || []) {
      for (const it of t.items || []) {
        const id = `[${lang}/bunkei/${lv}] ${it.pattern || '(패턴 없음)'}`;
        if (!it.pattern) errors.push(`${id}: pattern 누락`);
        if (!it.ko) errors.push(`${id}: ko 누락`);
        if (!it.ex) errors.push(`${id}: ex 누락`);
        if (!it.ex2) errors.push(`${id}: ex2 누락`);
        if (it.ch && !slugs.has(it.ch)) errors.push(`${id}: 끊어진 ch → ${it.ch}`);
      }
    }
  }
  // ── 어휘: 예문률 ──
  for (const lv of cfg.v) {
    const m = await import(new URL(`${lang}/vocab/${lv}.js`, root));
    const words = (m.default.themes || []).flatMap(t => t.words || []);
    if (!words.length) continue;
    const exPct = Math.round(words.filter(w => w.ex).length / words.length * 100);
    if (exPct < 70) warns.push(`[${lang}/vocab/${lv}] 예문률 ${exPct}% (<70%)`);
  }
}

// ── (ja) 요미가나 정렬 — 기존 스크립트를 파일별로 실행 ──
const jaFiles = [
  ...LANGS.japanese.g.map(l => `src/content/japanese/grammar/${l}.js`),
  ...LANGS.japanese.b.map(l => `src/content/japanese/bunkei/${l}.js`),
  // vocab은 보강 파일(n5_jlpt_a 등)까지 전부 — 하드코딩 목록이면 신규 파일이 감시망 밖으로 샌다.
  ...readdirSync('src/content/japanese/vocab').filter(f => f.endsWith('.js')).map(f => `src/content/japanese/vocab/${f}`),
];
let furiFail = 0;
for (const f of jaFiles) {
  const r = spawnSync('node', ['scripts/check-furigana.mjs', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    furiFail++;
    errors.push(`[furigana] ${f}:\n${(r.stdout || '').trim()}`);
  }
}


// ── 챕터→어휘 커버리지 회귀 가드 (en/fr) ──
// 규칙: 챕터 예문의 내용어는 같은 레벨 이하 어휘 사전에 수록되어야 한다.
// 휴리스틱 잔여(활용형·고유명사 등)가 있으므로, 기준선 초과 시에만 경고한다.
const EN_STOP = new Set(`a an the this that these those i you he she it we they me him her us them my your his its our their mine yours hers ours theirs myself yourself himself herself itself ourselves themselves yourselves who whom whose which what where when why how is are was were be been being am do does did done doing have has had having will would shall should can could may might must let lets not no nor and or but so yet for of in on at by to from with without about against between into through during before after above below up down out off over under again further then once here there all any both each few more most other some such only own same than too very just if because as until while s t don didn doesn isn aren wasn weren hasn haven hadn won wouldn shouldn couldn mustn needn ll ve re d m im id ive youre hes shes its were theyre`.split(/\s+/));
const FR_STOP = new Set(`le la les un une des du de d l au aux et ou mais donc or ni car que qu qui quoi dont où je tu il elle on nous vous ils elles me te se m t s moi toi lui leur eux y en ne pas plus jamais rien personne mon ma mes ton ta tes son sa ses notre nos votre vos leurs ce cet cette ces ça cela ceci est sont était étaient été être suis es sommes êtes serai sera seront serait a ont avait avaient eu avoir ai as avons avez aura auront aurait dans sur sous avec sans pour par chez vers entre depuis pendant avant après très bien là ici si oui non aussi comme alors quand parce`.split(/\s+/));

const COVER = {
  english: { field: 'en', stop: EN_STOP, otPool: 'a1',
    // 기준선: 2026-06 전수 수록 후 잔여 노이즈 + 여유 10
    base: { ot: 18, a1: 26, a2: 50, b1: 49, b2: 58, c1: 44, c2: 45 },
    lemmas: w => { const o = [w]; if (w.endsWith('ies')) o.push(w.slice(0,-3)+'y'); if (w.endsWith('es')) o.push(w.slice(0,-2)); if (w.endsWith('s')) o.push(w.slice(0,-1)); if (w.endsWith('ed')) o.push(w.slice(0,-2), w.slice(0,-1)); if (w.endsWith('ing')) o.push(w.slice(0,-3), w.slice(0,-3)+'e'); return o; },
    tokenize: t => (t.toLowerCase().match(/[a-z']+/g) || []).map(w => w.replace(/^'+|'+$/g, '')) },
  french: { field: 'fr', stop: FR_STOP, otPool: null,
    base: { a0: 20, a1: 40, a2: 72, b1: 107, b2: 95, c1: 60, c2: 65 },
    lemmas: w => { const o = [w]; if (w.endsWith('s')) o.push(w.slice(0,-1)); if (w.endsWith('e')) o.push(w.slice(0,-1)+'er'); if (w.endsWith('es')) o.push(w.slice(0,-2)+'er'); if (w.endsWith('ent')) o.push(w.slice(0,-3)+'er'); if (/ée?s?$/.test(w)) o.push(w.replace(/ée?s?$/, 'er')); return o; },
    tokenize: t => (t.toLowerCase().replace(/['\u2019]/g, "'").match(/[a-zàâçéèêëîïôùûüœæ'-]+/g) || []).flatMap(w => w.split(/['-]/)).filter(Boolean) },
};

for (const [lang, cv] of Object.entries(COVER)) {
  const cfg = LANGS[lang];
  const vocabSets = {};
  for (const lv of cfg.v) {
    const m = await import(new URL(`${lang}/vocab/${lv}.js`, root));
    const set = new Set();
    for (const w of (m.default.themes || []).flatMap(t => t.words || []))
      for (const tok of cv.tokenize(w[cv.field] || '')) if (!cv.stop.has(tok)) set.add(tok);
    vocabSets[lv] = set;
  }
  for (const lv of cfg.g) {
    const idx = cfg.v.indexOf(lv === 'ot' ? cv.otPool : lv);
    const pool = new Set();
    for (let i = 0; i <= Math.max(idx, 0); i++) for (const w of vocabSets[cfg.v[i]]) pool.add(w);
    const m = await import(new URL(`${lang}/grammar/${lv}.js`, root));
    const missing = new Set();
    for (const ch of m.default)
      for (const ex of (ch.sections || []).flatMap(sec => sec.examples || [])) {
        const text = ex[cv.field]; if (!text) continue;
        for (const tok of cv.tokenize(text)) {
          if (tok.length < 2 || cv.stop.has(tok)) continue;
          if (!cv.lemmas(tok).some(l => pool.has(l))) missing.add(tok);
        }
      }
    const allow = cv.base[lv] ?? 0;
    if (missing.size > allow)
      warns.push(`[${lang}/${lv}] 챕터 어휘 커버리지 회귀 — 미수록 후보 ${missing.size} > 기준선 ${allow} (새 예문 단어를 어휘 사전에 추가하세요)`);
  }
}

for (const w of warns) console.warn('⚠', w);
for (const e of errors) console.error('✗', e);
console.log(`\n콘텐츠 린트 — 오류 ${errors.length} · 경고 ${warns.length} (요미가나 검사 ${jaFiles.length}파일 중 실패 ${furiFail})`);
process.exit(errors.length ? 1 : 0);
