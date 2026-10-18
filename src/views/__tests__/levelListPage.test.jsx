// 레벨별 단어 · 문형 목록 화면(LEVEL-LIST-AJ-001) — 서버 렌더 마크업 계약.
// 서버 렌더는 계정 상태(저장됨 · 아는 단어 · 듣기)를 그리지 않는다 → 브라우저 첫 렌더와 같다(하이드레이션 불일치 0, 수용 기준 8).
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

vi.mock('next/navigation', () => ({ usePathname: () => '/japanese/vocab/n5' }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/useTTS', () => ({ useTTS: () => ({ speak: () => {}, supported: true }) }));
vi.mock('@/lib/useKnownWords', () => ({ useKnownWords: () => ({ rows: [], isPendingWord: () => false, mutation: { mutate: () => {} } }) }));
vi.mock('@/lib/useWordFacets', () => ({ useWordFacets: () => ({ available: true, rows: [], mark: () => {} }) }));
// 한자판은 next/dynamic으로 지연 로드한다(levelListLazy 계약). 기본값(ssr)이라 Next 서버 렌더는 한자판을 그려 보낸다 —
// 동기 renderToStaticMarkup에서도 같은 마크업을 보도록, 불러올 모듈을 미리 받아 돌려준다.
vi.mock('next/dynamic', async () => {
  const board = await import('../../components/levels/HanziBoard.jsx');
  return { default: () => board.default };
});

const { default: LevelListPage, VocabCard, SND_HOLD } = await import('../LevelListPage.jsx');
const { LEVEL_HUN_PX, hunHoldCells, hunShapeOf } = await import('../../lib/levelList.js');
const { levelListData: levelData } = await import('../../lib/levelListData.js');
const { levelListData } = await import('../../lib/levelListData.js');
const { normalizeLevelPrefs } = await import('../../lib/levelList.js');
const { default: LevelTiles } = await import('../../components/levels/LevelTiles.jsx');

const { hunRubyCells } = await import('../../lib/viewerHunRuby.js');
const { glyphRows } = await import('../../lib/glyphColumn.js');
const tables = {
  koTable: (await import('../../lib/data/hanjaKo.json')).default,
  hunTable: (await import('../../lib/data/hanjaHun.json')).default,
  tradTable: (await import('../../lib/data/hanjaTrad.json')).default,
};
const jaTable = (await import('../../lib/data/jaWords.json')).default;
const render = async (lang, kind, level) => renderToStaticMarkup(<LevelListPage {...await levelListData(lang, kind, level)} />);
const count = (html, needle) => html.split(needle).length - 1;

describe('단어 목록', () => {
  it('N5: 가나 먼저 크게 + 한자 작게, 카드마다 [O][X] 순서 · 이름표 · 출처 한 줄', async () => {
    const html = await render('japanese', 'vocab', 'n5');
    expect(html).toContain('<h1>N5 단어</h1>');
    expect(html).toMatch(/<span class="lv-hw" lang="ja">[ぁ-ゖァ-ヺー]+<\/span><span class="lv-kj" lang="ja">[^<]*[一-龯][^<]*<\/span>/);
    // 처음엔 150개만(전: 950개 전부 → 후: 150개 + 「더 보기」 — smoke e2e N3 DOM 예산). 묶음 제목 개수는 전체 기준.
    const cards = count(html, 'class="lv-entry"');
    expect(cards).toBe(150);
    expect(html).toContain('>더 보기</button>'); // 「N개 남음」은 진도 줄 하나뿐(LEVEL-FLOW-001)
    expect(html).not.toContain('800개 남음');
    expect(count(html, 'aria-label="안다 — 아는 단어로" title="안다"')).toBe(cards);
    expect(count(html, 'aria-label="모른다 — 공부 중인 단어로" title="모른다"')).toBe(cards);
    expect(html.indexOf('lv-fab--o')).toBeLessThan(html.indexOf('lv-fab--x'));
    expect(html).not.toMatch(/lv-fab--(ex|save)|뜻 가리기|<input(?![^>]*type="search")/); // 옛 [제외][저장] · 뜻 가리기 · 채점 입력창 0
    // 보기 탭 하나 고르기(처음엔 전체) + ⚙ 설정(닫힘) — 옵션 칩 줄 없음
    const tabs = [...sliceBetween(html, '<div class="lv-view" role="group" aria-label="보기">', '</div>').matchAll(/aria-pressed="(true|false)">([^<]+)/g)].map((m) => `${m[2]}:${m[1]}`);
    expect(tabs).toEqual(['전체:true', '글자:false', '문장:false', '뜻:false', '소리:false']);
    expect(html).toContain('aria-label="설정" title="설정" aria-expanded="false" aria-controls="lv-settings"');
    expect(html).not.toMatch(/id="lv-settings"|lv-opt/);
    expect(html).toContain('<p class="lv-src">출처 open-anki-jlpt-decks</p>');
  });

  it('N3: 한자 위 읽기(루비) — 가나 먼저 아님', async () => {
    const html = await render('japanese', 'vocab', 'n3');
    expect(html).toMatch(/<span class="lv-hw" lang="ja"><ruby>[^<]+<rt>/);
    expect(html).not.toContain('class="lv-kj"');
  });

  it('중국어: 병음은 옆 · 아래 작은 줄, 위 읽기 없음 · 2026 급수 기준 출처', async () => {
    const html = await render('chinese', 'vocab', 'h1');
    expect(html).toContain('<h1>HSK 1 단어</h1>');
    // 표제어는 훈음 자리(LEVEL-HUN-HOLD-001)와 함께 — 글자 칸 + 빈 훈음 칸, 그 뒤 병음
    expect(html).toMatch(/<span class="lv-hw lv-hw--hun" lang="zh-CN">(<span class="lv-hc"><span class="lv-hc__ch">[^<]<\/span>(<span class="word-fit__hun lv-hun-hold"[^>]*>(<span class="word-fit__hun-line">\u00a0<\/span>)+<\/span>)?<\/span>)+<\/span><span class="lv-py">/);
    expect(html).toContain('class="lv-ex__py"');
    expect(html).not.toContain('<ruby>');
    expect(html).toContain('中文水平考试 HSK 考试大纲');
    // 서버 렌더는 훈음 표가 없어 훈음 글 0(하이드레이션 같음) — 표는 붙은 뒤 받고, 그 전에는 같은 상자의 빈 자리만(LEVEL-HUN-HOLD-001)
    expect(html).not.toContain('data-label=');
    expect(html).toContain('lv-hun-hold');
  });

  it('레벨 알약 · 탭 · 「← 교재」 — 보관함 · 문법 링크 0', async () => {
    const html = await render('chinese', 'vocab', 'h2');
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toContain('/lessons?lang=Chinese');
    expect(new Set(hrefs.filter((h) => /^\/chinese\/vocab\/h[1-6]$/.test(h))).size).toBe(6); // 알약 6 + 「단어」 탭
    expect(hrefs).toContain('/chinese/bunkei/h2');
    expect(hrefs.filter((h) => /grammar|legacy/.test(h))).toEqual([]);
    // 알약 · 탭 안의 이동 대기 표시(NavPendingMark — APP-FEEL-003)는 화면 읽기에 숨긴 빈 span이다.
    const PEND = '<span class="nav-pending" aria-hidden="true"></span>';
    expect(html).toMatch(new RegExp(`<a aria-current="page" aria-label="HSK 2" href="/chinese/vocab/h2">2${PEND}</a>|<a href="/chinese/vocab/h2" aria-current="page" aria-label="HSK 2">2${PEND}</a>`));
  });
});

describe('단어 카드 — 고른 것 하나만 · 펼치기 · 훈음 · 正日(LEVEL-OX-AN-001 4판)', () => {
  const entry = { key: '学习', word: '学习', reading: 'xuéxí', meaning: '배우다, 공부하다', fullMeaning: '배우다', pos: '동사',
    ex: { text: '我在学习汉语。', reading: 'wǒ zài xuéxí hànyǔ.', ko: '나는 중국어를 공부하고 있다.' } };
  const card = (view, extra = {}) => renderToStaticMarkup(<VocabCard entry={entry} lang="chinese" levelKey="h1" view={view} peek={extra.peek}
    onPeek={() => {}} speak={() => {}} hunCells={hunRubyCells(entry.word, tables, { glyphPx: 27, hunPx: 12 })}
    glyph={extra.glyph ? glyphRows({ word: entry.word, tradTable: tables.tradTable, jaTable }) : null}
    known={!!extra.known} studying={!!extra.studying} saving={false} pendingKnown={false} onO={() => {}} onX={() => {}} />);

  const solo = (html) => sliceBetween(html, '<div class="lv-solo">', '</div><div class="lv-acts">').replace('<div class="lv-solo">', '');
  const reveal = (html) => sliceBetween(html, '<div class="lv-reveal__body">', '</div><i ').replace('<div class="lv-reveal__body">', '');

  it('전체: 글자마다 훈음(정체 꼴로 찾기 — 学→學 배울 학) · 병음 · 뜻 · 예문 · 듣기', () => {
    const html = card('all');
    expect([...html.matchAll(/data-label="([^"]+)"/g)].map((m) => m[1])).toEqual(['배울 학', '익힐 습']);
    expect(html).toContain('xuéxí');
    expect(html).toContain('배우다, 공부하다');
    expect(html).toContain('나는 중국어를 공부하고 있다.');
    expect(count(html, 'aria-label="듣기"')).toBe(1);
    expect(html).not.toMatch(/lv-veil|lv-solo|lv-sr/);
  });

  it('단어: 글자 + 훈음만(병음 · 뜻 · 예문 없음, 가린 칸 없음) — 카드 탭 · 숨은 「펼쳐 보기」 버튼', () => {
    const html = card('word');
    const body = solo(html);
    expect(body).toContain('data-label="배울 학"');
    expect(body).not.toMatch(/xuéxí|배우다|我在|나는|lv-snd|lv-veil/);
    expect(html).toContain('<button type="button" class="lv-sr" aria-expanded="false">펼쳐 보기</button>');
    expect(html).not.toContain('lv-reveal'); // 접혀 있을 땐 펼칠 내용을 그리지 않는다
    expect(html).toContain('lv-fab--o');
  });

  it('뜻 · 문장 · 소리: 그 하나만', () => {
    expect(solo(card('meaning'))).toBe('<p class="lv-solo__mean">배우다, 공부하다</p>');
    expect(solo(card('sentence'))).toBe('<p class="lv-solo__ex" lang="zh-CN">我在学习汉语。</p>');
    expect(solo(card('audio'))).toMatch(/^<button type="button" class="lv-solo__play" aria-label="듣기" title="듣기"><svg/);
  });

  it('펼치기(4판): 고른 줄은 그대로 · 나머지만 아래에, 다시 누르면 접기 · 남은 시간 줄 · 접히는 중엔 시간 줄 없음', () => {
    for (const view of ['word', 'sentence', 'meaning', 'audio']) {
      const open = card(view, { peek: 'open' });
      expect(solo(open)).toBe(solo(card(view))); // 고른 줄은 펼쳐도 같은 자리 · 같은 모양
      expect(open).toContain('data-peek="open"');
      expect(open).toContain('<button type="button" class="lv-sr" aria-expanded="true">접기</button>');
      expect(open).toMatch(/<i class="lv-reveal__time" style="animation-duration:10000ms" aria-hidden="true"><\/i>/);
      expect(card(view, { peek: 'closing' })).not.toContain('lv-reveal__time');
    }
    // 단어 → 병음 · 뜻 · 예문, 뜻 → 표제어 · 예문(뜻 반복 없음), 문장 → 예문 병음 · 해석 + 표제어 · 뜻(예문 글자 반복 없음)
    const word = reveal(card('word', { peek: 'open' }));
    expect(word).toMatch(/^<p class="lv-reveal__line"><span class="lv-py">xuéxí<\/span>/);
    expect(word).toContain('배우다, 공부하다');
    expect(word).toContain('我在学习汉语。');
    const meaning = reveal(card('meaning', { peek: 'open' }));
    expect(meaning).toContain('data-label="배울 학"');
    expect(meaning).not.toContain('lv-mean');
    expect(meaning).toContain('나는 중국어를 공부하고 있다.');
    const sentence = reveal(card('sentence', { peek: 'open' }));
    expect(sentence).toContain('wǒ zài xuéxí hànyǔ.');
    expect(sentence).not.toContain('我在学习汉语。');
    expect(sentence).toContain('<p class="lv-mean">배우다, 공부하다</p>');
    const audio = reveal(card('audio', { peek: 'open' }));
    expect(audio).toContain('xuéxí');
    expect(audio).toContain('<p class="lv-mean">배우다, 공부하다</p>');
    // 전체 보기는 펼치기가 없다
    expect(card('all', { peek: 'open' })).not.toMatch(/data-peek|lv-reveal/);
  });

  it('[O][X]: 아는 단어면 O만 눌림(점선 카드), 공부 중이면 X만 눌림', () => {
    const pressed = (html) => [...html.matchAll(/lv-fab--(o|x)[^"]*" aria-pressed="(true|false)"/g)].map((m) => `${m[1]}:${m[2]}`);
    expect(pressed(card('all'))).toEqual(['o:false', 'x:false']);
    expect(pressed(card('all', { known: true, studying: true }))).toEqual(['o:true', 'x:false']);
    expect(card('all', { known: true })).toContain('data-known="true"');
    expect(pressed(card('all', { studying: true }))).toEqual(['o:false', 'x:true']);
  });

  it('[O][X]는 어느 보기든 동그라미 아이콘만 — 이름표 글자 0 · 가운데 맞춤은 기본 .lv-fab(오너 2026-10-17)', () => {
    for (const view of ['all', 'word', 'meaning']) {
      const acts = sliceBetween(card(view), '<div class="lv-acts">', '</div>');
      expect(count(acts, '<button')).toBe(2);
      expect(acts).not.toMatch(/<span|안다<|모른다</);
      expect(acts).toMatch(/aria-label="[^"]*안다/); // 화면 읽기 이름은 그대로
    }
    // 중국어 덮어쓰기가 기본 .lv-fab의 inline-grid · place-items(가운데)를 다시 풀지 않는다 — 탭 보기 아이콘 쏠림의 원인
    const css = fs.readFileSync(new URL('../../components/levels/level-list.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.lv-fab\{[^}]*display:inline-grid;place-items:center/);
    const zhFab = [...css.matchAll(/\[data-language="zh"\][^{]*\.lv-fab(?![-\w])[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join(';');
    expect(zhFab).not.toMatch(/display:|padding:|min-width:|border-radius:|font:/);
  });

  it('성조 색(옵션): 켜면 음절마다 lv-tone--N, 끄면 병음 한 덩어리 · 공부 중 카드는 data-studying', () => {
    const tone = (html) => [...html.matchAll(/lv-tone--(\d)">([^<]+)/g)].map((m) => `${m[2]}${m[1]}`);
    const toned = renderToStaticMarkup(<VocabCard entry={entry} lang="chinese" levelKey="h1" view="all" tone onPeek={() => {}} speak={() => {}}
      hunCells={null} glyph={null} known={false} studying saving={false} pendingKnown={false} onO={() => {}} onX={() => {}} />);
    expect(tone(toned).slice(0, 2)).toEqual(['xué2', 'xí2']);
    expect(toned).toContain('data-studying="true"');
    expect(card('all')).not.toMatch(/lv-tone|data-studying/);
    expect(card('all', { known: true, studying: true })).not.toContain('data-studying'); // 아는 쪽이 먼저
  });

  it('한자 대조(옵션): 正 대만 정체 · 日 일본어 표기 한 줄 — 뷰어 glyphRows 그대로', () => {
    expect(card('all')).not.toContain('lv-glyph');
    const html = card('all', { glyph: true });
    expect(html).toContain('<b aria-label="대만 정체">正</b><span lang="zh-TW">學習</span>');
    expect(html).toContain('<b aria-label="일본어 표기">日</b><span lang="ja">学習</span><small lang="ja">がくしゅう</small>');
    expect(card('meaning', { glyph: true })).not.toContain('lv-glyph'); // 뜻만 볼 때는 표제어와 함께 빠진다
    expect(solo(card('word', { glyph: true }))).toContain('lv-glyph');
  });
});

describe('머리 · 진도 · X 펼침(LEVEL-FLOW-001 — 디자인 검토 2026-10-16 KST)', () => {
  const page = fs.readFileSync('src/views/LevelListPage.jsx', 'utf8');

  it('단어 목록 머리 = 붙는 한 줄(제목 · ▾ · 찾기 · ⚙) — 레벨 알약 · 목록 탭은 ▾ 안에 접혀 있다(DOM에는 있다)', async () => {
    const html = await render('chinese', 'vocab', 'h1');
    expect(html).toContain('<div class="lv-bar lv-bar--sticky">');
    expect(html).toMatch(/<button type="button" class="lv-navbtn" aria-label="레벨 · 목록 바꾸기" title="레벨 · 목록 바꾸기" aria-expanded="false" aria-controls="lv-nav">/);
    expect(html).toContain('<div class="lv-nav" id="lv-nav" hidden="">');
    expect(sliceBetween(html, '<div class="lv-nav" id="lv-nav" hidden="">', '<div class="lv-view"')).toContain('class="lv-pills"');
    expect(html).toContain('aria-label="찾기" title="찾기" aria-expanded="false" aria-controls="lv-find"');
    expect(html).not.toContain('class="lv-search"'); // 찾기 칸은 눌러야 열린다
    expect(html).not.toContain('lv-view__hint');
    // 접힘은 hidden 속성 — .lv-nav의 display가 그것을 이기지 않아야 한다(실브라우저 390에서 실측된 빈틈)
    expect(fs.readFileSync('src/components/levels/level-list.css', 'utf8')).toContain('.lv-nav[hidden]{display:none}');
  });

  it('▾를 열면 카드 하나 — 「레벨」 · 「목록」 이름표 + 꽉 찬 세그먼트, ← 교재는 맨 아래(오너 2026-10-17 「자연스럽게」)', async () => {
    const nav = (html) => sliceBetween(html, '<div class="lv-nav" id="lv-nav"', '<div class="lv-view"');
    const keys = (html) => [...nav(html).matchAll(/<span class="lv-nav__k" aria-hidden="true">([^<]+)<\/span>/g)].map((m) => m[1]);
    const h1 = await render('chinese', 'vocab', 'h1');
    expect(keys(h1)).toEqual(['레벨', '목록']);
    expect(nav(h1).indexOf('lv-nav__k')).toBeLessThan(nav(h1).indexOf('class="lv-pills"'));
    expect(keys(await render('chinese', 'vocab', 'h7'))).toEqual(['레벨']); // 목록 탭이 없으면 이름표도 없다
    // 문형 · 한자(펼친 머리)에는 이름표를 그리지 않는다
    expect(await render('chinese', 'bunkei', 'h1')).not.toContain('lv-nav__k');
    const css = fs.readFileSync('src/components/levels/level-list.css', 'utf8');
    expect(css).toMatch(/\.lv-bar--sticky \.lv-nav\{[^}]*border:1px solid var\(--lv-line\);border-radius:12px;background:var\(--lv-card\)/); // ⚙ 설정과 같은 카드
    expect(css).toMatch(/\.lv-bar--sticky \.lv-pills\{display:grid;grid-auto-flow:column;grid-auto-columns:minmax\(0,1fr\)/);
    expect(css).toMatch(/\.lv-bar--sticky \.lv-crumb\{order:9/);
    expect(css).toContain('@media (prefers-reduced-motion:reduce){.lv-bar--sticky :is(.lv-nav,.lv-settings,.lv-tools){animation:none}}'); // 내려오는 움직임은 줄이기 설정에서 끈다
  });

  it('넓은 화면 균형: 묶음은 가운데 · 단어 목록은 목차 없이 680px 한 줄 + 품사 칩(오너 2026-10-16 「1440에서 균형」)', async () => {
    const css = fs.readFileSync('src/components/levels/level-list.css', 'utf8');
    expect(css).toContain('.lv-page>*{max-width:904px;margin-inline:auto}');
    expect(css).toContain('.lv-page--vocab>*{max-width:680px}');
    expect(css).toContain('.lv-page--bunkei .lv-chips,.lv-page--vocab .lv-chips{display:flex}');
    expect(css).toMatch(/^\.lv-chips\{[^}]*margin:18px auto 0;/m); // 칩 줄도 가운데(margin 단축형이 margin-inline:auto를 지우지 않게)
    const html = await render('chinese', 'vocab', 'h1');
    expect(html).not.toMatch(/lv-tocnav|lv-toc/);
    expect(html).toContain('<nav class="lv-chips" aria-label="주제">');
  });

  it('문형 · 한자는 그대로 펼친 머리(붙지 않음 · ▾ 없음)', async () => {
    for (const [kind, level] of [['bunkei', 'h1'], ['hanzi', 'h1']]) {
      const html = await render('chinese', kind, level);
      expect(html, kind).toContain('<div class="lv-bar">');
      expect(html, kind).toContain('<div class="lv-nav" id="lv-nav">');
      expect(html, kind).not.toMatch(/lv-navbtn|lv-bar--sticky/);
    }
  });

  it('진도 줄: 숫자는 「N개 남음」 하나 + 「복습하기 →」(숫자 없음) — 로그인 · 붙은 뒤에만, 서버 렌더엔 숫자 없이 빈 자리만', async () => {
    // 서버(정적) 그림에는 진도 숫자 · 막대 채움이 없다 — 같은 높이의 빈 자리(.lv-prog--hold, aria-hidden · 평소 꺼짐)만 간다(LEVEL-PROG-HOLD-001).
    const ssr = await render('chinese', 'vocab', 'h1');
    expect(ssr).toContain('<div class="lv-prog lv-prog--hold" aria-hidden="true"><span class="lv-meter"></span></div>');
    expect(ssr).not.toMatch(/lv-prog__left|lv-prog__review|lv-meter__[ks]|개 남음/);
    expect(await render('japanese', 'bunkei', 'n5')).not.toContain('lv-prog'); // 진도는 단어 탭만
    const prog = sliceBetween(page, ': progress && <div className="lv-prog">', '</div>}');
    // 바퀴 끝 카드(LEVEL-ROUND-001 ②)는 진도 줄 자리의 요약이라 숫자를 둔다 — 공부 중 진도 줄은 여전히 숫자 하나.
    expect(sliceBetween(page, '<section className="lv-end" aria-label="바퀴 끝">', '</section>')).toContain('모른 단어 ${progress.studying');
    expect([...prog.matchAll(/\$\{[^}]+\}개/g)].map((m) => m[0])).toEqual(["${progress.left.toLocaleString('en-US')}개"]);
    expect(prog).toContain('{progress.studying > 0 && <Link className="lv-prog__review" href={reviewHref} prefetch={false}>복습하기 →</Link>}');
    expect(prog).not.toMatch(/progress\.(known|studying|total)\}/); // 아는 · 공부 중 개수는 배움 입구 카드에만
    // 묶음 제목 · 목차에 「31/121」 같은 진도 분수 없음
    expect(page).not.toMatch(/<h2[^\n]*\/\{|lv-toc[^\n]*count/);
  });

  it('⚙ 「X 누르면 답 펼치기」 — 기본 켬, 끄면 X는 기록만(카드는 접힌 채)', () => {
    expect(normalizeLevelPrefs({}).peekOnX).toBe(true);
    expect(normalizeLevelPrefs({ peekOnX: false }).peekOnX).toBe(false);
    const panel = sliceBetween(page, '<div className="lv-settings" id="lv-settings">', '</div>}');
    expect(panel).toContain("['peekOnX', 'X 누르면 답 펼치기', '단어 · 문장 · 뜻 · 소리 탭']");
    // 펼치기는 studyX 한 곳뿐 — 클릭 · 키보드 X가 모두 이 길을 지난다.
    expect([...page.matchAll(/openPeek\(entry\.key\)/g)]).toHaveLength(1);
  });

  it('탭 보기에서 X = 그 카드를 펼쳐 답을 본다 · 「복습하기」 알림은 KST 하루 한 번', () => {
    const markX = sliceBetween(page, 'const studyX = async (entry) => {', '};'); // 아는 단어 풀기를 기다리므로 async — 전체 · 탭 X 공통
    expect(markX).toContain("if (prefs.view !== 'all' && prefs.peekOnX) openPeek(entry.key);");
    const nudge = sliceBetween(page, 'const nudgeReview = () => {', '};');
    expect(nudge).toContain('if (localStorage.getItem(NUDGE_KEY) === kstDay()) return; localStorage.setItem(NUDGE_KEY, kstDay());');
    expect(nudge).toContain("action: '복습하기'");
    expect(page).toContain('const kstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);');
    expect(page).toMatch(/\{ nudgeReview\(\); return done\(true\); \}/); // 저장이 된 뒤에만
  });
});

describe('문형 목록', () => {
  it('읽기 전용 — 저장 · 번호 · 캡션 · 펼치기 0, note 없는 문형엔 주의 줄 0', async () => {
    const data = await levelListData('chinese', 'bunkei', 'h1');
    const html = renderToStaticMarkup(<LevelListPage {...data} />);
    expect(html).toContain('<h1>HSK 1 문형</h1>');
    expect(html).not.toMatch(/lv-fab|저장|<details|<ol|예문<\/|lv-toc/);
    const pats = data.groups.flatMap((g) => g.entries);
    expect(count(html, 'class="lv-pat"')).toBe(pats.length);
    expect(count(html, 'class="lv-note"')).toBe(pats.filter((p) => p.note).length);
    expect(count(html, 'class="lv-formula"')).toBe(pats.filter((p) => p.conn).length);
    expect(html).toContain('class="lv-chips"');
  });
});

describe('한자 목록(HANZI-TAB-AL-001)', () => {
  const TONE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
  it('HSK 1 한자: 세 번째 탭 · 글자만(병음 · 뜻 0) · 묶음 목차 · 시작 버튼', async () => {
    const data = await levelListData('chinese', 'hanzi', 'h1');
    const html = renderToStaticMarkup(<LevelListPage {...data} />);
    expect(html).toContain('<h1>HSK 1 한자</h1>');
    const tabs = [...html.matchAll(/<nav class="lv-tabs"[^>]*>(.*?)<\/nav>/g)][0][1];
    expect([...tabs.matchAll(/>([^<]+)<span class="nav-pending" aria-hidden="true"><\/span><\/a>/g)].map((m) => m[1])).toEqual(['단어', '문형', '한자']);
    expect(html).not.toMatch(TONE);
    const table = (await import('../../lib/data/zhHanzi/H1.json')).default;
    const glosses = Object.values(table.chars).flatMap((c) => c.rd.flatMap((r) => r.s.map((x) => x.g)));
    expect(glosses.filter((g) => [...g].length >= 2 && html.includes(g))).toEqual([]); // 한 글자 뜻(소 · 나)은 화면 문구와 겹쳐 뺀다
    expect(count(html, 'class="hz-cell')).toBe(data.groups[0].entries.length);
    expect(html).toContain('>문법 글자<');
    expect(html).toContain('넘기며 확인 <small>');
    expect(html).not.toContain('모름만'); // 로그인 전 · 표시 0
    expect(html).not.toContain('class="lv-search"');
    // 알약: 한자 탭이 있는 급수(1 · 2)는 한자로, 없는 급수(3–6)는 단어로 — 없는 주소(404) 0
    const pills = [...html.matchAll(/href="(\/chinese\/[a-z]+\/h\d)" aria-label="HSK [\d–]+"|aria-label="HSK [\d–]+" href="(\/chinese\/[a-z]+\/h\d)"/g)].map((m) => m[1] || m[2]);
    expect(pills).toEqual(['/chinese/hanzi/h1', '/chinese/hanzi/h2', '/chinese/vocab/h3', '/chinese/vocab/h4', '/chinese/vocab/h5', '/chinese/vocab/h6', '/chinese/vocab/h7']);
  });

  it('한자 탭은 HSK 1–2급만 — 3급 이상 · 일본어에는 없다', async () => {
    expect(await render('chinese', 'vocab', 'h1')).toContain('href="/chinese/hanzi/h1"');
    expect(await render('chinese', 'vocab', 'h3')).not.toContain('/chinese/hanzi/');
    expect(await levelListData('chinese', 'hanzi', 'h3')).toBeNull();
    expect(await levelListData('japanese', 'hanzi', 'n5')).toBeNull();
  });
});

describe('HSK 7–9(단어 탭 하나)', () => {
  it('알약 「7–9」 · 제목 「HSK 7–9 단어」, 종류 탭을 그리지 않는다', async () => {
    const html = await render('chinese', 'vocab', 'h7');
    expect(html).toContain('<h1>HSK 7–9 단어</h1>');
    expect(html).toMatch(/aria-label="HSK 7–9"[^>]*>7–9</);
    expect(html).not.toContain('class="lv-tabs"');
    expect(html).not.toContain('/chinese/bunkei/h7');
    expect(await render('chinese', 'vocab', 'h6')).toContain('class="lv-tabs"');
  });

  it('타일은 「단어 N」 한 줄 — 문형 줄 · 0 링크 없음', () => {
    const html = renderToStaticMarkup(<LevelTiles language="Chinese" tiles={[{ levelKey: 'H6', vocab: 1777, bunkei: 59 }, { levelKey: 'H7', vocab: 1332 }]} />);
    expect(html).toContain('<span class="lv-tile__lv">HSK 7–9</span>');
    expect(html).toContain('href="/chinese/vocab/h7"');
    expect(html).not.toContain('/chinese/bunkei/h7');
    expect(html).not.toContain('문형<b>0</b>');
  });
});

describe('책장 타일', () => {
  it('레벨 + 「단어 N / 문형 N」 두 줄, 숫자는 넘겨받은 값(천 단위 쉼표)', () => {
    const html = renderToStaticMarkup(<LevelTiles language="Chinese" tiles={[{ levelKey: 'H1', vocab: 300, bunkei: 77 }, { levelKey: 'H6', vocab: 1384, bunkei: 59 }]} />);
    expect(html).toContain('<span class="lv-tile__lv">HSK 1</span>');
    expect(html).toContain('href="/chinese/vocab/h6"');
    expect(html).toContain('단어<b>1,384</b>');
    expect(html).toContain('문형<b>77</b>');
    expect(html).not.toContain('→');
    expect(renderToStaticMarkup(<LevelTiles language="English" tiles={[{ levelKey: 'A1', vocab: 1, bunkei: 1 }]} />)).toBe('');
  });
});

describe('진도 줄 자리(LEVEL-PROG-HOLD-001) — 세션 쿠키가 있으면 첫 그림부터 같은 높이', () => {
  const css = fs.readFileSync('src/components/levels/level-list.css', 'utf8');
  const page = fs.readFileSync('src/views/LevelListPage.jsx', 'utf8');
  const run = async (cookie, existing = false) => {
    const { default: vm } = await import('node:vm');
    const { sessionHintScript } = await import('@/lib/authCookie');
    const appended = [];
    vm.runInNewContext(sessionHintScript('lv-prog-hold', '.lv-bar .lv-prog--hold{display:flex}'), { document: { cookie, getElementById: () => (existing ? {} : null), createElement: () => ({}), head: { appendChild: (n) => appended.push(n) } } });
    return appended;
  };
  it('판정은 정본(SESSION_COOKIE)과 같다 — 세션 쿠키 · 조각 쿠키면 켜고, 손님 · code verifier면 그대로', async () => {
    const { hasSupabaseSessionCookie } = await import('@/lib/authCookie');
    for (const cookie of ['sb-proj-auth-token=x', 'theme=dark; sb-proj-auth-token.0=x', '', 'theme=dark', 'sb-proj-auth-token-code-verifier=x']) {
      const nodes = await run(cookie);
      expect(nodes.length, cookie).toBe(hasSupabaseSessionCookie(cookie) ? 1 : 0);
      if (nodes.length) expect(nodes[0]).toEqual({ id: 'lv-prog-hold', textContent: '.lv-bar .lv-prog--hold{display:flex}' });
    }
    expect(await run('sb-proj-auth-token=x', true)).toHaveLength(0);
  });
  it('빈 자리는 평소 꺼짐 · 진도 줄과 같은 상자, 붙은 뒤 진도가 오면 그 자리에 진짜 줄 · 손님으로 확정되면 뺀다', () => {
    expect(css).toContain('\n.lv-prog--hold{display:none}\n');
    expect(css).toContain('.lv-prog{display:flex;align-items:center;gap:12px;font-size:12.5px;color:var(--muted);min-height:24px}');
    expect(page).toContain("const LV_PROG_HOLD = sessionHintScript(LV_PROG_HOLD_ID, '.lv-bar .lv-prog--hold{display:flex}');");
    expect(page).toContain('{vocab && !progress && (!mounted || authLoading || userId) && <><script dangerouslySetInnerHTML={{ __html: LV_PROG_HOLD }} />');
  });
});

describe('듣기 단추 자리(LEVEL-SND-HOLD-001) — 붙기 전에도 같은 상자', () => {
  const entry = { key: '学习', word: '学习', reading: 'xuéxí', meaning: '배우다', fullMeaning: '배우다', pos: '동사',
    ex: { text: '我在学习汉语。', reading: 'wǒ zài xuéxí hànyǔ.', ko: '나는 중국어를 공부하고 있다.' } };
  const card = (view, speak, peek) => renderToStaticMarkup(<VocabCard entry={entry} lang="chinese" levelKey="h1" view={view} peek={peek} onPeek={() => {}}
    speak={speak} known={false} studying={false} saving={false} pendingKnown={false} onO={() => {}} onX={() => {}} />);
  const shape = (html) => html.replace(/<button type="button" class="(lv-snd|lv-solo__play)"[^>]*>[\s\S]*?<\/button>/g, '[$1]').replace(/<i class="(lv-snd|lv-solo__play) lv-snd--hold"><\/i>/g, '[$1]');
  it('자리는 진짜 단추와 같은 자리 · 같은 클래스(lv-snd)이고, 단추 · 이름 · 초점은 없다 — 모든 보기 · 펼침', () => {
    for (const [view, peek] of [['all'], ['word', 'open'], ['sentence', 'open'], ['meaning', 'open'], ['sound', 'open']]) {
      const held = card(view, SND_HOLD, peek), real = card(view, () => {}, peek);
      expect(shape(held), view).toBe(shape(real));
      expect(held, view).not.toMatch(/듣기|<button type="button" class="lv-snd/);
    }
    expect(card('all', SND_HOLD).match(/lv-snd--hold/g)).toHaveLength(2); // 표제어 · 예문
    expect(card('all', null)).not.toContain('lv-snd'); // 소리를 못 내는 기기(붙은 뒤)는 자리도 없다
  });
  it('서버 그림 = 자리(붙기 전), 붙은 뒤 소리 가능하면 단추 · 못 내면 없음 — CSS는 보이지 않는 같은 상자', async () => {
    const ssr = await render('japanese', 'vocab', 'n4');
    expect(ssr).toContain('<i class="lv-snd lv-snd--hold"></i>');
    expect(ssr).not.toMatch(/<button type="button" class="lv-snd"/);
    expect(fs.readFileSync('src/views/LevelListPage.jsx', 'utf8')).toContain('const sndSpeak = speakOk ? say : mounted ? null : SND_HOLD;');
    expect(fs.readFileSync('src/components/levels/level-list.css', 'utf8')).toContain('\n.lv-snd--hold{visibility:hidden;pointer-events:none}\n.lv-snd--hold::before{content:"";display:block;width:17px;height:17px}\n');
  });
});

describe('훈음 자리(LEVEL-HUN-HOLD-001) — 표가 오기 전에도 같은 칸', () => {
  const card = (entry, hunCells) => renderToStaticMarkup(<VocabCard entry={entry} lang="chinese" levelKey="h1" view="all" onPeek={() => {}}
    speak={null} hunCells={hunCells} known={false} studying={false} saving={false} pendingKnown={false} onO={() => {}} onX={() => {}} />);
  // 훈음 칸 = 같은 클래스 · 같은 --hun-n · 같은 data-wrap · 같은 줄 수. 글만 비었다(빈칸) — 줄 높이 · 칸 폭이 같다.
  const shape = (html) => html.replace(/ data-label="[^"]*"| aria-hidden="true"/g, '').replace(/ lv-hun-hold/g, '')
    .replace(/<span class="word-fit__hun-line">[^<]*<\/span>/g, '[line]');
  it('서버가 실은 모양(hun)으로 그린 자리 = 표로 그린 진짜 훈음 칸의 상자 — HSK 1 전 단어', async () => {
    const data = await levelData('chinese', 'vocab', 'h1');
    const entries = data.groups.flatMap((g) => g.entries);
    expect(entries.filter((e) => e.hun).length).toBeGreaterThan(entries.length * 0.9);
    for (const e of entries) {
      const real = hunRubyCells(e.word, tables, LEVEL_HUN_PX);
      expect(e.hun, e.word).toBe(hunShapeOf(real));
      if (!real) continue;
      expect(shape(card({ ...e, key: e.key ?? e.word, fullMeaning: e.meaning }, hunHoldCells(e.word, e.hun))), e.word)
        .toBe(shape(card({ ...e, key: e.key ?? e.word, fullMeaning: e.meaning }, real)));
    }
  });
  it('모양이 글자 수와 다르거나 없으면 자리를 만들지 않는다 · 자리는 보이지 않는다', () => {
    expect(hunHoldCells('爸爸', '1@2')).toBeNull();
    expect(hunHoldCells('爸爸', undefined)).toBeNull();
    expect(hunHoldCells('爸爸', '1@2.17,')).toEqual([{ ch: '爸', hold: true, lines: 1, wrap: false, hunN: 2.17 }, { ch: '爸', hold: true, lines: 0 }]);
    expect(fs.readFileSync('src/components/levels/level-list.css', 'utf8')).toContain('\n.lv-hw .lv-hun-hold{visibility:hidden}\n');
    expect(fs.readFileSync('src/views/LevelListPage.jsx', 'utf8')).toContain('hunCells={hunOf(e.word) || (hunHold ? hunHoldCells(e.word, e.hun) : null)}');
  });
});
