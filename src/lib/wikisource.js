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

import { KOGL_TYPE1, koglType1Verdict, koreaPublicDomainVerdict, translatorRecords } from './rightsKorea.js';

export const WS_PROVIDER = 'wikisource';
export const WS_BOOK_VERSION = 1;
export const WS_LICENSE = 'CC-BY-SA-4.0';
export const WS_WIKIS = Object.freeze({
  zh: { language: 'Chinese', host: 'zh.wikisource.org' },
  fr: { language: 'French', host: 'fr.wikisource.org' },
  // 한국 근대 문학(오너 「한국 근대 문학도 추가」 → 「베스트 5만」 2026-10-17 KST) — 현대 맞춤법 전사본(한자는 괄호 병기 그대로)
  ko: { language: 'Korean', host: 'ko.wikisource.org' },
  en: { language: 'English', host: 'en.wikisource.org' }, // 영어 번역본(『자본론』 무어·에이블링 역) — 원어 영어 정본은 Standard Ebooks가 먼저
});
// 장 하나 분량 — 프랑스어 단어 수 · 중국어·한국어 글자 수(공백 뺌)
export const WS_TARGET = Object.freeze({ French: 2200, Chinese: 2500, Korean: 3000, English: 2200 });
export const WS_EDITS = Object.freeze(['chapter-split-by-manabi', 'typography-normalized', 'illustrations-omitted', 'notes-omitted']);
export const WS_SCRIPT = Object.freeze({ canonical: 'zh-hans', alternate: 'zh-hant' });

const KEY_PATTERN = /^ws-(zh|fr|ko|en)-[a-z0-9]+(?:-[a-z0-9]+)*_[a-z0-9]+(?:-[a-z0-9]+)*$/u;
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
    .replace(/<br\b[^>]*>/gu, '\n')
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
const VULGAR = Object.freeze({ '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾' });
/**
 * 수식(<math>, 『자본론』 영어 위키문헌) → 글자. 본문에 나오는 것은 두 가지뿐이다: 분수(「½ coat」)는 분수 글자로, 표 옆 묶음 괄호
 * (\left\{ … \right. — 빈 행렬)는 글자가 없으니 지운다. 그 밖의 수식은 모르는 구조라 throw(fail-closed).
 */
function mathText(dataMw) {
  const source = String(JSON.parse(dataMw.replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/&amp;/gu, '&'))?.body?.extsrc ?? '');
  const fraction = /^\\scriptstyle\s*\{\s*\\frac\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}\s*\}\s*$/u.exec(source);
  if (fraction) return VULGAR[`${fraction[1]}/${fraction[2]}`] ?? `${fraction[1]}⁄${fraction[2]}`;
  const residue = source.replace(/\\(?:scriptstyle|left|right|begin\{matrix\}|end\{matrix\})|\\[{}]|\\[,\\ ]|[{}.\s]/gu, '');
  if (!residue) return '';
  throw new Error(`모르는 수식: ${source.slice(0, 60)}`);
}

