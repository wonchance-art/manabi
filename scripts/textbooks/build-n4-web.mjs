// Reimplementation of the documented N5 manuscript-to-artifact contract.
// This does not recover the absent original rebuild.py/package_app.py tooling.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
export const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const e = escapeHtml;
const p = (text, kanji) => `<p>${japaneseMarkup(text, kanji)}</p>`;
const patternsOf = lesson => lesson.patterns?.length ? lesson.patterns : lesson.reviewPatterns || [];
export function japaneseMarkup(text, kanji = {}) {
  const source = String(text ?? ''), keys = Object.keys(kanji || {}).filter(key => key && typeof kanji[key] === 'string' && kanji[key]).sort((a, b) => b.length - a.length || a.localeCompare(b));
  let html = '';
  for (let i = 0; i < source.length;) {
    const key = keys.find(item => {
      if (!source.startsWith(item, i)) return false;
      // A map for 人/後 or 日本 must not invent readings inside 一人/午後/日本人.
      // Exact compound entries remain eligible through longest-match priority.
      const before = [...source.slice(0, i)].at(-1) || '';
      const after = [...source.slice(i + item.length)][0] || '';
      const first = [...item][0], last = [...item].at(-1);
      const compound = /[\p{Script=Han}\p{Number}]/u;
      return !((/\p{Script=Han}/u.test(first) && compound.test(before)) || (/\p{Script=Han}/u.test(last) && compound.test(after)));
    });
    if (key) { html += `<ruby>${e(key)}<rt>${e(kanji[key])}</rt></ruby>`; i += key.length; }
    else { const char = String.fromCodePoint(source.codePointAt(i)); html += e(char); i += char.length; }
  }
  return html;
}
const ja = (text, reading, kanji) => `<span lang="ja">${japaneseMarkup(text, reading ? {} : kanji)}</span>${reading ? `<small class="reading-note">${e(reading)}</small>` : ''}`;
const examples = (list, kanji) => `<div class="examples"><span class="caption">예문</span>${(list || []).map(item => `<div class="example">${ja(item.ja, item.reading, kanji)}<p class="meaning">${e(item.ko)}</p></div>`).join('')}</div>`;
const answer = (title, value, why, kanji) => `<details class="n4-answer"><summary>${e(title)} · 정답과 해설</summary>${p(value, kanji)}${p(why, kanji)}</details>`;
const question = (unit, kind, item, index, kanji = {}) => {
  const key = `${unit}-${kind}-${index + 1}`;
  return `<fieldset class="check"><legend>${e(item.id || `${index + 1}번`)}</legend><p>${japaneseMarkup(item.prompt, kanji)}</p>${(item.options || []).map(option => `<label><input type="radio" name="${key}" data-save="${key}" value="${e(option)}"><span>${japaneseMarkup(option, kanji)}</span></label>`).join('')}${!item.options?.length ? `<label for="${key}">내 답</label><textarea id="${key}" data-save="${key}" rows="2"></textarea>` : ''}</fieldset><details class="n4-answer"><summary>${e(item.id || `${index + 1}번`)} · 정답과 해설</summary><p>${japaneseMarkup(item.answer, kanji)}</p><p>${japaneseMarkup(item.why, kanji)}</p></details>`;
};
const cumulativeSection = (book, lesson) => (book.cumulativeReview || []).filter(review => review.afterLesson === lesson.number).map(review => {
  const kanji = { ...lesson.kanji, ...review.kanji };
  return `<section id="${e(review.id)}"><h3>연결해서 써요 · ${e(review.title)}</h3><div class="scene">${p(review.scene, kanji)}</div>${review.items.map((item, index) => question(lesson.id, review.id, item, index, kanji)).join('')}</section>`;
}).join('');
export async function loadManuscript(sourceDir) {
  const book = JSON.parse(await fs.readFile(path.join(sourceDir, 'book.json'), 'utf8'));
  const syllabus = JSON.parse(await fs.readFile(path.join(sourceDir, 'syllabus.json'), 'utf8'));
  const names = (await fs.readdir(path.join(sourceDir, 'lessons'))).filter(name => /^u\d{2}\.json$/.test(name)).sort();
  const lessons = await Promise.all(names.map(async name => JSON.parse(await fs.readFile(path.join(sourceDir, 'lessons', name), 'utf8'))));
  return { bookId: 'japanese-n4', level: 'N4', status: 'draft', ...book, syllabus, lessons: lessons.sort((a, b) => a.number - b.number) };
}
export function validateSource(book, expected) {
  const errors = [];
  if (book.bookId !== 'japanese-n4' || book.level !== 'N4' || book.status !== 'draft') errors.push('N4 draft identity required');
  if (!book.title || !book.version || !book.lessons?.length) errors.push('title/version/lessons required');
  if (expected !== undefined && book.lessons?.length !== expected) errors.push(`Expected ${expected} lessons`);
  const ids = new Set();
  for (const [i, lesson] of (book.lessons || []).entries()) {
    if (!/^u\d{2}$/.test(lesson.id) || ids.has(lesson.id)) errors.push(`Invalid/duplicate lesson ${lesson.id}`);
    ids.add(lesson.id);
    if (lesson.number !== i + 1 || lesson.id !== `u${String(i + 1).padStart(2, '0')}`) errors.push(`Nonsequential lesson ${lesson.id}`);
    for (const key of ['title', 'goal', 'scene', 'prerequisite', 'reading', 'reading_question', 'reading_answer', 'reading_why', 'writing_prompt', 'writing_hint', 'writing_check']) if (!lesson[key]) errors.push(`${lesson.id}: missing ${key}`);
    for (const key of ['words', 'dialog', 'oral', 'checks']) if (!Array.isArray(lesson[key]) || !lesson[key].length) errors.push(`${lesson.id}: missing ${key}`);
    if (!lesson.patterns?.length && !(lesson.number === 42 && lesson.reviewPatterns?.length >= 2)) errors.push(`${lesson.id}: missing patterns`);
    for (const word of lesson.words || []) if (!word.ja || !word.ko) errors.push(`${lesson.id}: incomplete word`);
    for (const pattern of patternsOf(lesson)) if (!pattern.title || !pattern.formula || !pattern.body || !pattern.examples?.length || pattern.examples.some(ex => !ex.ja || !ex.ko)) errors.push(`${lesson.id}: incomplete pattern`);
    for (const turn of lesson.dialog || []) if (!turn.role || !turn.ja || !turn.ko) errors.push(`${lesson.id}: incomplete dialogue`);
    for (const item of [...(lesson.oral || []), ...(lesson.checks || [])]) {
      if (!item.prompt || !item.answer || !item.why) errors.push(`${lesson.id}: incomplete exercise`);
      if (item.options && (new Set(item.options).size !== item.options.length || !item.options.includes(item.answer))) errors.push(`${lesson.id}: ambiguous/missing exercise answer`);
    }
    if (lesson.listen_choices && !lesson.listen_choices.includes(lesson.listen_answer)) errors.push(`${lesson.id}: missing script-check answer`);
    if (!lesson.writing_sample?.ja || !lesson.writing_sample?.ko) errors.push(`${lesson.id}: writing sample required`);
  }
  if (book.lessons?.length === 42 || Object.hasOwn(book, 'cumulativeReview')) {
    const reviews = book.cumulativeReview;
    if (!Array.isArray(reviews) || JSON.stringify(reviews.map(review => review.afterLesson)) !== JSON.stringify([7, 14, 21, 28, 35, 42])) errors.push('Six cumulative reviews required after lessons 7/14/21/28/35/42');
    const reviewIds = new Set();
    for (const review of Array.isArray(reviews) ? reviews : []) {
      if (!/^[a-z][a-z0-9-]+$/.test(review.id || '') || reviewIds.has(review.id) || ids.has(review.id) || (book.frontMatter || []).some(guide => guide.id === review.id)) errors.push(`Invalid/duplicate cumulative review ID: ${review.id}`);
      reviewIds.add(review.id);
      if (!review.title || !review.scene || !Array.isArray(review.items) || review.items.length !== 3) errors.push(`${review.id}: title/scene/three review items required`);
      const itemIds = new Set();
      for (const item of review.items || []) {
        if (!item.id || itemIds.has(item.id) || !item.prompt || !item.answer || !item.why) errors.push(`${review.id}: incomplete/duplicate review item`);
        itemIds.add(item.id);
        if (item.options && (!Array.isArray(item.options) || new Set(item.options).size !== item.options.length || !item.options.includes(item.answer))) errors.push(`${review.id}: ambiguous/missing review answer`);
        if (!Array.isArray(item.sourceUnits) || !item.sourceUnits.length || item.sourceUnits.some(number => !Number.isInteger(number) || number < 1 || number > review.afterLesson)) errors.push(`${review.id}: invalid/future review source unit`);
      }
    }
  }
  return errors;
}
export function renderBook(book, editionId) {
  const pages = [], sourceIndex = {}, chunks = [];
  const add = (id, unit, title, body, lesson) => {
    pages.push({ id, kind: id === 'cover' ? 'cover' : id.split('-').at(-1), title, ...(lesson ? { lesson: lesson.number } : {}), page: pages.length + 1 });
    const html = `<article class="paper${id === 'cover' ? ' cover' : ''}" id="${e(id)}" data-unit-page="${e(unit)}" data-book-source="true"${id !== 'cover' ? ' hidden' : ''}><div class="meta"><span>${lesson ? `${String(lesson.number).padStart(2, '0')}과 · ${e(lesson.part)}` : '일본어 N4 · 검토 원고'}</span><b>${pages.length}</b></div><h2>${e(title)}</h2>${body}<footer>manabi · 일본어 N4 · 검토 원고<span>${pages.length}</span></footer></article>`;
    chunks.push(html);
    sourceIndex[id] = { ...(lesson ? { lesson: lesson.number } : {}), text: html.replace(/<rt\b[^>]*>[\s\S]*?<\/rt>|<small class="reading-note">[\s\S]*?<\/small>/g, '').replace(/<[^>]+>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[entity])) };
  };
  const nav = [{ id: 'cover', title: '책 사용법' }, ...(book.frontMatter?.length ? [{ id: 'guide', title: '시작 안내 · N5에서 이어가기' }] : []), ...book.lessons.map(l => ({ id: l.id, title: `${String(l.number).padStart(2, '0')} · ${l.title}` })), { id: 'reference', title: '단어·문형 찾아보기' }];
  add('cover', 'cover', book.title, `<p class="intro">${e(book.subtitle)}</p><p class="goal">${e(book.review?.body || 'N5에서 익힌 작은 문장을 연결해 경험·이유·생각을 전해요.')}</p><aside class="note"><b>검토 원고 · ${e(book.lessons.length)}과</b>${p('공식 JLPT 전체 범위·학습 효과를 인증한 교재가 아니에요. 새 음성과 PDF는 제작하지 않았으며 대본 읽기를 청해 훈련으로 계산하지 않아요.')}${p('답안은 이 판본을 연 브라우저에만 저장돼요. 계정의 학습 기록·담은 표현과 연결되지 않아요.')}</aside><h3>N5에서 이어지는 학습 순서</h3>${p('장면과 단어 → 표현 설명과 예문 → 같은 대화 → 바꾸어 말하기 → 읽기·확인 → 내 문장. 해석과 정답을 가린 채 먼저 답하고 이유를 확인해요.')}<div class="sample-grid">${book.lessons.filter((_, i) => i % 7 === 0).map(l => `<a href="#${l.id}"><b>${String(l.number).padStart(2, '0')}과부터</b><span>${e(l.part)}</span></a>`).join('')}</div><p class="book-links"><a href="#u01">첫 장면 열기 →</a><a href="#reference">단어·문형 찾기 →</a></p>`);
  for (const guide of book.frontMatter || []) add(guide.id, 'guide', guide.title, `${p(guide.lead, book.kanji)}${(guide.blocks || []).map(block => `<h3>${e(block.title)}</h3>${p(block.text, book.kanji)}`).join('')}`);
  for (const lesson of book.lessons) {
    const unit = lesson.id;
    const links = `<nav class="n4-unit-links" aria-label="이 과의 흐름"><a href="#${unit}-start">장면과 준비</a><a href="#${unit}-patterns">표현 익히기</a><a href="#${unit}-dialogue">대화 대본</a><a href="#${unit}-practice">읽기와 연습</a></nav>`;
    add(`${unit}-start`, unit, lesson.title, `<span class="stage">장면과 준비</span><p class="subtitle">${e(lesson.subtitle)}</p><p class="goal">${japaneseMarkup(lesson.goal, lesson.kanji)}</p>${links}<div class="scene">${p(lesson.scene, lesson.kanji)}<div class="people">${(lesson.roles || []).map(role => `<span>${e(role)}</span>`).join('')}</div></div><h3>말할 단어 준비</h3><div class="words">${(lesson.words || []).map(word => `<div><div>${ja(word.ja, word.reading, lesson.kanji)}</div><span class="meaning">${e(word.ko)}</span></div>`).join('')}</div>${p(lesson.preparation, lesson.kanji)}<p class="prior">먼저 익힌 것 · ${japaneseMarkup(lesson.prerequisite, lesson.kanji)}</p>`, lesson);
    add(`${unit}-patterns`, unit, '작은 문장을 연결해 말해요', `${links}${lesson.number === 42 && !lesson.patterns?.length ? '<p class="goal">새 문형 0개 · 지금까지 배운 표현으로 누적 수행해요.</p>' : ''}${(lesson.study_pages || []).map(study => `<section class="pattern"><h3>${e(study.title)}</h3>${p(study.lead, lesson.kanji)}${(study.rows || []).map(row => `<div class="n4-study-row"><b>${japaneseMarkup(row.label, lesson.kanji)}</b><div>${ja(row.ja, row.reading, lesson.kanji)}<p class="meaning">${e(row.ko)}</p></div></div>`).join('')}${study.examples?.length ? examples(study.examples, lesson.kanji) : ''}${study.note ? `<aside class="note">${p(study.note, lesson.kanji)}</aside>` : ''}</section>`).join('')}${patternsOf(lesson).map((pattern, i) => `<section class="pattern"><h3><small>${String(i + 1).padStart(2, '0')}</small>${e(pattern.title)}</h3><div class="formula">${ja(pattern.formula, null, lesson.kanji)}</div><div class="explanation">${p(pattern.body, lesson.kanji)}</div>${examples(pattern.examples, lesson.kanji)}${pattern.note ? `<aside class="note">${p(pattern.note, lesson.kanji)}</aside>` : ''}</section>`).join('')}`, lesson);
    add(`${unit}-dialogue`, unit, '같은 장면에서 대화해요', `${links}<p class="small">대화 대본 확인(음성 미제작)</p><section class="dialogue"><button class="translation" aria-pressed="false">해석 가리기</button>${(lesson.dialog || []).map(turn => `<div class="turn role-${e(turn.role)}"><b>${e(turn.role)}</b><div>${ja(turn.ja, turn.reading, lesson.kanji)}<p class="ko">${e(turn.ko)}</p></div></div>`).join('')}</section>${lesson.listen_question ? `<h3>대본 내용 확인</h3>${p(lesson.listen_question, lesson.kanji)}${lesson.listen_choices ? p(lesson.listen_choices.join(' / '), lesson.kanji) : ''}${answer('대본 내용', lesson.listen_answer, lesson.listen_why, lesson.kanji)}` : ''}<h3>바꾸어 말하기</h3><div class="oral">${(lesson.oral || []).map((item, i) => `<div>${p(item.prompt, lesson.kanji)}<p class="cue">${japaneseMarkup(item.cue, lesson.kanji)}</p><label for="${unit}-oral-${i}">내 문장</label><textarea rows="2" id="${unit}-oral-${i}" data-save="${unit}-oral-${i}"></textarea>${answer(item.id || `말하기 ${i + 1}`, item.answer, item.why, lesson.kanji)}</div>`).join('')}</div>${lesson.culture ? `<aside class="note"><b>${e(lesson.culture_title)}</b>${p(lesson.culture, lesson.kanji)}</aside>` : ''}`, lesson);
    add(`${unit}-practice`, unit, '읽고, 확인하고, 내 문장으로', `${links}<h3>${e(lesson.reading_title)}</h3>${lesson.reading_lead ? p(lesson.reading_lead, lesson.kanji) : ''}<div class="reading" lang="ja">${japaneseMarkup(lesson.reading, lesson.kanji)}</div>${p(lesson.reading_question, lesson.kanji)}<label for="${unit}-reading-answer">내 답</label><textarea id="${unit}-reading-answer" data-save="${unit}-reading-answer" rows="2"></textarea>${answer('읽기', lesson.reading_answer, lesson.reading_why, lesson.kanji)}<h3>확인하고 이유 말하기</h3>${(lesson.checks || []).map((item, i) => question(unit, 'check', item, i, lesson.kanji)).join('')}<h3>내 문장</h3>${p(lesson.writing_prompt, lesson.kanji)}<p class="hint" lang="ja">${japaneseMarkup(lesson.writing_hint, lesson.kanji)}</p><label for="${unit}-writing">내가 쓴 문장</label><textarea rows="4" id="${unit}-writing" data-save="${unit}-writing"></textarea>${p(lesson.writing_check, lesson.kanji)}<details class="n4-answer"><summary>내 문장 예시 보기</summary>${examples([lesson.writing_sample], lesson.kanji)}</details>${cumulativeSection(book, lesson)}${p(lesson.next, lesson.kanji)}<p class="book-links">${book.lessons.find(l => l.number === lesson.number + 1) ? `<a href="#u${String(lesson.number + 1).padStart(2, '0')}">다음 장면 →</a>` : '<a href="#cover">처음으로 →</a>'}<a href="#reference">찾아보기 →</a></p>`, lesson);
  }
  add('reference-start', 'reference', '단어·문형 찾아보기', `<label for="lex-search">일본어·읽기·한국어 찾기</label><input id="lex-search" type="search" placeholder="예: 約束 · やくそく · 약속"><p class="search-status" aria-live="polite"></p><h3>단어를 장면으로 되돌리기</h3><div class="n4-reference">${book.lessons.flatMap(l => (l.words || []).map(word => `<div data-search="${e([word.ja, word.reading, ...Object.entries(l.kanji || {}).filter(([key]) => word.ja.includes(key)).map(([, reading]) => reading), word.ko].filter(Boolean).join(' '))}">${ja(word.ja, word.reading, l.kanji)}<p class="meaning">${e(word.ko)}</p><a href="#${l.id}-start">${String(l.number).padStart(2, '0')}과로 돌아가기 →</a></div>`)).join('')}</div><h3>문형 다시 꺼내기</h3><div class="n4-reference">${book.lessons.flatMap(l => patternsOf(l).map(pattern => `<div data-search="${e(`${pattern.title} ${pattern.formula} ${pattern.body}`)}">${ja(pattern.formula, null, l.kanji)}${p(pattern.title)}<a href="#${l.id}-patterns">설명과 예문으로 →</a></div>`)).join('')}</div>`);
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="manuscript-revision" content="${editionId}"><meta name="book-status" content="draft"><title>manabi · ${e(book.title)} · N4 검토 원고</title><link rel="icon" href="data:,"><link rel="stylesheet" href="style.css"></head><body><header class="top"><a class="brand" href="#cover">manabi</a><span>일본어 N4 · 웹 교재 검토 원고</span></header><div class="layout"><aside class="sidebar"><p class="eyebrow">N5의 작은 문장에서 한 걸음 더</p><h1>${e(book.title)}</h1><nav aria-label="과 선택">${nav.map(item => `<a href="#${e(item.id)}" data-unit="${e(item.id)}">${e(item.title)}</a>`).join('')}</nav><p class="small">밝은 모브 · 장면·표현·예문·다시 쓰기</p></aside><main><p class="draft-banner">검토 원고 · 공식 JLPT 전체 범위 미인증 · 새 음성·PDF 미제작</p><p class="draft-status" aria-live="polite">답안은 이 판본을 연 브라우저에 저장돼요.</p><div class="modebar"><a href="#cover">책 사용법</a><a href="#reference">찾아보기</a><button data-toggle="meanings" aria-pressed="false">뜻 가리기</button><button data-toggle="readings" aria-pressed="false">읽기 가리기</button></div><div id="web">${chunks.join('\n')}</div></main></div><script src="app.js" defer></script></body></html>`;
  return { html, pages, sourceIndex };
}
export async function buildBook({ sourceDir, outDir, repoRoot = path.resolve(toolRoot, '../..') }) {
  const manuscript = await loadManuscript(sourceDir);
  const pinnedCss = path.join(repoRoot, 'src/content/textbookEditions/8a8c1c1fd452773810abaf8c/style.css');
  manuscript.templates = Object.fromEntries(await Promise.all(['build-n4-web.mjs', 'n4-runtime.js', 'n4-web.css', 'prepare-n4-fonts.py'].map(async file => [file, sha256(await fs.readFile(path.join(toolRoot, file)))])));
  manuscript.templates.n5StylesSha256 = sha256(await fs.readFile(pinnedCss));
  const errors = validateSource(manuscript);
  if (errors.length) throw new Error(errors.join('\n'));
  const contentHash = sha256(JSON.stringify(canonical(manuscript)));
  const editionId = contentHash.slice(0, 24);
  const { html, pages, sourceIndex } = renderBook(manuscript, editionId);
  const n5Style = (await fs.readFile(pinnedCss, 'utf8')).replace(/\/api\/books\/japanese-n5\/7f572327dc67893e9453246c\/asset\?file=/g, '').replace(/\.woff2/g, '.woff');
  const assets = {};
  await fs.mkdir(outDir, { recursive: true });
  if ((await fs.readdir(outDir)).length) throw new Error('Output directory must be empty; published artifacts are never overwritten');
  const put = async (file, bytes, type) => { await fs.mkdir(path.dirname(path.join(outDir, file)), { recursive: true }); await fs.writeFile(path.join(outDir, file), bytes); assets[file] = { sha256: sha256(bytes), bytes: Buffer.byteLength(bytes), type }; };
  await put('index.html', html, 'text/html; charset=utf-8');
  await put('style.css', `${n5Style}\n${await fs.readFile(path.join(toolRoot, 'n4-web.css'), 'utf8')}`, 'text/css; charset=utf-8');
  await put('app.js', await fs.readFile(path.join(toolRoot, 'n4-runtime.js')), 'text/javascript; charset=utf-8');
  await promisify(execFile)('python', [path.join(toolRoot, 'prepare-n4-fonts.py'), '--out', outDir], { maxBuffer: 1024 * 1024 });
  for (const folder of ['fonts', 'font-licenses']) for (const name of (await fs.readdir(path.join(outDir, folder))).sort()) await put(`${folder}/${name}`, await fs.readFile(path.join(outDir, folder, name)), name.endsWith('.woff') ? 'font/woff' : 'text/plain; charset=utf-8');
  await put('font-audit.json', await fs.readFile(path.join(outDir, 'font-audit.json')), 'application/json');
  const bundle = { bookId: 'japanese-n4', editionId, contentHash, status: 'draft', manuscript, pages, sourceIndex, assets, artifactManifest: { bundleHash: sha256(JSON.stringify(canonical(assets))), pages: pages.length, webContentRevision: editionId, media: { web: true, pdf: false, audio: false }, tooling: 'N4 renderer reimplementation; original N5 tooling not recovered', inheritedVisuals: { editionId: '8a8c1c1fd452773810abaf8c', cssSha256: sha256(await fs.readFile(pinnedCss)), fonts: 'Local OFL Noto CJK families refreshed for this artifact; see font-audit.json' } }, qa: { passed: false, status: 'unreviewed-draft', scope: 'Build only. Structural, independent language and browser review required.' } };
  await fs.writeFile(path.join(outDir, 'bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  return { editionId, contentHash, lessons: manuscript.lessons.length, pages: pages.length, outDir };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  const repoRoot = path.resolve(toolRoot, '../..');
  const sourceDir = path.resolve(value('--source') || path.join(repoRoot, 'src/content/textbookManuscripts/japanese-n4'));
  const outDir = path.resolve(value('--out') || '/workspace/scratch/n4-production/web');
  buildBook({ sourceDir, outDir, repoRoot }).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
