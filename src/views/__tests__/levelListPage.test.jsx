// 레벨별 단어 · 문형 목록 화면(LEVEL-LIST-AJ-001) — 서버 렌더 마크업 계약.
// 서버 렌더는 계정 상태(저장됨 · 아는 단어 · 듣기)를 그리지 않는다 → 브라우저 첫 렌더와 같다(하이드레이션 불일치 0, 수용 기준 8).
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ usePathname: () => '/japanese/vocab/n5' }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/useTTS', () => ({ useTTS: () => ({ speak: () => {}, supported: true }) }));
vi.mock('@/lib/useKnownWords', () => ({ useKnownWords: () => ({ rows: [], isPendingWord: () => false, mutation: { mutate: () => {} } }) }));

const { default: LevelListPage } = await import('../LevelListPage.jsx');
const { levelListData } = await import('../../lib/levelListData.js');
const { default: LevelTiles } = await import('../../components/levels/LevelTiles.jsx');

const render = async (lang, kind, level) => renderToStaticMarkup(<LevelListPage {...await levelListData(lang, kind, level)} />);
const count = (html, needle) => html.split(needle).length - 1;

describe('단어 목록', () => {
  it('N5: 가나 먼저 크게 + 한자 작게, 카드마다 [제외][저장] 순서 · 이름표 · 출처 한 줄', async () => {
    const html = await render('japanese', 'vocab', 'n5');
    expect(html).toContain('<h1>N5 단어</h1>');
    expect(html).toMatch(/<span class="lv-hw" lang="ja">[ぁ-ゖァ-ヺー]+<\/span><span class="lv-kj" lang="ja">[^<]*[一-龯][^<]*<\/span>/);
    // 처음엔 150개만(전: 950개 전부 → 후: 150개 + 「더 보기」 — smoke e2e N3 DOM 예산). 묶음 제목 개수는 전체 기준.
    const cards = count(html, 'class="lv-entry"');
    expect(cards).toBe(150);
    expect(html).toContain('더 보기 · 800개 남음');
    expect(count(html, 'aria-label="제외 — 아는 단어로 옮기기" title="제외"')).toBe(cards);
    expect(count(html, 'aria-label="저장" title="저장"')).toBe(cards);
    expect(html.indexOf('lv-fab--ex')).toBeLessThan(html.indexOf('lv-fab--save'));
    expect(count(html, 'aria-pressed="false"')).toBe(1); // 뜻 가리기
    expect(html).toContain('>뜻 가리기<');
    expect(html).toContain('<p class="lv-src">출처 open-anki-jlpt-decks</p>');
    expect(html).not.toContain('아는 단어 '); // 로그인 전 · 0이면 버튼 없음
  });

  it('N3: 한자 위 읽기(루비) — 가나 먼저 아님', async () => {
    const html = await render('japanese', 'vocab', 'n3');
    expect(html).toMatch(/<span class="lv-hw" lang="ja"><ruby>[^<]+<rt>/);
    expect(html).not.toContain('class="lv-kj"');
  });

  it('중국어: 병음은 옆 · 아래 작은 줄, 위 읽기 없음 · 2026 급수 기준 출처', async () => {
    const html = await render('chinese', 'vocab', 'h1');
    expect(html).toContain('<h1>HSK 1 단어</h1>');
    expect(html).toMatch(/<span class="lv-hw" lang="zh-CN">[^<]+<\/span><span class="lv-py">/);
    expect(html).toContain('class="lv-ex__py"');
    expect(html).not.toContain('<ruby>');
    expect(html).toContain('中文水平考试 HSK 考试大纲');
  });

  it('레벨 알약 · 탭 · 「← 교재」 — 보관함 · 문법 링크 0', async () => {
    const html = await render('chinese', 'vocab', 'h2');
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toContain('/lessons?lang=Chinese');
    expect(new Set(hrefs.filter((h) => /^\/chinese\/vocab\/h[1-6]$/.test(h))).size).toBe(6); // 알약 6 + 「단어」 탭
    expect(hrefs).toContain('/chinese/bunkei/h2');
    expect(hrefs.filter((h) => /grammar|legacy/.test(h))).toEqual([]);
    expect(html).toMatch(/<a aria-current="page" aria-label="HSK 2" href="\/chinese\/vocab\/h2">2<\/a>|<a href="\/chinese\/vocab\/h2" aria-current="page" aria-label="HSK 2">2<\/a>/);
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
