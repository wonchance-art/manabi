// Wikisource 정본 책(LIT-SRC-WS-1, 오너 「같이해. 위 3편+3편+1편(레미제라블 추가). 간체와 번체 옵션 같이」 2026-10-17 KST)
// — 저장·네트워크 없는 순수 함수.
//
// 출처: 위키문헌(zh · fr · ko.wikisource.org)의 교정본. 원문은 퍼블릭 도메인이고, 위키문헌의 전사·교정 기여는
// CC BY-SA 4.0이라 출처 줄에 위키문헌과 라이선스를 밝힌다. 원문은 리포에 고정한다: 쪽마다 렌더된 본문 조각을 source/에 두고
// SHA-256과 위키 판 번호(revid)를 entry.json에 적는다(scripts/literature/ws-add-work.mjs) — 바뀌면 빌드가 실패한다.
//
// 중국어는 같은 교정본을 위키문헌 글자 변환기로 간체(zh-hans)·번체(zh-hant) 두 벌 받는다. 정본(분석·단어장·복습 기준)은 간체 한 벌이고,
// 번체는 같은 자리 같은 길이의 글자로만 다르다(빌드가 문단마다 길이를 대조 — 어긋나면 그 작품은 실패). 그래서 분석은 한 번이고,
// 번체로 읽을 때는 같은 토큰 자리에 번체 글자를 보여 준다 — 저장하는 단어는 간체 표제어 하나라 복습이 둘로 갈리지 않는다.
// 중국어 교정본의 고유명사 밑줄(专名线)·책 이름 물결줄은 장마다 nameMarks로 남긴다 — 경계 미리 묶기(literature-boundaries)가
// 아오조라 저자 루비처럼 쓴다(쪼개지는 이름 → 「한 단어로 묶기」 기록).
//
// 장 나눔: 위키문헌의 쪽 하나(단편 · 장)가 기본 단위. 학습 한 번 분량을 넘으면 그 쪽 안에서 문단 경계로 고르게 나눈다 — 프랑스어는
// 단어 수(WS_TARGET.French), 중국어는 글자 수(WS_TARGET.Chinese). 문단 한가운데는 자르지 않는다.

export const WS_PROVIDER = 'wikisource';
export const WS_BOOK_VERSION = 1;
export const WS_LICENSE = 'CC-BY-SA-4.0';
export const WS_WIKIS = Object.freeze({
  zh: { language: 'Chinese', host: 'zh.wikisource.org' },
  fr: { language: 'French', host: 'fr.wikisource.org' },
  // 한국 근대 문학(오너 「한국 근대 문학도 추가」 → 「베스트 5만」 2026-10-17 KST) — 현대 맞춤법 전사본(한자는 괄호 병기 그대로)
  ko: { language: 'Korean', host: 'ko.wikisource.org' },
});
// 장 하나 분량 — 프랑스어 단어 수 · 중국어·한국어 글자 수(공백 뺌)
export const WS_TARGET = Object.freeze({ French: 2200, Chinese: 2500, Korean: 3000 });
export const WS_EDITS = Object.freeze(['chapter-split-by-manabi', 'typography-normalized', 'illustrations-omitted', 'notes-omitted']);
export const WS_SCRIPT = Object.freeze({ canonical: 'zh-hans', alternate: 'zh-hant' });
// 판정 규칙이 있는 원산국 — 보호기간(사후 n년). 프랑스는 「mort pour la France」면 +30년(전쟁 연장 — 작품마다 적는다, fail-closed).
export const WS_ORIGIN_TERMS = Object.freeze({ CN: 50, FR: 70, KR: 70 });

const KEY_PATTERN = /^ws-(zh|fr|ko)-[a-z0-9]+(?:-[a-z0-9]+)*_[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const NAME_OPEN = '';
const NAME_CLOSE = '';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', thinsp: ' ', hellip: '…', laquo: '«', raquo: '»' };
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (whole, name) => {
    if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
    if (Object.hasOwn(ENTITIES, name)) return ENTITIES[name];
    throw new Error(`모르는 문자 참조 ${whole}`);
  });
}

