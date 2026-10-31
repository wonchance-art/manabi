import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { TitleSheet } from '@/components/levels/word/WordSheets';
import { WordLangContext } from '@/components/levels/word/wordLang';
import { levelKinds } from '../levelList';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));

// 계약: 단어 페이지 설정은 두 곳(오너 2026-10-21 KST) — 페이지 줄 = 모드 · 보기 탭, 제목 ▾ 시트 = 레벨 · 목록 | 순서 · 분량 · 세부
// (학습 옵션 LEVEL-STUDY-OPTIONS-001 — 오너 2026-10-31 KST 시안 4차 · 단순화). 같은 선택이 두 곳에 있지 않고, 해 모양 설정 창 · 「보기」 줄은 없다.
const L = { levelPill: (k) => k.slice(1), tag: (l) => `HSK ${l}`, levelOf: (k) => k.slice(1), levelHref: (k) => `/chinese/vocab/${k.toLowerCase()}` };
const KIND = { vocab: '단어', hanzi: '한자', bunkei: '문형' };
const kindsOf = (key) => ['vocab', 'hanzi', 'bunkei'].filter((k) => levelKinds('chinese', key).includes(k))
  .map((k) => ({ id: k, label: KIND[k], href: `/chinese/${k}/${key.toLowerCase()}` }));
