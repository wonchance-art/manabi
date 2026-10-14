import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LITERATURE_COVER_COLORS,
  LITERATURE_COVER_MOTIFS,
  literatureChapterLabel,
  literatureChapterTitle,
  literatureDivisionLabel,
  literatureIncipit,
  validateLiteratureDisplay,
} from '../literatureDisplay.js';
import { literatureWork, literatureWorkOfBook } from '../literatureCanonical.js';
import manifest from '../../content/literature/aozora/manifest.generated.json';
import { sliceBetween } from './helpers/sliceBetween';

// 정본 문학책 표지·목차 표기(AOZORA-P0-5, 오너 확정 2026-10-14 「표지 직접 만들기 · 1과 2과 개편」).
// 표지는 원서 이미지가 아닌 타이포그래피(IP 정책 §2.1 금지⑴), 목차는 작가 見出し / 나눈 위치(1/2) / 전문 — 「과」를 쓰지 않는다.

const read = (file) => readFileSync(path.join(process.cwd(), file), 'utf8');
const KEYS = { gon: 'aozora-000121-000628', hana: 'aozora-000879-000042', tebukuro: 'aozora-000121-000637' };

describe('정본 5편 표기 — 대조표가 싣는다', () => {
  it('목차: 見出し 그대로 · 나눈 장은 1/N · 한 장이면 전문 — 「과」·「편」이 없다', () => {
    const labels = Object.fromEntries(Object.entries(manifest.works).map(([key, work]) => [key, [work.division, work.chapters.map((chapter) => chapter.title)]]));
    expect(labels).toEqual({
      'aozora-000081-043754': ['split', ['1/2', '2/2']],
      'aozora-000121-000628': ['heading', ['一', '二', '三', '四', '五', '六']],
      'aozora-000121-000637': ['whole', ['전문']],
      'aozora-000148-000753': ['split', ['1/4', '2/4', '3/4', '4/4']],
      'aozora-000879-000042': ['split', ['1/2', '2/2']],
    });
    expect(JSON.stringify(manifest)).not.toMatch(/\d+(과|편)"|전편/u);
  });

  it('표지 표기: 읽기(가나)·한국어 제목·작가 한국어 이름·팔레트 색·문양 — 다섯 편이 서로 다른 색·문양', () => {
    const works = Object.values(manifest.works);
    for (const work of works) expect(validateLiteratureDisplay(work.display, work.title)).toEqual(work.display);
    expect(Object.fromEntries(works.map((work) => [work.title, work.display.titleKo])))
      .toEqual({ '注文の多い料理店': '주문이 많은 요리점', 'ごん狐': '여우 곤', '手袋を買いに': '장갑을 사러', '文鳥': '문조', '鼻': '코' });
    expect(new Set(works.map((work) => work.display.cover)).size).toBe(works.length);
    // 문양은 작품 분위기에서(오너 지시 2026-10-14 KST) — 눈밤·彼岸花·숲의 문들·수묵 김·새장
    expect(Object.fromEntries(works.map((work) => [work.title, work.display.motif])))
      .toEqual({ '注文の多い料理店': 'forest-doors', 'ごん狐': 'higanbana', '手袋を買いに': 'snow-night', '文鳥': 'birdcage', '鼻': 'ink-steam' });
  });

  it('장 첫 문장(incipit) — 30자 이하 첫 문장은 통째로, 길면 「、」에서(낱말 한가운데·마침표 뒤에서 자르지 않는다)', () => {
    const incipits = (key) => manifest.works[key].chapters.map((chapter) => chapter.incipit);
    expect(incipits(KEYS.hana)).toEqual(['禅智内供の鼻と云えば、池の尾で知らない者はない。', 'しばらく踏んでいると、やがて、粟粒のようなものが…']);
    expect(incipits(KEYS.gon).slice(0, 4)).toEqual(['これは、私が小さいときに…', '十日ほどたって、ごんが、弥助というお百姓の家の裏…', '兵十が、赤い井戸のところで、麦をといでいました。', '月のいい晩でした。']);
    for (const work of Object.values(manifest.works)) {
      for (const { incipit } of work.chapters) expect(incipit.endsWith('…') ? /、…$|[^、。]…$/u.test(incipit) && !incipit.includes('。') : incipit.endsWith('。')).toBe(true);
    }
    expect(literatureIncipit('\n\n　短い。\n\n次')).toBe('短い。');
    expect(literatureIncipit('あ'.repeat(40))).toBe(`${'あ'.repeat(24)}…`); // 쉼표가 없으면 24자
  });
});

describe('표기 함수', () => {
  const gon = literatureWork(KEYS.gon);
  const hana = literatureWork(KEYS.hana);
  const tebukuro = literatureWork(KEYS.tebukuro);

  it('장 제목 — 「ごん狐 — 一」 · 「鼻 (1/2)」 · 「手袋を買いに」(저장 제목이 예전 표기여도 표를 따른다)', () => {
    expect([literatureChapterTitle(gon, 1), literatureChapterTitle(hana, '2'), literatureChapterTitle(tebukuro, 1)])
      .toEqual(['ごん狐 — 一', '鼻 (2/2)', '手袋を買いに']);
    expect(literatureChapterLabel(hana, 9)).toBe('9');
  });

  it('카드 메타 — 나눈 방식을 말한다', () => {
    // 「번」은 고유어 수(「2번」은 번호로 읽힌다), 작가의 장은 「N장 구성」(「6장」은 종이 장수로 읽힌다)
    expect([gon, hana, literatureWork('aozora-000148-000753'), tebukuro].map(literatureDivisionLabel))
      .toEqual(['6장 구성', '두 번에 나눠 읽기', '네 번에 나눠 읽기', '한 번에 읽기']);
  });

  it('책 묶음 → 작품: 아오조라 정본 표식 + 대조표 key가 둘 다 있어야(일반 책은 null)', () => {
    const chapter = (literature) => ({ processed_json: { metadata: { literature } } });
    expect(literatureWorkOfBook({ key: KEYS.gon, chapters: [chapter({ provider: 'aozora' })] })).toBe(gon);
    expect(literatureWorkOfBook({ key: KEYS.gon, chapters: [chapter(undefined)] })).toBe(null);
    expect(literatureWorkOfBook({ key: 'my-book', chapters: [chapter({ provider: 'aozora' })] })).toBe(null);
  });

  it.each([
    [{ titleReading: 'はな', titleKo: '코', authorKo: '아', cover: 'gold', motif: 'ink-steam' }, 'display.cover'],
    [{ titleReading: 'hana', titleKo: '코', authorKo: '아', cover: 'ink', motif: 'ink-steam' }, 'kana'],
    [{ titleReading: 'はな', titleKo: ' ', authorKo: '아', cover: 'ink', motif: 'ink-steam' }, 'titleKo'],
    [{ titleReading: 'はな', titleKo: '코', authorKo: '아', cover: 'ink' }, 'display.motif'],
  ])('검사 실패 %j', (display, message) => {
    expect(() => validateLiteratureDisplay(display, '鼻')).toThrow(message);
  });
});

describe('화면 배선', () => {
  it('표지는 글자 + 자작 SVG 문양 — 이미지·외부 그림을 쓰지 않는다(금지⑴) · 팔레트 색·문양마다 CSS가 있다 · 인라인 색 없음', () => {
    const cover = read('src/components/books/LiteratureCover.jsx');
    expect(cover).not.toMatch(/<img|background-image|url\(/u);
    expect(cover).toContain('<LiteratureCoverArt motif={work.display.motif} />');
    const art = read('src/components/books/LiteratureCoverArt.jsx');
    expect(art).not.toMatch(/<img|<image|href=|url\(|style=|#[0-9a-f]{3,8}\b|rgba?\(/iu); // 그림은 코드 도형만, 색은 CSS에서만
    expect(art).toContain('aria-hidden="true"');
    expect(art).toContain("import { LITERATURE_COVER_MOTIFS } from '../../lib/literatureDisplay';"); // 키 목록 정본 하나
    const artCss = read('src/components/books/literature-cover-art.css');
    for (const motif of LITERATURE_COVER_MOTIFS) {
      expect(artCss).toContain(`.lit-art--${motif}{`);
      expect(art).toMatch(new RegExp(`['\\s{]${motif.includes('-') ? `'${motif}'` : motif}: [A-Z]`, 'u')); // 키마다 그림이 있다
    }
    expect(artCss).not.toMatch(/url\(/u);
    // 제목 글꼴은 웹폰트 명조로 고정(기기마다 다른 시스템 명조 대신) — 사이트 전체 preload 없이
    expect(cover).toContain("Noto_Serif_JP({ weight: '400', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-lit-serif' })");
    expect(cover).not.toContain('style=');
    const css = read('src/components/books/literature-cover.css');
    for (const color of LITERATURE_COVER_COLORS) expect(css).toContain(`.lit-cover--${color}{`);
    expect(css).toContain('font-family:var(--font-lit-serif)');
    expect(css).not.toMatch(/url\(/u);
  });

  it('함께 읽는 글 책 카드 — 정본이면 표지·목차 표기·첫 문장, 이어 적기 없음(카드는 여전히 한 자리)', () => {
    const page = read('src/views/MaterialsPage.jsx');
    const block = sliceBetween(page, 'const bookCards = books.map', 'const pdfCards');
    expect(block).toContain('const work = literatureWorkOfBook(b);');
    expect(block).toContain('art: <LiteratureCover work={work} />');
    expect(block).toContain('lead: work ? literatureLead(c._bookOrder) : c._bookOrder');
    expect(block).toContain('<span className="group-card__sr">{`${work.total}부분 중 ${order}`}</span>'); // 「1/2」를 날짜로 읽지 않게
    expect(block).toContain("fitLine: fitLineOf(bf, '장')");
    expect(block).toContain('footer={!work && b.chapters[0]?.owner_id === user?.id');
  });

  it('뷰어 — 대조된 정본 장만 제목·형제 이름을 표에서, 「과」 대신 장/부분, 이어 적기·제목 편집 없음', () => {
    const viewer = read('src/views/ViewerPage.jsx');
    expect(viewer).toContain('const literatureBook = canonicalLiterature ? literatureWork(bookMeta?.key) : null;');
    expect(viewer).toContain('<h1 className="page-header__title">{viewerTitle}</h1>');
    expect(viewer).toContain("literatureBook.division === 'heading' ? ['이전 장', '다음 장'] : ['이전 부분', '다음 부분']");
    expect(viewer).toContain('nextLabel: bookNav.next ? `${nextLabel}: ${literatureTitleOf(bookNav.next.order)}` : nextLabel,'); // 목적지까지 읽어 준다
    expect(viewer).toContain("literatureBook?.division === 'heading' ? literatureChapterLabel(literatureBook, bookNav.next.order)"); // 「이어 읽기 · 二」
    expect(viewer).toContain('canAppend: !!user?.id && material?.owner_id === user.id && !literatureBook');
    expect(viewer).toContain('!composerOf(material) && !literatureBook && (');
  });
});
