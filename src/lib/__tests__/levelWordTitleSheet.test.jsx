import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewPerDayInput, TitleSheet } from '@/components/levels/word/WordSheets';
import { levelNewPerDayItems, parseNewPerDayInput } from '../levelWordPrefs';
import { WordLangContext } from '@/components/levels/word/wordLang';
import { levelKinds } from '../levelList';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));

// 계약: 단어 페이지 설정은 두 곳(오너 2026-10-21 KST) — 페이지 줄 = 모드 · 보기 탭, 제목 ▾ 시트 = 레벨 · 목록 | 순서 · 하루
// (학습 옵션 LEVEL-STUDY-OPTIONS-001 — 오너 2026-10-31 KST 시안 4차 · 단순화, 「분량」 자리에 「하루」 LEVEL-WAIT-001 — 오너 승인 2026-11-01 KST).
// 같은 선택이 두 곳에 있지 않고, 해 모양 설정 창 · 「보기」 줄은 없다.
const L = { levelPill: (k) => k.slice(1), tag: (l) => `HSK ${l}`, levelOf: (k) => k.slice(1), levelHref: (k) => `/chinese/vocab/${k.toLowerCase()}` };
const KIND = { vocab: '단어', hanzi: '한자', bunkei: '문형' };
const kindsOf = (key) => ['vocab', 'hanzi', 'bunkei'].filter((k) => levelKinds('chinese', key).includes(k))
  .map((k) => ({ id: k, label: KIND[k], href: `/chinese/${k}/${key.toLowerCase()}` }));