/** 보이지 않는 조판 문자 정리 — 폭 없는 공백·연한 하이픈은 지우고, 고정 공백·좁은 공백(프랑스어 문장부호 앞)은 보통 공백으로. */
const normalizeTypography = (text) => text.replace(/[​‌‍⁠­﻿]/gu, '').replace(/[    ]/gu, ' ');

/** 같은 깊이의 닫는 태그까지(div·span·ol 등) — 시작 위치의 요소 하나를 통째로. 못 찾으면 null. */
function balanced(html, start, tag) {
  const pattern = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'gu');
  pattern.lastIndex = start;
  let depth = 0;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    if (match[2]) { if (depth === 0) return html.slice(start, match.index + match[0].length); continue; }
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index + match[0].length);
  }
  return null;
}

/** 여는 태그가 test(여는 태그 문자열)에 맞는 요소를 모두 지운다(중첩 포함). */
function removeElements(html, tag, test) {
  const open = new RegExp(`<${tag}\\b[^>]*>`, 'gu');
  let out = html;
  for (;;) {
    open.lastIndex = 0;
    let found = null;
    for (let match = open.exec(out); match; match = open.exec(out)) if (test(match[0])) { found = match; break; }
    if (!found) return out;
    const element = balanced(out, found.index, tag);
    if (!element) throw new Error(`<${tag}>를 닫지 못했다`);
    out = out.slice(0, found.index) + out.slice(found.index + element.length);
  }
}

const NOISE_DIV = /\b(?:id="(?:headertemplate|subheader|ws-data)"|class="[^"]*\b(?:ws-noexport|skin-invert|mw-references-wrap|references|noprint|licenseContainer|licensetpl)\b)/u;
// 장면 바꿈 장식 줄(한국어 위키문헌 「🙝🙟」 · 「＊ ＊ ＊」 · 프랑스어 「⁂」) — 모두 「⁂」 한 글자 문단으로 맞춘다(글자 정리)
const ORNAMENT_ONLY = /^[\s\u{1F650}-\u{1F67F}*＊⁂]+$/u;
const SCENE_BREAK = '⁂';
const INLINE_TAGS = 'span|i|b|em|strong|small|big|abbr|sup|sub|a|time|u|s|q|cite|var|dfn|bdi|font';

/** 블록 안쪽 → 글자(<br>만 줄바꿈으로 살린다). 남은 태그가 있으면 throw — 모르는 구조를 글자로 흘리지 않는다. */
function blockText(inner) {
  const marked = inner
    .replace(/<span style="text-decoration:\s*underline[^"]*"[^>]*>([^<]*)<\/span>/gu, `${NAME_OPEN}$1${NAME_CLOSE}`)
    .replace(/\s+/gu, ' ')
    .replace(/<br\s*\/?>/gu, '\n')
    .replace(new RegExp(`</?(?:${INLINE_TAGS})\\b[^>]*>`, 'gu'), '');
  if (/[<>]/u.test(marked)) throw new Error(`본문 블록에 모르는 태그가 있다: ${marked.slice(0, 80)}`);
  return normalizeTypography(decodeEntities(marked)).split('\n').map((line) => line.replace(/ {2,}/gu, ' ').trim()).filter(Boolean).join('\n');
}

/**
 * 위키문헌 본문 조각(ws-add-work가 저장한 것) → {headings, blocks}. 머리·꼬리 틀, 쪽 번호, 삽화, 각주 번호와 각주 목록,
 * 장식 첫 글자(lettrine)의 빈 칸은 뺀다. 제목(h2–h6)은 headings로 따로 모으고 본문에서 뺀다. 블록 = <p> 또는 글자만 담은 <div>
 * (가운데 줄 「VIVE LA FRANCE !」·날짜 서명). 블록마다 이름 표시(中 专名线)는 {start, end} 자리로 돌려준다(블록 글자 좌표).
 * 알려진 블록 밖에 글자가 남으면 throw — 모르는 구조의 본문이 조용히 사라지지 않게(fail-closed).
 */