export function parseWikisourceFragment(fragment, { upperSmallCaps = false } = {}) {
  if (!/^<div class="(?:prp-pages-output|mw-content-ltr mw-parser-output)"/u.test(fragment.trim())) throw new Error('위키문헌 본문 조각이 아니다');
  let html = fragment.trim().replace(/^<div[^>]*>/u, '').replace(/<\/div>\s*$/u, '');
  // 영어 위키문헌은 작은 대문자(smallcaps)를 소문자 글자로 적는다(『자본론』 「exchange.」) — 화면 그대로 대문자로. 다른 위키는 그대로.
  if (upperSmallCaps) html = html.replace(/<span class="smallcaps"[^>]*>([^<]*)<\/span>/gu, (_, text) => text.replace(/&[#a-z0-9]+;|[^&]+/giu, (part) => (part[0] === '&' ? part : part.toLocaleUpperCase('en'))));
  html = html
    .replace(/<math\b[^>]*?\sdata-mw='([^']*)'[^>]*>[\s\S]*?<\/math>/gu, (_, mw) => mathText(mw))
    .replace(/\sdata-mw='[^']*'/gu, '') // Parsoid 틀 기록(『자본론』 영어 위키문헌) — 속에 「<span>」 같은 위키 글자가 있다. 본문이 아니다
    .replace(/<style\b[\s\S]*?<\/style>/gu, '')
    .replace(/<(?:link|meta)\b[^>]*>/gu, '')
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/<figure\b[\s\S]*?<\/figure>/gu, '')
    .replace(/<span><span class="pagenum ws-pagenum"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?<\/span><\/span>/gu, '')
    .replace(/<span class="pagenum ws-pagenum"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?<\/span>/gu, '')
    .replace(/<span itemprop="associatedMedia"[^>]*><\/span>/gu, '')
    // 「〃」 틀(ditto) — 화면에 보이지 않는 칸(__ditto_hidden)에 틀 인자가 날것으로 남는다(『자본론』 표 「{{{1}}}„」). 보이는 「„」만 둔다
    .replace(/<span class="__ditto_hidden"[^>]*>[\s\S]*?<\/span>/gu, '')
    // 곁점(witju 틀 — 윤동주 「소낙비」 1955년판) — 글자 위의 점 표시만 지우고 글자는 둔다
    .replace(/<ruby class="witju[^"]*">([^<]*)(?:<rp>[^<]*<\/rp>)?<rt>[\s•·∙・゜。.]*<\/rt>(?:<rp>[^<]*<\/rp>)?<\/ruby>/gu, '$1')
    .replace(/<span style="font-size:0; line-height:0; display:block" class="lettrine"><br\s*\/?><\/span>/gu, '');
  // 각주 번호·목록 — 옛 파서는 class="reference", Parsoid(영어 위키문헌)는 class="mw-ref reference" · "mw-references references".
  // 표보다 먼저 뺀다(『자본론』 통계표 칸 안 각주 번호 「642,607[143]」).
  html = removeElements(html, 'sup', (open) => /class="(?:[^"]*\s)?reference(?:\s[^"]*)?"/u.test(open));
  html = removeElements(html, 'ol', (open) => /class="(?:[^"]*\s)?references(?:\s[^"]*)?"/u.test(open));
  // 자매 프로젝트 · 작품 정보 상자(zh 「祝福」 — Template:Textinfo 아이콘 그림 · 위키백과 링크)는 본문이 아니다
  html = removeElements(html, 'ul', (open) => /\bid="plainSister"/u.test(open));
  // 본문 이름공간 문서(교정 쪽 없이 바로 쓴 zh 문서)의 머리 틀 — 제목 · 作者 · 날짜 · 앞뒤 편 화살표 · 「本作品收录于」 표
  html = removeElements(html, 'div', (open) => /\bid="headerContainer"/u.test(open));
  html = html.replace(/<table\b[\s\S]*?<\/table>/gu, tableToBlock);
  html = removeElements(html, 'div', (open) => NOISE_DIV.test(open));
  const headings = [];
  // 제목 안 간격 div(쥘 베른 「I<div/>dans lequel…」)는 줄바꿈, 작은 대문자(sc)는 실제 대문자로 — 화면의 제목 그대로
  const headingText = (inner) => blockText(inner
    .replace(/<div\b[^>]*>\s*<\/div>/gu, '<br>')
    .replace(/<span class="sc">([^<]*)<\/span>/gu, (_, text) => text.replace(/&[#a-z0-9]+;|[^&]+/giu, (part) => (part[0] === '&' ? part : part.toLocaleUpperCase('fr'))))).replace(/[\uE000\uE001]/gu, '');
  html = html.replace(/<(h[2-6])\b[^>]*>([\s\S]*?)<\/\1>/gu, (_, __, inner) => { const text = headingText(inner); if (text) headings.push(text); return ''; });
  // 시(div.poem) — 빈 줄(<br><br>)이 연 나눔이라 연마다 문단으로(행은 문단 안 줄바꿈). 시집(진달래꽃 · 하늘과 바람과 별과 시)
  html = html.replace(/<div class="poem">([\s\S]*?)<\/div>/gu, (_, inner) => `<div class="poem">${inner.replace(/<br\b[^>]*>\s*<br\b[^>]*>/gu, '</p><p>')}</div>`);
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
 * 시집용 균형 묶음 — 시 한 편은 자르지 않고, 묶음 수 n = round(전체 / 목표)에서 묶음마다 목표와의 차의 제곱 합이 가장 작게 나눈다.
 * splitBlocks(누적 분량의 등분점)는 끝의 긴 산문(1955년판 「종시」)이 앞 글과 한 장으로 붙어 장이 목표의 두 배가 될 수 있다.
 */
export function splitBalanced(items, target, measure) {
  const counts = items.map(measure);
  const total = counts.reduce((sum, value) => sum + value, 0);
  const parts = Math.max(1, Math.min(items.length, Math.round(total / target)));
  const prefix = counts.reduce((acc, value) => [...acc, acc.at(-1) + value], [0]);
  const cost = (from, to) => (prefix[to] - prefix[from] - target) ** 2;
  // best[k][i] — 앞 i편을 k묶음으로 나눈 최소 비용, from[k][i] — 마지막 묶음의 시작
  const best = [Array.from({ length: items.length + 1 }, (_, i) => (i === 0 ? 0 : Infinity))];
  const from = [[]];
  for (let k = 1; k <= parts; k += 1) {
    best.push(Array(items.length + 1).fill(Infinity));
    from.push([]);
    for (let i = k; i <= items.length; i += 1) {
      for (let j = k - 1; j < i; j += 1) {
        const value = best[k - 1][j] + cost(j, i);
        if (value < best[k][i]) [best[k][i], from[k][i]] = [value, j];
      }
    }
  }
  const bounds = [items.length];
  for (let k = parts; k > 0; k -= 1) bounds.unshift(from[k][bounds[0]]);
  return bounds.slice(1).map((end, index) => items.slice(bounds[index], end));
}

/** 권리 판정 — 한국 공개 가능(① 한국 만료 · ② 본국 만료, 공통 정본 rightsKorea). 판정 규칙이 없는 원산국은 ①로만 열린다. */
export function wikisourceRightsVerdict(literature = {}) {
  // 공공누리 제1유형(「쉽고 바르게 읽는 3·1독립선언서」) — 보호기간이 아니라 이용 허락이 근거다
  if (literature?.rights?.basis === KOGL_TYPE1) return koglType1Verdict(literature);
  return koreaPublicDomainVerdict(literature);
}

/** 판의 라이선스 — 퍼블릭 도메인 원작은 위키문헌 전사의 CC BY-SA 4.0, 공공누리 저작물은 공공누리 제1유형 그대로. */
export const WS_KOGL_LICENSE = 'KOGL-1';
const licenseOf = (entry) => (entry?.rights?.basis === KOGL_TYPE1 ? WS_KOGL_LICENSE : WS_LICENSE);

/** 게시 가능한 권리 기록인가 — 승인 · 퍼블릭 도메인(또는 공공누리 제1유형) · 원산국 · 한국 검토 · 판정 통과 · 판의 라이선스. */
export function wikisourceRightsPublishable(literature) {
  const rights = literature?.rights;
  if (literature?.provider !== WS_PROVIDER || rights?.status !== 'approved' || !['public-domain', KOGL_TYPE1].includes(rights?.basis)) return false;
  if (literature.license !== licenseOf(literature)) return false;
  const jurisdictions = Array.isArray(rights.reviewedJurisdictions) ? rights.reviewedJurisdictions : [];
  if (![literature.countryOfOrigin, ...translatorRecords(literature.translator).map((record) => record?.countryOfOrigin), 'KR'].filter(Boolean).every((code) => jurisdictions.includes(code))) return false;
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
const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);
const titleCase = (text) => text.toLocaleLowerCase('en').replace(/[a-z][a-z’'-]*/gu, (word, at) => (at > 0 && MINOR_WORDS.has(word) ? word : word[0].toUpperCase() + word.slice(1)));

/**
 * 장 제목이 머리글이 아니라 가운데 문단인 판(『자본론』 영어 위키문헌 「CHAPTER II.」 + 「EXCHANGE.」) — entry.chapterHeading(장 번호 문단
 * 정규식)에 맞는 문단과 그다음 문단을 머리글로 옮기고, 그 앞의 부·편 표제 문단(「BOOK I.」 「PART I.」)과 함께 본문에서 뺀다.
 * 「Chapter II: Exchange」. 쪽에 맞는 문단이 없으면 throw(모르는 구조).
 */
function takeChapterHeading(parsed, pattern, page) {
  const at = parsed.blocks.findIndex((block) => new RegExp(pattern, 'u').test(block.text));
  if (at < 0 || !parsed.blocks[at + 1]) throw new Error(`${page}: 장 번호 문단(${pattern})이 없다`);
  const number = parsed.blocks[at].text.replace(/\.$/u, '').replace(/^CHAPTER\b/u, 'Chapter');
  parsed.headings.push(`${number}: ${titleCase(parsed.blocks[at + 1].text.replace(/\.$/u, ''))}`);
  parsed.blocks.splice(0, at + 2);
}

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
  const measure = entry.wiki === 'fr' || entry.wiki === 'en' ? wordCount : charCount;
  const target = WS_TARGET[language];
  const pieces = [];
  // 시집(entry.collection) — 쪽 하나가 시 한 편이라 쪽마다 장을 만들면 너무 잘다. 시를 단위로 분량 목표까지 이어 묶는다(시 한가운데는 자르지 않는다).
  if (entry.collection === true) {
    const poems = entry.files.map((file) => {
      const { blocks, headings } = parseWikisourceFragment(byPath.get(file.variants[0].path));
      const name = file.page.slice(file.page.lastIndexOf('/') + 1);
      // 시 제목 — 쪽 첫 블록이 시 행(여러 줄 · 긴 줄)이면 제목 줄이 없는 쪽이라 쪽 이름을 제목 블록으로 넣는다(장 안에서 시가 갈려 보이게).
      // 제목이 머리글(h2–h6)로 따로 있는 쪽(릴케 「VERGERS」)은 첫 블록이 짧아도 헌사(「À Madame …」)라 쪽 이름을 넣는다.
      const ownLine = blocks[0] && !blocks[0].text.includes('\n') && blocks[0].text.length <= 30 && !headings.length;
      const titled = ownLine ? blocks : [{ text: name, names: [] }, ...blocks];
      return { name, blocks: titled.map((block) => ({ ...block, alternate: null })), file };
    });
    const groups = splitBalanced(poems, target, (poem) => poem.blocks.reduce((sum, block) => sum + measure(block.text), 0));
    for (const group of groups) {
      pieces.push({
        title: group.length > 1 ? `${group[0].name} 외 ${group.length - 1}편` : group[0].name,
        blocks: group.flatMap((poem) => poem.blocks),
        sourcePage: group[0].file.page,
        revid: group[0].file.revid,
      });
    }
  }
  for (const file of entry.collection === true ? [] : entry.files) {
    const canonical = parseWikisourceFragment(byPath.get(file.variants[0].path), { upperSmallCaps: entry.wiki === 'en' });
    if (entry.chapterHeading && !canonical.headings.length) takeChapterHeading(canonical, entry.chapterHeading, file.page);
    let alternate = null;
    if (zh) {
      alternate = parseWikisourceFragment(byPath.get(file.variants[1].path));
      if (alternate.blocks.length !== canonical.blocks.length) throw new Error(`${file.page}: 간체·번체 문단 수가 다르다(${canonical.blocks.length}·${alternate.blocks.length})`);
      canonical.blocks.forEach((block, index) => {
        if (block.text.length !== alternate.blocks[index].text.length) throw new Error(`${file.page} ${index + 1}문단: 간체·번체 길이가 다르다`);
      });
    }
    // 판의 끝 표시(「FIN.」 · 「THE END」)는 마지막 쪽 끝에만 온다 — 장 글이 아니다(몽상 「Dixème Promenade」 끝)
    if (file === entry.files.at(-1) && /^(?:FIN|FINIS|THE END)\.?$/u.test(canonical.blocks.at(-1)?.text ?? '')) {
      canonical.blocks.pop();
      alternate?.blocks.pop();
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
    translator: entry.translator ?? null,
    url: entry.url,
    fetchedAt: entry.fetchedAt,
    license: licenseOf(entry),
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
    diagnostics: { pageCount: entry.files.length, chapterCount: total, size: sizes.reduce((sum, value) => sum + value, 0), unit: entry.wiki === 'fr' || entry.wiki === 'en' ? 'words' : 'chars', minChapter: Math.min(...sizes), maxChapter: Math.max(...sizes) },
  };
}