const DEFAULT = { order: 'mix' };
const render = (key, prefs = DEFAULT, perDay = 15) => renderToStaticMarkup(<WordLangContext.Provider value={L}>
  <TitleSheet levels={['H1', 'H2', 'H7']} levelKey={key} kinds={kindsOf(key)} prefs={prefs} onPrefs={() => {}} perDay={perDay} onPerDay={() => {}} onClose={() => {}} />
</WordLangContext.Provider>);
const rowLabels = (html) => [...html.matchAll(/<div class="lw-sheet__row"><span[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
const pressed = (html, label) => [...sliceBetween(html, `>${label}</span>`, '</div></div>').matchAll(/aria-pressed="true"[^>]*>([^<]+)</g)].map((m) => m[1]);
const css = fs.readFileSync('src/components/levels/word/level-word.css', 'utf8');

describe('제목 시트 — 레벨 · 목록 | 순서 · 하루', () => {
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
  it('줄 차례 · 이름표 두 글자 — 레벨 · 목록 · 가는 선 · 순서 · 하루, 「분량」 · 「보기」 · 「세부」 줄은 없다', () => {
    const html = render('H1');
    expect(rowLabels(html)).toEqual(['레벨', '목록', '순서', '하루']);
    expect(html).not.toMatch(/>분량<|10개|20개|이어서/);
    // 손님(하루 새 단어 수를 모름)은 「하루」 줄이 없다.
    expect(rowLabels(render('H1', DEFAULT, null))).toEqual(['레벨', '목록', '순서']);
    expect(html).not.toMatch(/role="switch"|2단 평가|>세부</);
    for (const label of rowLabels(html)) expect([...label]).toHaveLength(2);
    expect(html.indexOf('>목록<')).toBeLessThan(html.indexOf('lw-sheet__sep'));
    expect(html.indexOf('lw-sheet__sep')).toBeLessThan(html.indexOf('>순서<'));
    expect(html).toContain('<div class="lw-sheet__sep" role="presentation"></div>');
    expect(html).not.toMatch(/>보기<|리스트 한 번에|성조 색|예문 후리가나|성 색|정렬|취약순|임의 출제/);
    expect(html).not.toContain('한 단어');
    expect(html).not.toContain('>모드<');
  });
  it('순서는 세 칸 · 하루는 여섯 칸(10 · 15 · 20 · 30 · ∞ · ⋯) · 문구는 명사형 그대로 · 버튼 안 숫자(small) 없음', () => {
    const html = render('H1');
    const items = (label) => [...sliceBetween(html, `>${label}</span>`, '</div></div>').matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
    expect(items('순서')).toEqual(['혼합', '새 단어 먼저', '복습 먼저']); // 이름은 levelWordPrefs 표 한 곳(오너가 Anki 말을 고르면 그 표만)
    expect(html).toContain('role="group" aria-label="새 단어 순서"'); // 화면 읽기 「새 단어 순서: 새 단어 먼저」
    expect(items('하루')).toEqual(['10', '15', '20', '30', '∞', '\u22EF']);
    // 기호 칩은 화면 읽기에 이름으로(∞ = 제한 없음 · ⋯ = 직접 입력) — 글자 높이를 맞추는 data-sym.
    expect(html).toContain('aria-label="제한 없음" data-sym="true"');
    expect(html).toContain('aria-label="직접 입력" data-sym="true" data-custom="true"');
    expect(sliceBetween(html, '>순서</span>', '</div></div>')).toContain('--n:3');
    expect(sliceBetween(html, '>하루</span>', '</div></div>')).toContain('--n:6'); // 위 세 칸의 두 배 — 칸 경계가 한 칸 걸러 같은 세로선
    expect(html).toContain('<p class="lw-sheet__sub" id="lw-newday-help">새로 시작하는 단어 수 · 복습실과 같은 값</p>');
    expect(html).not.toContain('<small>');
  });
  it('기본값 = 혼합 · 지금 하루 값이 선택 · 고르기 값이 아니면 ⋯ 칩이 그 숫자로(「직접 입력 25개」)', () => {
    const html = render('H1');
    expect(pressed(html, '순서')).toEqual(['혼합']);
    expect(pressed(html, '하루')).toEqual(['15']);
    const on = render('H1', { order: 'review-first' }, 9999);
    expect(pressed(on, '순서')).toEqual(['복습 먼저']);
    expect(pressed(on, '하루')).toEqual(['∞']);
    const custom = render('H1', DEFAULT, 25);
    expect(pressed(custom, '하루')).toEqual(['25']);
    expect(custom).toContain('aria-pressed="true" aria-label="직접 입력 25개" data-custom="true">25</button>');
    expect(custom).not.toContain('\u22EF');
    expect(pressed(render('H1', DEFAULT, 0), '하루')).toEqual(['0']); // 0 = 복습만 — 고르기 칩에 없어 직접 값
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
    // 예전 보기 줄의 부품은 남기지 않는다(죽은 CSS).
    expect(css).not.toMatch(/\.lw-mini|\.lw-sheet__page|\.lw-sheet__row--top|\.lw-aid-ex|\.lw-switch|\.lw-sheet__view/);
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

// 계약: 「하루」 직접 입력(LEVEL-WAIT-001 · 오너 승인 2026-11-01 KST 시안 ①) — 0–999만(정본 isNewPerDayValue · NEW_PER_DAY_MAX), 그 이상은 ∞ 칩.
describe('「하루」 직접 입력 — 같은 줄이 입력 칸 · 0–999 · 잘못되면 확인 꺼짐 + 붉은 안내', () => {
  const draw = (text, touched = true) => renderToStaticMarkup(<NewPerDayInput text={text} touched={touched} />);
  it('판정 — 숫자만 0–999 · 빈 칸 · 소수 · 음수 · 1000 이상은 받지 않는다', () => {
    expect(['0', '25', '999', '025', ' 7 '].map(parseNewPerDayInput)).toEqual([0, 25, 999, 25, 7]);
    for (const bad of ['', '1000', '1200', '9999', '2.5', '-1', '1e2', '십', '12개']) expect(parseNewPerDayInput(bad)).toBeNull();
  });
  it('입력 칸 — 숫자 키패드 · 「개」 · [확인](주 단추) [취소] · 도움말 「0–999개 · 0이면 복습만 합니다」', () => {
    const html = draw('25');
    expect(html).toContain('<div class="lw-sheet__row"><span id="lw-seg-하루">하루</span><div class="lw-newday" data-own-esc="">');
    expect(html).toMatch(/<input type="text" inputMode="numeric" pattern="\[0-9\]\*" enterKeyHint="done"[^>]*value="25"/);
    expect(html).toContain('<span aria-hidden="true">개</span>');
    expect(html).toContain('<button type="button" class="lw-btn lw-btn--primary">확인</button><button type="button" class="lw-btn">취소</button>');
    expect(html).toContain('<p class="lw-sheet__sub" id="lw-newday-help">0–999개 · 0이면 복습만 합니다</p>');
    expect(html).not.toContain('aria-invalid');
  });
  it('잘못된 값(1200 · 2.5 · 지운 빈 칸) — 확인 꺼짐 · 안내가 붉게 「0–999 사이 숫자로 입력해 주세요 · 그 이상은 ∞」', () => {
    for (const text of ['1200', '2.5', '']) {
      const html = draw(text);
      expect(html).toContain('class="lw-btn lw-btn--primary" disabled="">확인</button>');
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('<p class="lw-sheet__sub" id="lw-newday-help" data-bad="true">0–999 사이 숫자로 입력해 주세요 · 그 이상은 ∞</p>');
    }
    // 막 연 빈 칸 — 확인은 꺼지지만 아직 붉지 않다(아무것도 적지 않았다).
    const fresh = draw('', false);
    expect(fresh).toContain('disabled="">확인</button>');
    expect(fresh).not.toContain('data-bad');
  });
  it('Enter = 확인 · Esc = 취소 — 시트는 그 Esc로 닫히지 않는다(data-own-esc)', () => {
    const sheets = fs.readFileSync('src/components/levels/word/WordSheets.jsx', 'utf8');
    expect(sheets).toContain("if (event.key === 'Enter') { event.preventDefault(); if (n !== null) onConfirm(n); }");
    expect(sheets).toContain("else if (event.key === 'Escape') { event.preventDefault(); onCancel(); }");
    expect(sheets).toContain("if (event.key === 'Escape' && event.target.closest?.('[data-own-esc]')) return;");
  });
  it('⋯ 칩 = U+22EF · 화면 읽기 「직접 입력」, 직접 값이면 그 숫자 + 「직접 입력 N개」 · 고르기 값이면 그 칩', () => {
    expect(levelNewPerDayItems(15).map((i) => i.label)).toEqual(['10', '15', '20', '30', '∞', '\u22EF']);
    expect(levelNewPerDayItems(15).at(-1)).toMatchObject({ aria: '직접 입력', sym: true });
    expect(levelNewPerDayItems(9999).at(-2)).toMatchObject({ id: 9999, aria: '제한 없음', sym: true });
    expect(levelNewPerDayItems(25).at(-1)).toEqual({ id: 'custom', label: '25', aria: '직접 입력 25개' });
    expect(levelNewPerDayItems(20).at(-1).label).toBe('\u22EF');
  });
  it('「하루」 CSS — 안내 줄은 칸 열(48px)에 맞춰 들이고 12px 흐림 · 잘못되면 붉게 · 입력 칸 세 칸 격자', () => {
    expect(css).toContain('.lw-sheet__sub{margin:-4px 0 0 48px;font-size:12px;color:var(--muted)}');
    expect(css).toContain('.lw-sheet__sub[data-bad]{color:var(--grade-again)}');
    expect(css).toMatch(/\.lw-newday\{display:grid;grid-template-columns:minmax\(0,1fr\) auto auto/);
    expect(css).toMatch(/\.lw-newday__field input\{[^}]*font-size:16px/); // 16px — iOS가 입력 칸을 확대하지 않게
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