export function parseWikisourceFragment(fragment) {
  if (!/^<div class="(?:prp-pages-output|mw-content-ltr mw-parser-output)"/u.test(fragment.trim())) throw new Error('위키문헌 본문 조각이 아니다');
  let html = fragment.trim().replace(/^<div[^>]*>/u, '').replace(/<\/div>\s*$/u, '');
  html = html
    .replace(/<style\b[\s\S]*?<\/style>/gu, '')
    .replace(/<(?:link|meta)\b[^>]*>/gu, '')
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/<figure\b[\s\S]*?<\/figure>/gu, '')
    .replace(/<span><span class="pagenum ws-pagenum"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?<\/span><\/span>/gu, '')
    .replace(/<span class="pagenum ws-pagenum"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?<\/span>/gu, '')
    .replace(/<span itemprop="associatedMedia"[^>]*><\/span>/gu, '')
    .replace(/<span style="font-size:0; line-height:0; display:block" class="lettrine"><br\s*\/?><\/span>/gu, '');
  html = html.replace(/<table\b[\s\S]*?<\/table>/gu, tableToBlock);
  html = removeElements(html, 'sup', (open) => /class="reference"/u.test(open));
  html = removeElements(html, 'ol', (open) => /class="references"/u.test(open));
  html = removeElements(html, 'div', (open) => NOISE_DIV.test(open));
  const headings = [];
  // 제목 안 간격 div(쥘 베른 「I<div/>dans lequel…」)는 줄바꿈, 작은 대문자(sc)는 실제 대문자로 — 화면의 제목 그대로
  const headingText = (inner) => blockText(inner
    .replace(/<div\b[^>]*>\s*<\/div>/gu, '<br>')
    .replace(/<span class="sc">([^<]*)<\/span>/gu, (_, text) => text.replace(/&[#a-z0-9]+;|[^&]+/giu, (part) => (part[0] === '&' ? part : part.toLocaleUpperCase('fr'))))).replace(/[\uE000\uE001]/gu, '');
  html = html.replace(/<(h[2-6])\b[^>]*>([\s\S]*?)<\/\1>/gu, (_, __, inner) => { const text = headingText(inner); if (text) headings.push(text); return ''; });
  // <center>(가운데 줄 — 벽의 서명 「BRUJON, 1811.」 · 쪽 안에 이어 붙은 장 표제)는 글자 블록으로
  html = html.replace(/<center\b[^>]*>/gu, '<div>').replace(/<\/center>/gu, '</div>');
  // 목록 항목(dl/dd · ul/li — 레 미제라블의 암호 명단 등)은 한 줄 문단으로
  html = html.replace(/<(?:dd|dt|li)\b[^>]*>/gu, '<p>').replace(/<\/(?:dd|dt|li)>/gu, '</p>').replace(/<\/?(?:dl|ul|ol)\b[^>]*>/gu, '');
  const blocks = [];
  // 블록 사이 맨 글자(교정본 쪽이 이어지는 자리에서 <p> 밖에 남은 문단) — 그 자리에 문단으로 넣는다(조용히 버리지 않는다).
  // 감싸던 div·p 태그 조각만 걷고, 그 밖의 모르는 태그는 blockText가 throw한다.
  const pushGap = (gap) => {
    const bare = gap.replace(/<\/?(?:div|p)\b[^>]*>/gu, '');
    if (normalizeTypography(decodeEntities(bare.replace(/<[^>]+>/gu, ''))).trim()) blocks.push(blockText(bare));
  };
  const pattern = /<(p|div)\b[^>]*>((?:(?!<\/?(?:p|div)\b)[\s\S])*?)<\/\1>/gu;
  let last = 0;
  for (const match of html.matchAll(pattern)) {
    pushGap(html.slice(last, match.index));
    const text = blockText(match[2]);
    if (text) blocks.push(ORNAMENT_ONLY.test(text) ? SCENE_BREAK : text);
    last = match.index + match[0].length;
  }
  pushGap(html.slice(last));
  // 쪽 맨 앞·맨 뒤의 장면 바꿈(제목 아래 장식 줄)은 바꿈이 아니다
  while (blocks[0] === SCENE_BREAK) blocks.shift();
  while (blocks.at(-1) === SCENE_BREAK) blocks.pop();
  if (blocks.length === 0) throw new Error('본문 문단이 없다');
  return { headings, blocks: blocks.map(unmark) };
}

/**
 * 본문 속 표(예: 레 미제라블 테나르디에의 계산서) → 문단 하나. 제목(caption) 한 줄 + 행마다 칸 글자를 공백으로 이은 한 줄.
 * 칸 안의 꾸밈(점선 리더 div 등)은 글자만 남긴다 — 표는 드물고 글자가 전부라 여기서만 태그를 통째로 걷는다.
 */
function tableToBlock(table) {
  // 블록 태그 자리는 공백, 글자 안 태그(n<sup>o</sup>)는 그냥 지운다
  const flat = (inner) => normalizeTypography(decodeEntities(inner.replace(/<style\b[\s\S]*?<\/style>/gu, '').replace(/<\/?(?:div|p|br|td|th|li)\b[^>]*>/gu, ' ').replace(/<[^>]+>/gu, ''))).replace(/\s+/gu, ' ').trim();
  const lines = [];
  const caption = /<caption\b[^>]*>([\s\S]*?)<\/caption>/u.exec(table);
  if (caption && flat(caption[1])) lines.push(flat(caption[1]));
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gu)) {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gu)].map((cell) => flat(cell[1])).filter(Boolean);
    if (cells.length) lines.push(cells.join(' '));
  }
  return lines.length ? `<p>${lines.map((line) => line.replace(/[<>&]/gu, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[char])).join('<br>')}</p>` : '';
}

