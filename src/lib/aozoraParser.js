// 青空文庫 txt(ルビ付き, UTF-8 변환본) 파서 — 반입의 손실 방지 경계.
// 네트워크·저장소·뷰어와 무관한 순수 함수다. 원문 루비·주석·외자·판권을 먼저 구조화하고,
// 평문은 그 결과에서만 파생한다. 입력은 txt 하나뿐이다(XHTML은 <br /> 줄 나눔이라 문단 복원이 따로 필요해 배제).
//
// 실물 txt 배치(青空文庫 注記一覧·組版案内 기준):
//   ① 머리: 작품명 / (부제) / 저자명
//   ② 기호 설명 블록: 대시 줄 두 개 사이의 【テキスト中に現れる記号について】 — 판권이 아니다.
//   ③ 본문: 한 줄 = 한 문단. ｜기준《읽기》, 기준《읽기》, ［＃주석］, ※［＃외자］
//   ④ 판권: 말미의 「底本：」부터. 들여쓴 줄은 바로 위 항목의 연속 줄이다.

import JISX0213 from './aozoraJisx0213.json';

export const AOZORA_DOCUMENT_VERSION = 2;

const DASH_LINE = /^-{10,}\s*$/;
const COLOPHON_START = /^底本：/;
const COLOPHON_KEYS = Object.freeze({
  底本: 'sourceBook',
  底本の親本: 'parentBook',
  初出: 'firstAppearance',
  入力: 'inputter',
  校正: 'proofreader',
});
const COLOPHON_KEY_LINE = /^(底本の親本|底本|初出|入力|校正)：(.*)$/;
const CONTINUATION_LINE = /^[ \t\u3000]+\S/;
const HEADING_LEVEL = Object.freeze({ 大: 1, 中: 2, 小: 3 });
// 외자 주석 중 기호(青空文庫 注記一覧 「記号」) — 본문에 그대로 쓰면 루비 기호와 겹치는 것들.
const SYMBOL_GAIJI = Object.freeze({
  始め二重山括弧: '《',
  終わり二重山括弧: '》',
  縦線: '｜',
  始め角括弧: '［',
  終わり角括弧: '］',
  米印: '※',
  // Unicode에 한 글자가 없는 기호 — 같은 글자를 늘어놓은 표기로(뜻·소리 변화 없음). 실물 ドグラ・マグラ(「感嘆符二つ」는 ‼ U+203C로 이미 풀린다).
  感嘆符三つ: '！！！',
});

