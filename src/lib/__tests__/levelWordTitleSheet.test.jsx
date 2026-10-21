import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { TitleSheet } from '@/components/levels/word/WordSheets';
import { WordLangContext } from '@/components/levels/word/wordLang';
import { levelKinds } from '../levelList';
import { sliceBetween } from './helpers/sliceBetween';

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a> }));

// 계약: 단어 페이지 설정은 두 곳(오너 2026-10-21 KST) — 페이지 줄 = 모드 · 보기 탭, 제목 ▾ 시트 = 레벨 · 목록 · 보기.
// 같은 선택이 두 곳에 있지 않고, 해 모양 설정 창은 없다.
const L = { levelPill: (k) => k.slice(1), tag: (l) => `HSK ${l}`, levelOf: (k) => k.slice(1), levelHref: (k) => `/chinese/vocab/${k.toLowerCase()}` };
const KIND = { vocab: '단어', hanzi: '한자', bunkei: '문형' };
const kindsOf = (key) => ['vocab', 'hanzi', 'bunkei'].filter((k) => levelKinds('chinese', key).includes(k))
  .map((k) => ({ id: k, label: KIND[k], href: `/chinese/${k}/${key.toLowerCase()}` }));
const render = (key) => renderToStaticMarkup(<WordLangContext.Provider value={L}>
  <TitleSheet levels={['H1', 'H2', 'H7']} levelKey={key} kinds={kindsOf(key)} aidLabel="성조 색" aid page={20} pageSizes={[10, 20, 50]}
    onAid={() => {}} onPage={() => {}} onClose={() => {}} />
</WordLangContext.Provider>);

describe('제목 시트 — 레벨 · 목록 · 보기', () => {
  it('1급: 목록은 단어 · 한자 · 문형 순, 지금 단어', () => {
    const html = render('H1');
    expect(html).toContain('aria-label="레벨 · 목록 · 보기"');
    const kinds = sliceBetween(html, '>목록<', '>보기<');
    expect([...kinds.matchAll(/href="\/chinese\/(vocab|hanzi|bunkei)\/h1"[^>]*>([^<]+)</g)].map((m) => m[2])).toEqual(['단어', '한자', '문형']);
    expect(kinds).toMatch(/href="\/chinese\/vocab\/h1" aria-current="page"[^>]*>단어</);
  });
  it('7–9급은 단어뿐이라 목록 줄이 없다', () => {
    expect(render('H7')).not.toContain('>목록<');
    expect(render('H1')).toContain('>목록<');
  });
  it('보기: 도움 스위치와 리스트 한 번에 — 모드 · 보기 탭은 시트에 없다', () => {
    const html = render('H1');
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"[^>]*>성조 색/);
    expect(html).toContain('리스트 한 번에');
    expect(html).not.toContain('한 단어');
    expect(html).not.toContain('>모드<');
  });
  it('위쪽에는 홈 · 제목 · ▾ · 찾기만 — 해 모양 설정 창 없음', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).not.toMatch(/SunIcon|lw-settings|settingsOpen/);
    expect(screen).toMatch(/if \(folded\) setUnfoldedAt\(foldKey\)/);
    // 연습 탭은 바퀴가 없을 때도 열린다 — 접힘 열쇠가 빈 바퀴를 읽지 않는다(로컬 확인에서 잡은 오류).
    expect(screen).toContain('`p${roundOn ? round.answers.size : 0}`');
  });
});