/** 이름 표시 기호를 빼고 그 자리를 남긴다 — {text, names: [{start, end}]}(블록 좌표, UTF-16). */
function unmark(text) {
  const names = [];
  let out = '';
  let open = -1;
  for (const char of text) {
    if (char === NAME_OPEN) { open = out.length; continue; }
    if (char === NAME_CLOSE) { if (open >= 0 && out.length > open) names.push({ start: open, end: out.length }); open = -1; continue; }
    out += char;
  }
  return { text: out, names };
}

export const wordCount = (text) => (String(text).match(/\S+/gu) || []).length;
export const charCount = (text) => String(text).replace(/\s+/gu, '').length;

/**
 * 블록들 → 블록 경계로 나눈 묶음. 묶음 수 n = round(전체 분량 / 목표)(최소 1), 경계는 누적 분량이 k·전체/n에 가장 가까운 블록 사이.
 * measure: 블록 → 분량(프랑스어 단어 수 · 중국어 글자 수).
 */
export function splitBlocks(blocks, target, measure) {
  const counts = blocks.map(measure);
  const total = counts.reduce((sum, value) => sum + value, 0);
  const parts = Math.max(1, Math.min(blocks.length, Math.round(total / target)));
  if (parts === 1) return [blocks];
  const cuts = [];
  let cumulative = 0;
  let k = 1;
  for (let index = 0; index < blocks.length - 1 && k < parts; index += 1) {
    const before = cumulative;
    cumulative += counts[index];
    const goal = (k * total) / parts;
    if (cumulative >= goal) {
      const cut = Math.abs(before - goal) < Math.abs(cumulative - goal) && index > (cuts.at(-1) ?? 0) ? index : index + 1;
      if (cut > (cuts.at(-1) ?? 0) && cut < blocks.length) cuts.push(cut);
      k += 1;
    }
  }
  const bounds = [0, ...cuts, blocks.length];
  return bounds.slice(1).map((end, index) => blocks.slice(bounds[index], end)).filter((group) => group.length > 0);
}

