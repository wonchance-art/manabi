// VIEWER-R0-BUGS-001 버그 3 — 학습자 링크가 보관된 옛 교재 주소로 가서 홈으로 튕기던 결함의 재발 방지 계약.
// 옛 공개 교재 URL(/<lang>, /<lang>/grammar|vocab|bunkei/<slug>)은 #1287부터 middleware가
// /admin/legacy-textbooks/… 로 돌리고, 관리자가 아니면 거기서 / 로 보낸다. 학습자 화면의 링크 생성
// 함수는 그 주소를 만들면 안 된다. 옛 챕터 → 새 책 위치 대응은 데이터로 확정된 것이 없으므로
// 링크를 만들지 않고(null) 화면은 「보관된 교재라 열 수 없어요」를 보인다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';

const { client } = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: client }));

import { middleware } from '../../middleware';
import { legacyTextbookTarget } from '../bookNavigation';
import * as bookNavigation from '../bookNavigation';
import { buildKernelIndex, loadPatternIndex } from '../patternIndex';
import { reviewSourceContexts, sourceHref } from '../learningSources';
import * as learningSources from '../learningSources';
import * as grammarDetail from '../useGrammarDetail';
import { attachTagLinks, findChapterForTag } from '../writingTagLink';

const EDITION = '8a8c1c1fd452773810abaf8c';
const UUID_A = '00000000-0000-4000-8000-0000000000a1';
const PDF = '20000000-0000-0000-0000-000000000001';
const pathOf = href => String(href).replace(/[?#].*$/s, '');
const reachesArchive = href => href != null && legacyTextbookTarget(pathOf(href)) !== null;

// 네 언어 옛 교재 출처(bookId 없음) — 실제 manifest slug와 같은 꼴, 버전·블록 위치 유무 포함.
const LEGACY_TEXTBOOK_SOURCES = [
  ['Japanese', 'n5-04-desu-da'], ['Chinese', 'h1-01-shi'], ['English', 'a1-01-be-verb'], ['French', 'a1-01-pronouns-etre'],
  ['Japanese', 'n5-book-u03'], // 새 책 과 slug라도 bookId·판본이 없으면 위치를 확정할 수 없다
].flatMap(([lang, chapter_slug]) => [
  { kind: 'textbook', lang, chapter_slug },
  { kind: 'textbook', lang, chapter_slug, locator: { revision: 'r1', blockId: 'tb-abc' } },
  { kind: 'textbook', lang, chapter_slug, locator: { bookId: '', revision: 'r1' } },
]);
// 본문 귀환이 그대로 동작해야 하는 출처 — 정확한 주소를 고정한다.
const OPENABLE_SOURCES = [
  [{ kind: 'textbook', lang: 'Japanese', chapter_slug: 'n5-book-u03', locator: { bookId: 'japanese-n5', editionId: EDITION, revision: EDITION, pageId: 'u03-study1', blockId: 'tb-book-u03-study1' } }, `/books/japanese-n5?edition=${EDITION}#u03-study1`],
  [{ id: UUID_A, kind: 'reading', lang: 'Chinese', material_id: 211, locator: { tokenId: 't', surface: '眼前' } }, `/viewer/211?sourceContext=${UUID_A}`],
  [{ kind: 'reading', lang: 'Japanese', material_id: 211, locator: { surface: '山' } }, '/viewer/211?sourceText=%E5%B1%B1'],
  [{ kind: 'reading', lang: 'Korean', material_id: 7, locator: { noteCandidate: UUID_A, notePage: '2' } }, `/notes/7?candidate=${UUID_A}&page=2`],
  [{ kind: 'pdf', lang: 'English', pdf_id: PDF, locator: { page: 12 } }, `/pdf/${PDF}?page=12`],
  [{ kind: 'pdf', lang: 'French', pdf_id: PDF, locator: {} }, `/pdf/${PDF}`],
];

async function patternEntries() {
  const entries = [];
  for (const lang of ['Chinese', 'Japanese']) {
    const index = await loadPatternIndex(lang);
    entries.push(...[...index.values()].flat().map(entry => ({ ...entry, lang })));
  }
  // 영어·프랑스어는 문형 정본이 없지만 같은 함수가 어떤 base로 불려도 옛 주소를 만들면 안 된다.
  const sets = [{ level: 'A1', mod: { level: 'A1', themes: [{ name: 't', items: [{ pattern: '越来越 A', ch: 'a1-01-be-verb' }] }] } }];
  for (const base of ['/english', '/french', '/chinese', '/japanese']) {
    entries.push(...[...buildKernelIndex(sets, { base }).values()].flat().map(entry => ({ ...entry, lang: base })));
  }
  return entries;
}

describe('학습자 링크 생성 함수는 보관된 옛 교재 주소를 내지 않는다', () => {
  it('문형 카드 「챕터로 →」: 네 언어 base 전수 — 챕터가 잡힌 항목도 옛 주소 대신 null', async () => {
    const entries = await patternEntries();
    const withChapter = entries.filter(entry => entry.ch);
    expect(withChapter.length).toBeGreaterThan(100); // 공집합으로 통과하지 않는다
    expect(entries.filter(entry => reachesArchive(entry.href)).map(entry => `${entry.lang} ${entry.href}`)).toEqual([]);
    // ch는 복습 예정·자주 틀림 표식의 열쇠라 그대로 남는다(링크만 없다).
    expect(withChapter.every(entry => entry.href === null)).toBe(true);
  });

  it('복습 「원문으로」 sourceHref: 언어 5종 × 출처 종류 전수', () => {
    const produced = [...LEGACY_TEXTBOOK_SOURCES, ...OPENABLE_SOURCES.map(([source]) => source)].map(source => sourceHref(source));
    expect(produced.filter(reachesArchive)).toEqual([]);
    for (const source of LEGACY_TEXTBOOK_SOURCES) expect(sourceHref(source)).toBeNull();
  });

  it('본문 귀환 회귀: 새 책(bookId)·자료·노트·PDF 출처는 주소가 바뀌지 않는다', () => {
    for (const [source, href] of OPENABLE_SOURCES) expect(sourceHref(source)).toBe(href);
  });

  it('[자세히] 정본 해설 후보: 네 언어 챕터 후보에 옛 주소가 없고 캐시된 옛 주소도 지운다', async () => {
    expect(typeof grammarDetail.loadChapterCandidates).toBe('function');
    for (const lang of ['Japanese', 'Chinese', 'English', 'French']) {
      const chapters = await grammarDetail.loadChapterCandidates(lang);
      expect(chapters.length, lang).toBeGreaterThan(10);
      expect(chapters.filter(chapter => reachesArchive(chapter.href)), lang).toEqual([]);
    }
    expect(grammarDetail.cachedChapter({ slug: 'n5-04-desu-da', title: 't', level: 'N5', href: '/japanese/grammar/n5-04-desu-da' }))
      .toEqual({ slug: 'n5-04-desu-da', title: 't', level: 'N5', href: null });
    expect(grammarDetail.cachedChapter(null)).toBeNull();
  });

  it('작문 첨삭 태그 링크: 챕터를 찾아도 옛 주소를 붙이지 않는다', () => {
    const ref = { base: '/japanese', ALL_CHAPTERS: [{ slug: 'n5-04-desu-da', title: 'です・だ', topic: 'です', level: 'N5', sections: [{ pattern: '〜です' }] }] };
    expect(findChapterForTag(ref, 'です')).toMatchObject({ slug: 'n5-04-desu-da' });
    const feedback = attachTagLinks({ sentences: [{ errors: [{ tag: 'です' }, { tag: '〜です' }] }] }, ref);
    expect(feedback.sentences[0].errors.filter(error => reachesArchive(error.href))).toEqual([]);
  });

  it('학습자 경로 소스에는 learnerHref를 거치지 않은 옛 교재 주소 조립이 없다', () => {
    // 페이지 내부 함수(서버 컴포넌트)는 import로 부를 수 없어 소스로 잠근다.
    const files = [
      'src/lib/patternIndex.js', 'src/lib/learningSources.js', 'src/lib/studyMaterials.js', 'src/lib/useGrammarDetail.js',
      'src/lib/writingTagLink.js', 'src/app/(app)/study/page.jsx', 'src/app/(app)/writing/page.jsx',
      'src/app/(app)/review/grammar/page.jsx', 'src/app/api/review/drills/route.js', 'src/app/nihongo/[day]/page.jsx',
    ];
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      const raw = lines.filter(line => /\/(grammar|vocab|bunkei)\/\$\{/.test(line) && !/learnerHref\(/.test(line));
      expect(raw, file).toEqual([]);
    }
  });
});

describe('learnerHref 관문과 보관 출처 표시', () => {
  it('옛 교재 주소만 null로 막고 다른 학습자 주소는 그대로 둔다', () => {
    const { learnerHref } = bookNavigation;
    expect(typeof learnerHref).toBe('function');
    for (const href of ['/japanese', '/chinese/', '/english/grammar/a1-01-be-verb?sourceRevision=r#tb-x', '/french/vocab/a1', '/japanese/bunkei/n5', '/chinese/grammar/h1-01-shi#x'])
      expect(learnerHref(href), href).toBeNull();
    for (const href of ['/books/japanese-n5?edition=x#u01', '/viewer/1?sourceText=a', '/lessons', '/japanese/reading', '/review/grammar', '/admin/legacy-textbooks/japanese/grammar/n5-04-desu-da'])
      expect(learnerHref(href), href).toBe(href);
    expect(learnerHref(null)).toBeNull();
    expect(learnerHref('')).toBeNull();
    expect(bookNavigation.ARCHIVED_TEXTBOOK_NOTICE).toBe('보관된 교재라 열 수 없어요');
  });

  it('bookId 없는 옛 교재 출처는 보관 표시 대상이고, 열 수 있는 출처·잘못된 식별자는 아니다', () => {
    const { sourceArchived } = learningSources;
    expect(typeof sourceArchived).toBe('function');
    for (const source of LEGACY_TEXTBOOK_SOURCES) expect(sourceArchived(source)).toBe(true);
    for (const [source] of OPENABLE_SOURCES) expect(sourceArchived(source)).toBe(false);
    expect(sourceArchived({ kind: 'textbook', lang: 'English', chapter_slug: '//evil.test' })).toBe(false);
    expect(sourceArchived({ kind: 'textbook', lang: 'Korean', chapter_slug: 'k1' })).toBe(false);
    expect(sourceArchived({ kind: 'textbook', lang: 'Japanese', chapter_slug: 'n5-book-u03', locator: { bookId: 'japanese-n5', editionId: 'bad', pageId: 'u03' } })).toBe(false);
  });

  it('복습 카드는 보관 문맥을 버리지 않고 링크 없이 남기며, 열 수 있는 문맥을 먼저 고른다', () => {
    const archived = { id: 'a', kind: 'textbook', lang: 'Japanese', chapter_slug: 'n5-04-desu-da', quote: 'わたしは がくせいです。', archived: true };
    const reading = { id: 'b', kind: 'reading', material_id: 188, quote: '眼前有山。', href: '/viewer/188' };
    const word = { word_text: 'がくせい', source_material_id: null, source_sentence: null };
    const both = reviewSourceContexts(word, [archived, reading]);
    expect(both.primary.id).toBe('b');
    expect(both.others).toEqual([expect.objectContaining({ id: 'a', href: null, archived: true })]);
    const only = reviewSourceContexts(word, [archived]);
    expect(only.primary).toEqual(expect.objectContaining({ id: 'a', href: null, archived: true, quote: 'わたしは がくせいです。' }));
  });
});

describe('비관리자가 학습자 링크를 따라가도 홈(/)으로 튕기지 않는다 (middleware 수준)', () => {
  function memberSession() {
    const query = { select: () => query, eq: () => query, single: async () => ({ data: { role: 'member' } }) };
    client.mockReturnValue({ auth: { getUser: async () => ({ data: { user: { id: 'member-1' } } }) }, from: () => query });
  }
  beforeEach(() => { client.mockReset(); memberSession(); });

  async function follow(href) {
    let url = new URL(href, 'https://manabi.test');
    for (let hop = 0; hop < 4; hop += 1) {
      const response = await middleware(new NextRequest(url));
      const location = response.headers.get('location');
      if (!location) return url;
      url = new URL(location);
    }
    return url;
  }

  it('모든 학습자 링크 생성 함수의 산출 주소를 비관리자로 따라간다', async () => {
    const hrefs = [
      ...(await patternEntries()).map(entry => entry.href),
      ...[...LEGACY_TEXTBOOK_SOURCES, ...OPENABLE_SOURCES.map(([source]) => source)].map(source => sourceHref(source)),
    ].filter(Boolean);
    expect(hrefs.length).toBeGreaterThan(5);
    for (const href of new Set(hrefs)) {
      const landed = await follow(href);
      expect(landed.pathname, href).not.toBe('/');
      expect(landed.pathname.startsWith('/admin/'), href).toBe(false);
    }
  });

  it('직접 옛 주소를 친 경우의 보관 리다이렉트와 관리자 확인은 그대로다', async () => {
    const first = await middleware(new NextRequest('https://manabi.test/chinese/grammar/h1-01-shi'));
    expect(first.headers.get('location')).toBe('https://manabi.test/admin/legacy-textbooks/chinese/grammar/h1-01-shi');
    expect((await follow('/chinese/grammar/h1-01-shi')).pathname).toBe('/');
  });
});