const DEFAULT = { order: 'mix', amount: 'all', two: false };
const render = (key, prefs = DEFAULT) => renderToStaticMarkup(<WordLangContext.Provider value={L}>
  <TitleSheet levels={['H1', 'H2', 'H7']} levelKey={key} kinds={kindsOf(key)} prefs={prefs} onPrefs={() => {}} onClose={() => {}} />
</WordLangContext.Provider>);
const rowLabels = (html) => [...html.matchAll(/<div class="lw-sheet__row"><span[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
const pressed = (html, label) => [...sliceBetween(html, `>${label}</span>`, '</div></div>').matchAll(/aria-pressed="true"[^>]*>([^<]+)</g)].map((m) => m[1]);
const css = fs.readFileSync('src/components/levels/word/level-word.css', 'utf8');

describe('제목 시트 — 레벨 · 목록 | 순서 · 분량 · 세부', () => {
  it('1급: 목록은 단어 · 한자 · 문형 순, 지금 단어', () => {
    const html = render('H1');
    expect(html).toContain('aria-label="레벨 · 목록 · 학습 옵션"');
    const kinds = sliceBetween(html, '>목록<', 'lw-sheet__sep');
    expect([...kinds.matchAll(/href="\/chinese\/(vocab|hanzi|bunkei)\/h1"[^>]*>([^<]+)</g)].map((m) => m[2])).toEqual(['단어', '한자', '문형']);
    expect(kinds).toMatch(/href="\/chinese\/vocab\/h1" aria-current="page"[^>]*>단어</);
  });
  it('7–9급은 단어뿐이라 목록 줄이 없다', () => {
    expect(render('H7')).not.toContain('>목록<');
    expect(render('H1')).toContain('>목록<');
  });
  it('줄 차례 · 이름표 두 글자 — 레벨 · 목록 · 가는 선 · 순서 · 분량 · 세부, 「보기」 줄은 없다', () => {
    const html = render('H1');
    expect(rowLabels(html)).toEqual(['레벨', '목록', '순서', '분량', '세부']);
    for (const label of rowLabels(html)) expect([...label]).toHaveLength(2);
    expect(html.indexOf('>목록<')).toBeLessThan(html.indexOf('lw-sheet__sep'));
    expect(html.indexOf('lw-sheet__sep')).toBeLessThan(html.indexOf('>순서<'));
    expect(html).toContain('<div class="lw-sheet__sep" role="presentation"></div>');
    expect(html).not.toMatch(/>보기<|리스트 한 번에|성조 색|예문 후리가나|성 색|정렬|취약순|임의 출제/);
    expect(html).not.toContain('한 단어');
    expect(html).not.toContain('>모드<');
  });
  it('고르는 줄은 모두 세 칸 · 문구는 명사형 그대로 · 버튼 안 숫자(small) 없음', () => {
    const html = render('H1');
    const items = (label) => [...sliceBetween(html, `>${label}</span>`, '</div></div>').matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
    expect(items('순서')).toEqual(['혼합', '새 단어 먼저', '복습 먼저']);
    expect(items('분량')).toEqual(['10개', '20개', '∞']); // 전체 = ∞(화면 읽기는 「전체」)
    expect(html).toContain('aria-label="전체" data-sym="true"');
    expect(sliceBetween(html, '>순서</span>', '</div></div>')).toContain('--n:3');
    expect(sliceBetween(html, '>분량</span>', '</div></div>')).toContain('--n:3');
    expect(html).not.toContain('<small>');
  });
  it('기본값 = 예전 동작: 혼합 · 전체 · 2단 평가 끔', () => {
    const html = render('H1');
    expect(pressed(html, '순서')).toEqual(['혼합']);
    expect(pressed(html, '분량')).toEqual(['∞']);
    expect(html).toMatch(/role="switch" class="lw-switch" aria-checked="false">2단 평가<i/);
    const on = render('H1', { order: 'review-first', amount: 10, two: true });
    expect(pressed(on, '순서')).toEqual(['복습 먼저']);
    expect(pressed(on, '분량')).toEqual(['10개']);
    expect(on).toMatch(/role="switch" class="lw-switch" aria-checked="true">2단 평가<i/);
  });
  it('세부 카드에는 스위치 하나(2단 평가)뿐', () => {
    const view = sliceBetween(render('H1'), '>세부</span>', '</div></div>');
    expect(view.match(/role="switch"/g)).toHaveLength(1);
  });
  it('이름표 40px 열 그대로 · 손잡이는 가운데 · 가는 선 · 줄 안 글자는 넘기지 않는다', () => {
    expect(css).toMatch(/\.lw-sheet__row\{display:grid;grid-template-columns:40px minmax\(0,1fr\)/);
    expect(css).toMatch(/\.lw-sheet__handle\{[^}]*width:100%/);
    expect(css).toMatch(/\.lw-sheet__handle\{[^}]*place-items:center/);
    expect(css).toContain('.lw-sheet__sep{height:1px;background:var(--lw-line);margin:4px 0}');
    expect(css).toMatch(/\.lw-sheet \.lw-seg button,\.lw-sheet \.lw-seg a\{[^}]*white-space:nowrap/);
    expect(css).toMatch(/\.lw-sheet__row>span\{[^}]*white-space:nowrap/);
    // 320px 화면(줄 폭 288px)은 칸 글자를 줄인다 — 줄바꿈 대신 크기(뷰포트 쿼리 신설 없이 컨테이너 쿼리).
    expect(css).toMatch(/\.lw-sheet__rows\{[^}]*container-type:inline-size/);
    expect(css).toContain('@container (max-width:300px){.lw-sheet .lw-seg button,.lw-sheet .lw-seg a{font-size:13px}}');
    expect(css).toMatch(/\.lw-switch\{[^}]*white-space:nowrap/);
    // 예전 보기 줄의 부품은 남기지 않는다(죽은 CSS).
    expect(css).not.toMatch(/\.lw-mini|\.lw-sheet__page|\.lw-sheet__row--top|\.lw-aid-ex/);
  });
  it('위쪽에는 홈 · 제목 · ▾ · 찾기만 — 해 모양 설정 창 없음', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).not.toMatch(/SunIcon|lw-settings|settingsOpen/);
    expect(screen).toMatch(/if \(folded\) setUnfoldedAt\(foldKey\)/);
    // 연습 탭은 바퀴가 없을 때도 열린다 — 접힘 열쇠가 빈 바퀴를 읽지 않는다(로컬 확인에서 잡은 오류).
    expect(screen).toContain('`p${roundOn ? round.answers.size : 0}`');
    // 판(cfg)에 도움 스위치 이름이 남지 않는다 — 시트가 더는 읽지 않는다.
    for (const f of ['src/views/LevelWordPage.jsx', 'src/views/JlptWordPage.jsx', 'src/views/LatinWordPage.jsx']) expect(fs.readFileSync(f, 'utf8')).not.toContain('aidLabel');
  });
});

// 계약: 움직임 ⑥ 1~4(오너 2026-10-21 KST 「1~4」) — 닫힘도 움직이고, 고른 표시는 미끄러지고, 끝 화면 숫자는 올라간다. 모두 동작 줄이기면 없음.
describe('움직임 ⑥ — 닫힘 · 미끄러짐 · 끝 화면', () => {
  const read = (f) => fs.readFileSync(f, 'utf8');
  const sheets = read('src/components/levels/word/WordSheets.jsx');
  const css = read('src/components/levels/word/level-word.css');
  it('시트 · 예문 단어 창 · 조각 창은 닫히는 중을 거쳐 닫힌다 — 동작 줄이기면 바로', () => {
    expect(sheets).toMatch(/if \(reducedMotion\(\)\) \{ latest\.current\(\); return; \}/);
    expect(sheets.match(/useClosing\(onClose, \d+\)/g)).toHaveLength(3);
    expect(sheets).not.toMatch(/onClick=\{onClose\}|\) onClose\(\);/);
    expect(css).toMatch(/\.lw-sheet\.is-closing\{[^}]*animation:lwSheetDown/);
    expect(css).toMatch(/\.lw-dp\.is-closing\{[^}]*animation:lwFadeOut/);
  });
  it('리스트 카드 접힘도 움직인다 — 동작 줄이기면 바로 접힘', () => {
    expect(read('src/components/levels/word/WordCard.jsx')).toMatch(/setOpen\(reducedMotion\(\) \? false : 'closing'\)/);
    expect(css).toMatch(/\.lw-card__more\[data-closing\]\{[^}]*animation:lwMoreClose/);
  });
  it('모드 칸 · 탭 밑줄은 고른 표시가 미끄러진다', () => {
    expect(css).toMatch(/\.lw-seg\[data-thumb\]::before\{[^}]*transition:transform/);
    expect(css).toMatch(/\.lw-tabs__bar\{[^}]*transition:transform/);
    expect(read('src/components/levels/word/LevelWordScreen.jsx')).toMatch(/onClick=\{\(\) => switchView\(v\.id\)\}/);
  });
  it('끝 화면 숫자 — 화면 읽기는 처음부터 최종 값', async () => {
    const { CountUp } = await import('@/components/levels/word/WordParts');
    expect(renderToStaticMarkup(<CountUp n={20} />)).toBe('<span aria-hidden="true">0</span><span class="sr-only">20</span>');
  });
});