/**
 * 권리 판정(원산국 만료 = 한국 공개 가능) — 기준 연도는 검토일(rights.reviewedAt)의 해라 결정적이다.
 *   원산국: 사후 WS_ORIGIN_TERMS[원산국]년(중국 50 · 프랑스 70 · 한국 70). 프랑스는 mortPourLaFrance를 true/false로 꼭 적고, true면 +30년.
 *   한국: 저작권법 제3조 제4항(보호기간 상호주의) — 본국에서 만료된 외국 저작물은 한국에서도 보호하지 않는다(아오조라 D5와 같은 선).
 *         한국 원산은 한국 사후 70년 그 자체.
 *   미국 기준은 보지 않는다(오너 「미국 기준 없애」 2026-10-17 KST — 아오조라 D5 「일본에서만 끝나면 그만」의 연장).
 *   번역자가 있으면 불가(원어 원문만). 판정 규칙이 없는 원산국은 불가(fail-closed).
 * @returns {{ok: boolean, reasons: string[], reviewYear: number|null}}
 */
export function wikisourceRightsVerdict({ publishedYear, authorDeathYear, countryOfOrigin, mortPourLaFrance = null, translator = null, rights } = {}) {
  const reasons = [];
  const reviewYear = /^\d{4}-\d{2}-\d{2}$/u.test(rights?.reviewedAt ?? '') ? Number(rights.reviewedAt.slice(0, 4)) : null;
  if (reviewYear == null) reasons.push('rights.reviewedAt(YYYY-MM-DD)가 필요하다');
  if (!Number.isInteger(publishedYear)) reasons.push('publishedYear가 필요하다');
  if (!Number.isInteger(authorDeathYear)) reasons.push('authorDeathYear가 필요하다');
  const term = Object.hasOwn(WS_ORIGIN_TERMS, countryOfOrigin) ? WS_ORIGIN_TERMS[countryOfOrigin] : null;
  if (term == null) reasons.push(`원산국 ${countryOfOrigin ?? '없음'}은 아직 판정 규칙이 없다(${Object.keys(WS_ORIGIN_TERMS).join('·')})`);
  if (countryOfOrigin === 'FR' && typeof mortPourLaFrance !== 'boolean') reasons.push('프랑스 원산은 mortPourLaFrance(true/false)를 적는다');
  if (translator) reasons.push('번역본은 넣지 않는다(원어 원문만)');
  if (reviewYear != null && Number.isInteger(authorDeathYear)) {
    const originTerm = (term ?? 0) + (countryOfOrigin === 'FR' && mortPourLaFrance === true ? 30 : 0);
    if (term != null && authorDeathYear > reviewYear - originTerm - 1) reasons.push(`작가 ${authorDeathYear} 사망 — 원산국 보호기간(사후 ${originTerm}년)이 끝나지 않았다`);
  }
  return { ok: reasons.length === 0, reasons, reviewYear };
}

/** 게시 가능한 권리 기록인가 — 승인 · 퍼블릭 도메인 · 원산국 · 한국 검토 · 판정 통과 · 위키문헌 라이선스. */
export function wikisourceRightsPublishable(literature) {
  const rights = literature?.rights;
  if (literature?.provider !== WS_PROVIDER || rights?.status !== 'approved' || rights?.basis !== 'public-domain') return false;
  if (literature.license !== WS_LICENSE) return false;
  const jurisdictions = Array.isArray(rights.reviewedJurisdictions) ? rights.reviewedJurisdictions : [];
  if (![literature.countryOfOrigin, 'KR'].every((code) => jurisdictions.includes(code))) return false;
  return wikisourceRightsVerdict(literature).ok;
}

