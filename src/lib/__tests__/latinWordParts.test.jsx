import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OneWordCard } from '@/components/levels/word/OneWord';
import { WordCard } from '@/components/levels/word/WordCard';
import { WordLangContext } from '@/components/levels/word/wordLang';
import { latinN } from '@/components/levels/word/LatinParts';
import { ENGLISH_WORD_LANG, FRENCH_WORD_LANG } from '@/views/LatinWordPage';
import { latinSampleGroups } from '../latinLevelWords.js';
import { levelGroupsOf } from '../levelList.js';
import enA1 from '../../content/english/vocab/a1.js';
import frA1 from '../../content/french/vocab/a1.js';
import enNotes from '../../content/english/wordNotes.js';
import frNotes from '../../content/french/wordNotes.js';

// 계약: 영어 · 프랑스어 판 목업 v2(오너 2026-10-26 KST 「다음 ㄱㄱ」) — 관사는 명사 왼쪽에 매달고(명사가 가운데), 성은 「f.」 · 「m.」만,
// 불규칙 · 형태 · 어원은 한 단어 화면에만(리스트는 표제어만), 어원이 없으면 칸 없음, 채점 안내 문구 없음.
const entries = (vocab, lang, picks, notes) => Object.fromEntries(levelGroupsOf(latinSampleGroups(vocab, { lang, picks, notes }))
  .flatMap((g) => g.entries).map((e) => [e.word, e]));
const fr = entries(frA1, 'fr', [[0, 2], [1, 2], [2, 2], [5, 2]], frNotes);
const en = entries(enA1, 'en', [[0, ['hello', 'welcome']], [2, 2], [4, ['be', 'go']], [5, 2]], enNotes);
const info = { status: 'new', previews: null, hard: 0 };
const one = (L, e, tone = true) => renderToStaticMarkup(<WordLangContext.Provider value={L}>
  <OneWordCard entry={e} view="word" info={info} tiles={null} speak={null} tone={tone} revealed onReveal={() => {}} /></WordLangContext.Provider>);
const card = (L, e, view = 'all') => renderToStaticMarkup(<WordLangContext.Provider value={L}>
  <WordCard entry={e} level="A1" view={view} info={info} tiles={null} speak={null} tone /></WordLangContext.Provider>);

describe('표제어 — 폭 기준 크기 · 관사 매달기', () => {
  it('관사 붙은 명사는 [관사 | 명사 | 빈 칸] 세 칸 — 크기는 명사 폭으로', () => {
    const html = one(FRENCH_WORD_LANG, fr['la famille']);
    expect(html).toContain(`<span class="lw-one__hw lw-one__hw--art" lang="fr" style="--n:${latinN('famille')}"><span class="lw-art" data-g="f">la</span><span>famille</span><span aria-hidden="true"></span></span>`);
    expect(latinN('famille')).toBeCloseTo(3.9, 5); // 라틴 글자 ≈ CJK 0.55칸 — 글자 수(7)로 나누면 지나치게 작아진다
  });
  it('관사 없는 말(영어 · 동사 · 형용사)은 한 칸', () => {
    expect(one(ENGLISH_WORD_LANG, en.welcome)).toContain('<span class="lw-one__hw" lang="en" style="--n:3.9">welcome</span>');
    expect(one(FRENCH_WORD_LANG, fr['être'])).not.toContain('lw-art');
  });
  it('성 색은 「성 색」(tone)이 켤 때만 — 꺼도 글자 「f.」로 구별', () => {
    const off = one(FRENCH_WORD_LANG, fr['la famille'], false);
    expect(off).toContain('<span class="lw-art">la</span>');
    expect(off).toContain('<span class="lw-gchip"><span aria-hidden="true">f.</span><span class="sr-only">여성 명사</span></span>');
  });
});

describe('한 단어 화면 — 뜻 옆 표 · 형태 · 현재형 · 어원', () => {
  it('명사는 뜻 옆 「f.」 · 「m.」만 — 「여성」 · 「남성」 글자는 화면 읽기 전용', () => {
    const html = one(FRENCH_WORD_LANG, fr['le père']);
    expect(html).toContain('<p class="lw-one__mean">아버지<span class="lw-gchip" data-g="m"><span aria-hidden="true">m.</span>');
    expect(html.replace(/<span class="sr-only">[^<]*<\/span>/g, '')).not.toMatch(/여성|남성/);
  });
  it('불규칙 동사 — 「불규칙」 표 + 현재형 여섯 칸(je suis …)', () => {
    const html = one(FRENCH_WORD_LANG, fr['être']);
    expect(html).toContain('<span class="lw-irr">불규칙</span>');
    expect(html).toContain('<li><span>je</span><b>suis</b></li>');
    expect(html).toContain('<li><span>ils · elles</span><b>sont</b></li>');
    expect(one(ENGLISH_WORD_LANG, en.go)).toContain('<li><b lang="en">went</b><span>과거</span></li>');
  });
  it('어원 칸 — 뿌리 · 같은 뿌리 · 합성어 조각, 없으면 칸 없음', () => {
    expect(one(FRENCH_WORD_LANG, fr['la famille'])).toContain('<p class="lw-ety__root"><span class="lw-box__lbl">어원</span><i lang="la">familia</i><span>라틴어</span></p>');
    expect(one(ENGLISH_WORD_LANG, en.welcome)).toContain('<li><span class="lw-ety__pw" lang="en">well</span><b>잘</b></li>');
    expect(one(FRENCH_WORD_LANG, fr['le riz'])).not.toContain('lw-ety');
    expect(one(ENGLISH_WORD_LANG, en.hello)).not.toMatch(/lw-ety|lw-forms|lw-conj/);
  });
  it('채점 안내 문구 없음', () => {
    expect(one(FRENCH_WORD_LANG, fr['la famille'])).not.toMatch(/막혔다면|못 떠올렸다면/);
  });
});

describe('리스트 — 표제어(관사 · 성)만, 불규칙 · 형태 · 어원은 없다', () => {
  it('단어 탭 · 전체 탭 모두', () => {
    for (const view of ['word', 'all']) {
      const html = card(FRENCH_WORD_LANG, fr['être'], view) + card(ENGLISH_WORD_LANG, en.go, view) + card(FRENCH_WORD_LANG, fr['la famille'], view);
      expect(html).not.toMatch(/lw-irr|lw-forms|lw-conj|lw-ety/);
      expect(html).toContain('<span class="lw-card__hw" lang="fr" style="--n:5.5"><span class="lw-art" data-g="f">la</span> famille</span>');
      expect(html).toContain('<span aria-hidden="true">f.</span>');
    }
  });
});