function invariant(condition, message) {
  if (!condition) throw new TypeError(message);
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

/**
 * 루비 기준 문자종 — 「｜」 없는 《》는 바로 앞 **같은 문자종** 연속에만 걸린다(青空文庫 ルビ規則).
 * 漢字(々〆〇ヶヵ仝 포함) · ひらがな · カタカナ(ー 포함) · 全角英数 · 半角英数. 그 밖은 null.
 */
export function aozoraRubyClass(char) {
  if (!char) return null;
  if (/[\p{Script=Han}々〆〇ヶヵ仝]/u.test(char)) return 'kanji';
  if (/\p{Script=Hiragana}/u.test(char)) return 'hiragana';
  if (/[\p{Script=Katakana}ー]/u.test(char)) return 'katakana';
  if (/[Ａ-Ｚａ-ｚ０-９]/u.test(char)) return 'fullwidth-alnum';
  if (/[A-Za-z0-9]/.test(char)) return 'halfwidth-alnum';
  return null;
}

/** text 끝에서 같은 문자종 연속의 시작 위치(UTF-16). 끝 글자가 문자종 밖이면 -1. */
function trailingRunStart(text) {
  const chars = Array.from(text);
  const cls = aozoraRubyClass(chars.at(-1));
  if (!cls) return -1;
  let index = chars.length - 1;
  while (index > 0 && aozoraRubyClass(chars[index - 1]) === cls) index -= 1;
  return chars.slice(0, index).join('').length;
}

function headingMark(description) {
  let match = description.match(/^「(.+)」は(同行|窓)?([大中小])見出し$/u);
  if (match) return { type: 'heading-mark', target: match[1], level: HEADING_LEVEL[match[3]] };
  match = description.match(/^(同行|窓)?([大中小])見出し$/u);
  if (match) return { type: 'heading-open', level: HEADING_LEVEL[match[2]] };
  match = description.match(/^(同行|窓)?([大中小])見出し終わり$/u);
  if (match) return { type: 'heading-close', level: HEADING_LEVEL[match[2]] };
  // 여러 줄 見出し(「ここから中見出し」… 「ここで中見出し終わり」) — 사이 줄들을 한 표제로 묶는다(실물 学問のすすめ 九編).
  match = description.match(/^ここから([大中小])見出し$/u);
  if (match) return { type: 'heading-block-open', level: HEADING_LEVEL[match[1]] };
  match = description.match(/^ここで([大中小])見出し終わり$/u);
  if (match) return { type: 'heading-block-close', level: HEADING_LEVEL[match[1]] };
  if (/^ここ(から|で).*見出し/u.test(description)) return { type: 'heading-unsupported' };
  return null;
}

// Unicode에 없는 작은 가나 — 보통 크기 글자로 바꾸고(substituted) 책 metadata의 「우리가 바꾼 점」에 남긴다.
// 오너 결정(2026-10-14 KST 「권장대로」): 銀河鉄道の夜 「僕ん(작은 ん)とこ」 한 글자 — 뜻이 같은 「僕んとこ」로 읽힌다.
// 이 표에 없는 이름은 여전히 미해결(fail-closed). 작은 ㇰ·ㇶ 등 Unicode에 있는 작은 가나는 면-구-점으로 이미 풀린다.
export const AOZORA_SUBSTITUTED_GAIJI = Object.freeze({ 小書き平仮名ん: 'ん' });

function gaijiNode(description) {
  const name = description.split('、')[0];
  if (Object.hasOwn(SYMBOL_GAIJI, name)) return { type: 'gaiji', description, status: 'resolved', char: SYMBOL_GAIJI[name] };
  if (Object.hasOwn(AOZORA_SUBSTITUTED_GAIJI, name)) return { type: 'gaiji', description, status: 'resolved', char: AOZORA_SUBSTITUTED_GAIJI[name], substituted: true };
  const unicode = description.match(/U\+([0-9A-F]{4,6})/i);
  if (unicode) {
    const point = Number.parseInt(unicode[1], 16);
    if (point <= 0x10ffff) return { type: 'gaiji', description, status: 'resolved', char: String.fromCodePoint(point) };
  }
  // JIS X 0213 면-구-점(「第3水準1-87-71」·「第4水準2-13-28」, 비한자는 「小書き片仮名ヒ、1-6-84」처럼 수준 없이) — 青空文庫가 외자를
  // 가리키는 정식 번호다. 표(aozoraJisx0213.json, scripts/literature/gen-jisx0213.py가 JIS X 0213:2004 공식 대응에서 생성)에 있는
  // 칸만 푼다. 없는 칸·쪽-줄 표기(「168-12」 — 두 마디)는 미해결(fail-closed).
  const cell = description.split('、').map((part) => part.trim().match(/^(?:第[34]水準)?([12])-(\d{1,2})-(\d{1,2})$/u)).find(Boolean);
  if (cell) {
    const char = JISX0213[`${cell[1]}-${Number(cell[2])}-${Number(cell[3])}`];
    if (char) return { type: 'gaiji', description, status: 'resolved', char };
  }
  return { type: 'gaiji', description, status: 'unresolved' };
}

function pushText(children, value) {
  if (!value) return;
  const previous = children.at(-1);
  if (previous?.type === 'text') previous.value += value;
  else children.push({ type: 'text', value });
}

/** 한 줄의 인라인 구조 — text / ruby / gaiji / (줄 처리용) 표제 표식. 주석은 notes로 뺀다. */
function parseInline(source, lineNumber, ctx) {
  const children = [];
  const token = /｜([^《｜\n]+)《([^》\n]+)》|《([^》\n]+)》|(※)?［＃([^］\n]+)］/gu;
  let cursor = 0;
  for (const match of source.matchAll(token)) {
    pushText(children, source.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    if (match[1] != null) {
      // ｜ 루비 기준 안의 외자(「｜御※［＃「飮のへん＋善」、第4水準2-92-71］《ごぜん》」 — 실물 吾輩は猫である)도 그 글자로 푼다.
      // 예전에는 주석 글자가 그대로 기준이 되어 본문에 「※［＃…］」가 남았다. 못 풀면 〓 + 미해결 외자로 센다(fail-closed).
      const base = match[1].replace(/※［＃([^］\n]+)］/gu, (all, description) => {
        const node = gaijiNode(description.trim());
        ctx.gaiji.push({ ...node, line: lineNumber });
        return node.status === 'resolved' ? node.char : '〓';
      });
      children.push({ type: 'ruby', base, reading: match[2] });
    } else if (match[3] != null) {
      const previous = children.at(-1);
      // 해결된 외자에 걸린 루비(「※［＃「目＋匡」、第3水準1-88-81］《まぶた》」) — 외자는 한자 한 글자이므로 앞 한자 연속과 함께 기준이 된다.
      if (previous?.type === 'gaiji' && previous.status === 'resolved') {
        let base = '';
        while (children.at(-1)?.type === 'gaiji' && children.at(-1).status === 'resolved') base = children.pop().char + base;
        const before = children.at(-1);
        if (before?.type === 'text' && aozoraRubyClass(Array.from(before.value).at(-1)) === 'kanji') {
          const runStart = trailingRunStart(before.value);
          base = before.value.slice(runStart) + base;
          before.value = before.value.slice(0, runStart);
          if (!before.value) children.pop();
        }
        children.push({ type: 'ruby', base, reading: match[3] });
        continue;
      }
      let start = previous?.type === 'text' ? trailingRunStart(previous.value) : -1;
      // 물음표·느낌표 한 글자에 붙은 루비(「？《インタロゲーションマーク》」 — 실물 ドグラ・マグラ) — 그 한 글자를 기준으로 삼는다.
      // 괄호(「《よみ》) 같은 다른 기호는 기준이 될 수 없으니 여전히 경고.
      // 읽기 보조가 아닌 주석 루비라 잠금 대상은 아니다(aozoraRubyLockable). 공백 뒤 루비는 여전히 경고.
      if (start < 0 && previous?.type === 'text' && /[？！?!]$/u.test(previous.value)) start = previous.value.length - 1;
      if (start < 0) {
        ctx.warnings.push({ code: previous?.type === 'gaiji' ? 'RUBY_ON_GAIJI' : 'RUBY_WITHOUT_BASE', line: lineNumber, source });
        pushText(children, match[0]);
        continue;
      }
      const base = previous.value.slice(start);
      previous.value = previous.value.slice(0, start);
      if (!previous.value) children.pop();
      children.push({ type: 'ruby', base, reading: match[3] });
    } else {
      const description = match[5].trim();
      if (match[4]) {
        const node = gaijiNode(description);
        ctx.gaiji.push({ ...node, line: lineNumber });
        children.push(node);
        continue;
      }
      const mark = headingMark(description);
      if (mark?.type === 'heading-unsupported') {
        ctx.warnings.push({ code: 'UNSUPPORTED_HEADING', line: lineNumber, source });
        ctx.notes.push({ type: 'editorial-note', description, line: lineNumber });
      } else if (mark) {
        children.push(mark);
      } else {
        ctx.notes.push({ type: 'editorial-note', description, line: lineNumber });
      }
    }
  }
  pushText(children, source.slice(cursor));
  // 짝 없는 루비 기호가 평문에 남았다면 조용히 넘기지 않는다.
  const leftover = children.filter((child) => child.type === 'text').map((child) => child.value).join('');
  if (/[｜《》]/u.test(leftover) && !ctx.warnings.some((item) => item.line === lineNumber)) {
    ctx.warnings.push({ code: 'MALFORMED_RUBY', line: lineNumber, source });
  }
  return children;
}

function inlinePlain(children) {
  return children.map((child) => {
    if (child.type === 'text') return child.value;
    if (child.type === 'ruby') return child.base;
    if (child.type === 'gaiji') return child.status === 'resolved' ? child.char : '〓';
    return '';
  }).join('');
}

/** 앞뒤 공백(전각 포함) 노드를 다듬은 사본. 루비·외자 노드는 그대로 둔다. */
function trimChildren(children) {
  const out = children.map((child) => ({ ...child }));
  while (out[0]?.type === 'text' && !out[0].value.replace(/^[\s\u3000]+/u, '')) out.shift();
  if (out[0]?.type === 'text') out[0].value = out[0].value.replace(/^[\s\u3000]+/u, '');
  while (out.at(-1)?.type === 'text' && !out.at(-1).value.replace(/[\s\u3000]+$/u, '')) out.pop();
  if (out.at(-1)?.type === 'text') out.at(-1).value = out.at(-1).value.replace(/[\s\u3000]+$/u, '');
  return out;
}

const isContent = (children) => inlinePlain(children).trim().length > 0;

/** 한 줄을 블록들로 — 見出し 주석이 있으면 heading 블록, 나머지는 문단. */
function lineBlocks(children, lineNumber, ctx) {
  const blocks = [];
  const pushBlock = (type, nodes, level) => {
    const trimmed = trimChildren(nodes.filter((child) => !child.type.startsWith('heading-')));
    if (!isContent(trimmed)) return;
    blocks.push(type === 'heading' ? { type, level, children: trimmed, line: lineNumber } : { type, children: trimmed, line: lineNumber });
  };

  const markIndex = children.findIndex((child) => child.type === 'heading-mark');
  if (markIndex >= 0) {
    const mark = children[markIndex];
    const before = trimChildren(children.slice(0, markIndex));
    // 「X」は中見出し는 주석 앞 글자 X를 가리킨다. 앞 글이 X와 다르면(지목 범위 추정 필요) 사람이 보게 경고로 남긴다.
    // 同行·窓 見出し는 주석 뒤 글이 같은 줄의 본문이다 — 표제 뒤 나머지는 문단이 된다.
    if (inlinePlain(before) !== mark.target) ctx.warnings.push({ code: 'HEADING_TARGET_MISMATCH', line: lineNumber, target: mark.target });
    pushBlock('heading', before, mark.level);
    pushBlock('paragraph', children.slice(markIndex + 1));
    return blocks;
  }

  const openIndex = children.findIndex((child) => child.type === 'heading-open');
  if (openIndex >= 0) {
    const closeIndex = children.findIndex((child, index) => index > openIndex && child.type === 'heading-close');
    if (closeIndex < 0) {
      ctx.warnings.push({ code: 'UNCLOSED_HEADING', line: lineNumber });
      pushBlock('paragraph', children);
      return blocks;
    }
    pushBlock('paragraph', children.slice(0, openIndex));
    pushBlock('heading', children.slice(openIndex + 1, closeIndex), children[openIndex].level);
    pushBlock('paragraph', children.slice(closeIndex + 1));
    return blocks;
  }
  if (children.some((child) => child.type === 'heading-close')) ctx.warnings.push({ code: 'UNOPENED_HEADING', line: lineNumber });
  pushBlock('paragraph', children);
  return blocks;
}

/** 머리·기호 설명 블록·본문·판권의 줄 범위. */
function locateSections(lines) {
  const firstDash = lines.findIndex((line, index) => index < 40 && DASH_LINE.test(line));
  const secondDash = firstDash >= 0 ? lines.findIndex((line, index) => index > firstDash && DASH_LINE.test(line)) : -1;
  let headerEnd;
  let bodyStart;
  if (firstDash >= 0 && secondDash > firstDash) {
    headerEnd = firstDash;
    bodyStart = secondDash + 1;
  } else {
    const blank = lines.findIndex((line) => !line.trim());
    headerEnd = blank < 0 ? 0 : blank;
    bodyStart = blank < 0 ? 0 : blank + 1;
  }
  let colophonStart = -1;
  for (let index = lines.length - 1; index >= bodyStart; index -= 1) {
    if (COLOPHON_START.test(lines[index])) { colophonStart = index; break; }
  }
  return { headerEnd, bodyStart, bodyEnd: colophonStart < 0 ? lines.length : colophonStart, colophonStart };
}

function parseColophon(lines) {
  const colophon = { sourceBook: [], parentBook: [], firstAppearance: [], inputter: null, proofreader: null, other: [] };
  let current = null;
  for (const line of lines) {
    if (!line.trim()) { current = null; continue; }
    const keyed = line.match(COLOPHON_KEY_LINE);
    if (keyed) {
      const key = COLOPHON_KEYS[keyed[1]];
      const value = keyed[2].trim();
      if (Array.isArray(colophon[key])) {
        if (value) colophon[key].push(value);
      } else {
        colophon[key] = colophon[key] ? `${colophon[key]}、${value}` : value;
      }
      current = key;
      continue;
    }
    if (current && CONTINUATION_LINE.test(line)) {
      const value = line.trim();
      if (Array.isArray(colophon[current])) colophon[current].push(value);
      else colophon[current] = `${colophon[current]} ${value}`.trim();
      continue;
    }
    current = null;
    colophon.other.push(line.trim());
  }
  return colophon;
}

/**
 * txt 원문 → 구조 문서. 결정적이고 깊게 동결된다.
 * @returns {{schemaVersion, format:'txt', header:{title,author,lines}, blocks, notes, gaiji, colophon, warnings}}
 */
export function parseAozoraText(source) {
  invariant(typeof source === 'string', 'Aozora text source must be a string');
  invariant(!/[\uE000\uE001]/u.test(source), 'Aozora text must not contain reserved private-use markers U+E000/U+E001');
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const { headerEnd, bodyStart, bodyEnd, colophonStart } = locateSections(lines);
  const headerLines = lines.slice(0, headerEnd).map((line) => line.trim()).filter(Boolean);
  const ctx = { notes: [], gaiji: [], warnings: [] };
  const blocks = [];
  let open = null; // 여러 줄 見出し — { level, line, children }
  for (let index = bodyStart; index < bodyEnd; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const children = parseInline(line, index + 1, ctx);
    const opener = children.find((child) => child.type === 'heading-block-open');
    const closer = children.find((child) => child.type === 'heading-block-close');
    const rest = children.filter((child) => !child.type.startsWith('heading-block-'));
    if (opener || closer) {
      // 여는·닫는 주석은 그 줄에 홀로 있어야 한다(같은 줄 본문은 어디에 붙을지 모른다 — 사람이 보게 경고).
      if (isContent(rest)) ctx.warnings.push({ code: 'BLOCK_HEADING_WITH_TEXT', line: index + 1 });
      if (opener) {
        if (open) ctx.warnings.push({ code: 'NESTED_BLOCK_HEADING', line: index + 1 });
        open = { level: opener.level, line: index + 1, children: [] };
      } else if (!open || closer.level !== open.level) {
        ctx.warnings.push({ code: 'UNOPENED_HEADING', line: index + 1 });
      } else {
        const heading = trimChildren(open.children);
        if (isContent(heading)) blocks.push({ type: 'heading', level: open.level, children: heading, line: open.line });
        open = null;
      }
      continue;
    }
    if (open) {
      // 사이 줄은 전각 공백 하나로 잇는다(연속 표제를 한 줄로 합치는 투영과 같은 이음).
      if (open.children.length) open.children.push({ type: 'text', value: '\u3000' });
      open.children.push(...trimChildren(rest.filter((child) => !child.type.startsWith('heading-'))));
      continue;
    }
    blocks.push(...lineBlocks(children, index + 1, ctx));
  }
  if (open) ctx.warnings.push({ code: 'UNCLOSED_HEADING', line: open.line });
  if (colophonStart < 0) ctx.warnings.push({ code: 'NO_COLOPHON' });
  return freezeDeep({
    schemaVersion: AOZORA_DOCUMENT_VERSION,
    format: 'txt',
    header: {
      title: headerLines[0] ?? null,
      author: headerLines.length >= 2 ? headerLines.at(-1) : null,
      lines: headerLines,
    },
    blocks,
    notes: ctx.notes,
    gaiji: ctx.gaiji,
    colophon: parseColophon(colophonStart < 0 ? [] : lines.slice(colophonStart)),
    warnings: ctx.warnings,
  });
}

/** 블록 평문 — 루비는 기준 글자만, 해결된 외자는 그 글자, 미해결 외자는 〓. */
export function aozoraBlockText(block) {
  return inlinePlain(block.children);
}

export function aozoraDocumentToPlainText(document) {
  validateAozoraDocument(document);
  return document.blocks.map(aozoraBlockText).join('\n\n');
}

export function validateAozoraDocument(document) {
  invariant(document && typeof document === 'object' && !Array.isArray(document), 'document must be an object');
  invariant(document.schemaVersion === AOZORA_DOCUMENT_VERSION, 'Unsupported Aozora document version');
  invariant(document.format === 'txt', 'Unsupported Aozora document format');
  invariant(document.header && typeof document.header === 'object', 'document.header must be an object');
  invariant(Array.isArray(document.blocks), 'document.blocks must be an array');
  invariant(Array.isArray(document.notes), 'document.notes must be an array');
  invariant(Array.isArray(document.gaiji), 'document.gaiji must be an array');
  invariant(Array.isArray(document.warnings), 'document.warnings must be an array');
  invariant(document.colophon && typeof document.colophon === 'object', 'document.colophon must be an object');
  for (const block of document.blocks) {
    invariant(block?.type === 'paragraph' || block?.type === 'heading', 'Unsupported Aozora block');
    if (block.type === 'heading') invariant([1, 2, 3].includes(block.level), 'Heading level must be 1-3');
    invariant(Array.isArray(block.children), 'block.children must be an array');
    for (const child of block.children) {
      invariant(['text', 'ruby', 'gaiji'].includes(child?.type), 'Unsupported Aozora inline node');
      if (child.type === 'text') invariant(typeof child.value === 'string', 'Text node value must be a string');
      if (child.type === 'ruby') invariant(typeof child.base === 'string' && !!child.base && typeof child.reading === 'string' && !!child.reading, 'Ruby node must have base and reading');
      if (child.type === 'gaiji') invariant(child.status === 'unresolved' || (child.status === 'resolved' && typeof child.char === 'string' && !!child.char), 'Gaiji node must be resolved with a char or unresolved');
    }
  }
  return true;
}