function validateEntry(entry) {
  const problems = [];
  if (entry?.schemaVersion !== WS_BOOK_VERSION) problems.push(`schemaVersion ${WS_BOOK_VERSION}`);
  if (entry?.provider !== WS_PROVIDER) problems.push(`provider '${WS_PROVIDER}'`);
  if (!Object.hasOwn(WS_WIKIS, entry?.wiki)) problems.push(`wiki(${Object.keys(WS_WIKIS).join('·')})`);
  if (!KEY_PATTERN.test(entry?.key ?? '') || !String(entry?.key).startsWith(`ws-${entry?.wiki}-`)) problems.push('key(ws-<wiki>-<작가>_<작품>)');
  const host = WS_WIKIS[entry?.wiki]?.host;
  if (host && !String(entry?.url ?? '').startsWith(`https://${host}/wiki/`)) problems.push(`url(https://${host}/wiki/…)`);
  for (const field of ['title', 'author', 'level', 'main']) if (typeof entry?.[field] !== 'string' || !entry[field].trim()) problems.push(field);
  if (typeof entry?.title === 'string' && entry.title.includes(' — ')) problems.push('title에 「 — 」(장 제목 구분자)를 쓰지 않는다');
  const wantVariants = entry?.wiki === 'zh' ? [WS_SCRIPT.canonical, WS_SCRIPT.alternate] : [null];
  if (!Array.isArray(entry?.files) || entry.files.length === 0) problems.push('files(쪽 목록)');
  else entry.files.forEach((file, index) => {
    if (typeof file?.page !== 'string' || !Number.isInteger(file?.revid)) problems.push(`files[${index}] {page, revid}`);
    const variants = Array.isArray(file?.variants) ? file.variants : [];
    if (variants.map((item) => item.variant).join(',') !== wantVariants.join(',')) problems.push(`files[${index}].variants(${wantVariants.join(',') || '하나'})`);
    variants.forEach((item, k) => { if (!/^[0-9]{3}(?:\.zh-han[st])?\.html$/u.test(item?.path ?? '') || !SHA256.test(item?.sha256 ?? '')) problems.push(`files[${index}].variants[${k}] {path, sha256}`); });
  });
  if (problems.length) throw new Error(`entry.json: ${problems.join(' · ')}`);
  return entry.key;
}

/** 쪽의 제목 → 장 제목. 쪽 안 제목(h2–h6)을 「 · 」로 잇되 작품 제목과 같은 것은 뺀다. 없으면 작품 제목. */
function pageTitle(headings, workTitle) {
  const own = headings.filter((heading) => heading.replace(/\s+/gu, ' ').toLowerCase() !== workTitle.toLowerCase());
  // 「I\nCE QU’ON RENCONTRE…」 → 「I. CE QU’ON RENCONTRE…」(장 번호 줄 뒤에 마침표) · 나머지 줄은 공백으로 잇는다
  const tidy = (heading) => heading.replace(/^([IVXLC]+)\.?\n/u, '$1. ').replace(/\n+/gu, ' ');
  return own.length ? own.map(tidy).join(' · ') : workTitle;
}

/**
 * entry + 쪽 조각들({path, text} — entry.files의 variants 순서대로 평평하게) → 정본 책 초안(literaturePublish.js가 받는 모양).
 * 파일 해시 대조는 빌드가 한다(바이트 기준). 여기서는 구조 · 장 나눔 · 글자판 대조 · 권리만 본다 — 권리가 통과하지 않으면 throw.
 * 중국어 장은 rawText(간체 정본) + metadata.scriptVariants['zh-hant'](같은 길이의 번체) + metadata.literature.nameMarks.
 */
export function createWikisourceDraft(entry, files) {
  const key = validateEntry(entry);
  const verdict = wikisourceRightsVerdict(entry);
  if (!verdict.ok) throw new Error(`권리 판정 불가: ${verdict.reasons.join(' / ')}`);
  const language = WS_WIKIS[entry.wiki].language;
  const zh = entry.wiki === 'zh';
  const byPath = new Map(files.map((file) => [file.path, file.text]));
  const expected = entry.files.flatMap((file) => file.variants.map((item) => item.path));
  if (files.length !== expected.length || expected.some((name) => !byPath.has(name))) throw new Error('쪽 조각이 entry.files와 다르다');
  const measure = entry.wiki === 'fr' ? wordCount : charCount;
  const target = WS_TARGET[language];
  const pieces = [];
  for (const file of entry.files) {
    const canonical = parseWikisourceFragment(byPath.get(file.variants[0].path));
    let alternate = null;
    if (zh) {
      alternate = parseWikisourceFragment(byPath.get(file.variants[1].path));
      if (alternate.blocks.length !== canonical.blocks.length) throw new Error(`${file.page}: 간체·번체 문단 수가 다르다(${canonical.blocks.length}·${alternate.blocks.length})`);
      canonical.blocks.forEach((block, index) => {
        if (block.text.length !== alternate.blocks[index].text.length) throw new Error(`${file.page} ${index + 1}문단: 간체·번체 길이가 다르다`);
      });
    }
    const title = pageTitle(canonical.headings, entry.title);
    const indexed = canonical.blocks.map((block, index) => ({ ...block, alternate: alternate?.blocks[index].text ?? null }));
    const groups = splitBlocks(indexed, target, (block) => measure(block.text));
    groups.forEach((group, index) => pieces.push({
      title: groups.length > 1 ? `${title} (${index + 1}/${groups.length})` : title,
      blocks: group,
      sourcePage: file.page,
      revid: file.revid,
    }));
  }
  const total = pieces.length;
  const book = { key, title: entry.title, author: entry.author, level: entry.level, total };
  const literature = {
    schemaVersion: WS_BOOK_VERSION,
    provider: WS_PROVIDER,
    workKey: key,
    wiki: entry.wiki,
    title: entry.title,
    author: entry.author,
    publishedYear: entry.publishedYear,
    authorDeathYear: entry.authorDeathYear,
    countryOfOrigin: entry.countryOfOrigin,
    ...(entry.countryOfOrigin === 'FR' ? { mortPourLaFrance: entry.mortPourLaFrance } : {}),
    translator: null,
    url: entry.url,
    fetchedAt: entry.fetchedAt,
    license: WS_LICENSE,
    rights: entry.rights,
    ...(zh ? { script: WS_SCRIPT.canonical, scriptVariants: [WS_SCRIPT.alternate] } : {}),
    edits: [...WS_EDITS, ...(zh ? ['script-variant-by-wikisource'] : [])],
  };
  const chapters = pieces.map((piece, index) => {
    const order = index + 1;
    const rawText = piece.blocks.map((block) => block.text).join('\n\n');
    const nameMarks = [];
    let at = 0;
    for (const block of piece.blocks) {
      for (const name of block.names) nameMarks.push({ start: at + name.start, end: at + name.end, base: block.text.slice(name.start, name.end) });
      at += block.text.length + 2;
    }
    return {
      order,
      title: piece.title,
      materialTitle: `${entry.title} — ${piece.title}`,
      rawText,
      metadata: {
        language,
        level: entry.level,
        book: { key, title: entry.title, author: entry.author, order, total },
        literature: { ...literature, sourcePage: piece.sourcePage, revid: piece.revid, ...(nameMarks.length ? { nameMarks } : {}) },
        // 번체 보기 — 간체 정본과 같은 길이의 번체 원문(위키문헌 글자 변환). 게시(준비)가 행 metadata에 그대로 싣고, 뷰어는 대조표 해시와 맞을 때만 쓴다.
        ...(zh ? { scriptVariants: { [WS_SCRIPT.alternate]: piece.blocks.map((block) => block.alternate).join('\n\n') } } : {}),
      },
    };
  });
  const sizes = chapters.map((chapter) => measure(chapter.rawText));
  return {
    schemaVersion: WS_BOOK_VERSION,
    book,
    chapters,
    diagnostics: { pageCount: entry.files.length, chapterCount: total, size: sizes.reduce((sum, value) => sum + value, 0), unit: entry.wiki === 'fr' ? 'words' : 'chars', minChapter: Math.min(...sizes), maxChapter: Math.max(...sizes) },
  };
}
