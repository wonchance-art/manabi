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
const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** 1–99 → 漢数字(十一·二十·五十六) — 작가 見出し 절 번호 표기 */
const kanjiNumber = (n) => `${n >= 20 ? DIGITS[Math.floor(n / 10)] : ''}${n >= 10 ? '十' : ''}${DIGITS[n % 10]}`;
/** 한 見出し 장을 n조각으로 나눈 이름 — 「一 (1/5)」… */
const parts = (heading, n) => Array.from({ length: n }, (_, k) => `${heading} (${k + 1}/${n})`);
const KEYS = { gon: 'aozora-000121-000628', hana: 'aozora-000879-000042', tebukuro: 'aozora-000121-000637' };

describe('정본 작품 표기 — 대조표가 싣는다', () => {
  it('목차: 見出し 그대로 · 나눈 장은 1/N · 한 장이면 전문 — 「과」·「편」이 없다', () => {
    const labels = Object.fromEntries(Object.entries(manifest.works).map(([key, work]) => [key, [work.division, work.chapters.map((chapter) => chapter.title)]]));
    expect(labels).toEqual({
      'aozora-000081-043754': ['split', ['1/2', '2/2']],
      'aozora-000121-000628': ['heading', ['一', '二', '三', '四', '五', '六']],
      'aozora-000121-000637': ['whole', ['전문']],
      'aozora-000148-000753': ['split', ['1/4', '2/4', '3/4', '4/4']],
      'aozora-000879-000042': ['split', ['1/2', '2/2']],
      // 2차 묶음(2026-10-14) — 見出し가 4,000자를 넘는 장은 그 장만 고르게 나눈다(坊っちゃん 「一 (1/3)」)
      'aozora-000074-000424': ['split', ['1/2', '2/2']],
      'aozora-000081-000470': ['split', ['1/4', '2/4', '3/4', '4/4']],
      'aozora-000081-000473': ['split', ['1/2', '2/2']],
      'aozora-000081-000456': ['heading', [
        '一、午后の授業', '二、活版所', '三、家', '四、ケンタウル祭の夜', '五、天気輪の柱', '六、銀河ステーション',
        '七、北十字とプリオシン海岸 (1/2)', '七、北十字とプリオシン海岸 (2/2)', '八、鳥を捕る人 (1/2)', '八、鳥を捕る人 (2/2)',
        ...Array.from({ length: 7 }, (_, k) => `九、ジョバンニの切符 (${k + 1}/7)`)]],
      'aozora-000119-000624': ['split', ['1/2', '2/2']],
      'aozora-000129-045245': ['split', ['1/3', '2/3', '3/3']],
      'aozora-000148-000752': ['heading', ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一']
        .flatMap((heading, index) => {
          const parts = [3, 2, 2, 3, 3, 4, 4, 3, 3, 3, 4][index];
          return Array.from({ length: parts }, (_, k) => `${heading} (${k + 1}/${parts})`);
        })],
      'aozora-000879-000092': ['heading', ['一', '二', '三']],
      'aozora-000879-000127': ['split', ['1/2', '2/2']],
      // 3차 묶음(2026-10-14) — こころ는 上·中·下 見出し 아래 절 번호 그대로 110장(대見出し는 그 첫 절 이름 앞에)
      'aozora-000081-046605': ['heading', ['一、五月', '二、十二月']],
      'aozora-000081-000462': ['split', Array.from({ length: 11 }, (_, k) => `${k + 1}/11`)],
      'aozora-000148-000773': ['heading', [['上　先生と私', 36], ['中　両親と私', 18], ['下　先生と遺書', 56]]
        .flatMap(([part, count]) => Array.from({ length: count }, (_, k) => (k ? kanjiNumber(k + 1) : `${part}　一`)))],
      'aozora-000879-043015': ['heading', ['一', '二', '三', '四', '五', '六']],
      'aozora-000879-043016': ['split', ['1/2', '2/2']],
      'aozora-001383-056641': ['split', ['1/2', '2/2']],
      'aozora-001779-056648': ['split', ['1/4', '2/4', '3/4', '4/4']],
      // 4차 묶음(2026-10-15) — 人間失格은 はしがき·手記 셋·あとがき(第三の手記는 一·二 절), 斜陽은 一–八
      'aozora-000035-000275': ['split', Array.from({ length: 10 }, (_, k) => `${k + 1}/10`)],
      'aozora-000035-000301': ['heading', ['はしがき', ...parts('第一の手記', 3), ...parts('第二の手記', 9), ...parts('第三の手記　一', 6), ...parts('二', 5), 'あとがき']],
      'aozora-000035-001565': ['heading', [...parts('一', 5), ...parts('二', 5), ...parts('三', 5), ...parts('四', 4), ...parts('五', 5), ...parts('六', 4), ...parts('七', 3), '八']],
      'aozora-000035-001567': ['split', ['1/3', '2/3', '3/3']],
      'aozora-001095-042618': ['split', Array.from({ length: 6 }, (_, k) => `${k + 1}/6`)],
    });
    expect(JSON.stringify(manifest)).not.toMatch(/\d+(과|편)"|전편/u);
  });

  it('표지 표기: 읽기(가나)·한국어 제목·작가 한국어 이름·팔레트 색·문양 — 작품마다 서로 다른 색·문양', () => {
    const works = Object.values(manifest.works);
    for (const work of works) expect(validateLiteratureDisplay(work.display, work.title)).toEqual(work.display);
    expect(Object.fromEntries(works.map((work) => [work.title, work.display.titleKo])))
      .toEqual({ '注文の多い料理店': '주문이 많은 요리점', 'ごん狐': '여우 곤', '手袋を買いに': '장갑을 사러', '文鳥': '문조', '鼻': '코',
        '檸檬': '레몬', 'セロ弾きのゴーシュ': '첼로 켜는 고슈', 'よだかの星': '쏙독새의 별', '山月記': '산월기', '高瀬舟': '다카세부네',
        '坊っちゃん': '도련님', '蜘蛛の糸': '거미줄', '羅生門': '라쇼몬',
        '銀河鉄道の夜': '은하철도의 밤', 'こころ': '마음', 'やまなし': '돌배', '風の又三郎': '바람의 마타사부로', 'トロッコ': '광차',
        '杜子春': '두자춘', '人間椅子': '인간 의자', '刺青': '문신',
        '走れメロス': '달려라 메로스', '人間失格': '인간 실격', '斜陽': '사양', '女生徒': '여학생', '桜の森の満開の下': '만개한 벚꽃 숲 아래' });
    expect(new Set(works.map((work) => work.display.cover)).size).toBe(works.length);
    // 문양은 작품 분위기에서, 작품마다 새로(오너 지시 2026-10-14 KST 「작품마다 새 문양」) — 같은 문양을 두 작품이 쓰지 않는다
    expect(Object.fromEntries(works.map((work) => [work.title, work.display.motif])))
      .toEqual({ '注文の多い料理店': 'forest-doors', 'ごん狐': 'higanbana', '手袋を買いに': 'snow-night', '文鳥': 'birdcage', '鼻': 'ink-steam',
        '檸檬': 'lemon-books', 'セロ弾きのゴーシュ': 'cello-night', 'よだかの星': 'nightjar-star', '山月記': 'moon-tiger', '高瀬舟': 'night-boat',
        '坊っちゃん': 'steam-sea', '蜘蛛の糸': 'lotus-thread', '羅生門': 'rain-gate',
        '銀河鉄道の夜': 'night-train', 'こころ': 'kamakura-letter', 'やまなし': 'crab-pear', '風の又三郎': 'wind-hill', 'トロッコ': 'dusk-rails',
        '杜子春': 'peach-house', '人間椅子': 'deco-chair', '刺青': 'spider-web',
        '走れメロス': 'melos-run', '人間失格': 'clown-photos', '斜陽': 'setting-sun', '女生徒': 'umbrella-rose', '桜の森の満開の下': 'blossom-storm' });
    expect(new Set(works.map((work) => work.display.motif)).size).toBe(works.length);
  });

  it('표지 바탕색은 서로 충분히 달라야 한다 — 어떤 두 권도 CIELAB 색차 12 미만이 아니다(2026-10-15 26권 나란히 검토)', () => {
    // 이름만 다르고 눈으로는 같은 색(檸檬 회색 ↔ こころ 회색, よだかの星 ↔ 銀河鉄道の夜 보라)을 새 작품 추가 때 다시 만들지 않게.
    const css = read('src/components/books/literature-cover.css');
    const hex = Object.fromEntries([...css.matchAll(/\.lit-cover--([a-z]+)\{--cover-color:(#[0-9a-f]{6})/gu)].map((m) => [m[1], m[2]]));
    const lab = (value) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
      const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
      const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const works = Object.values(manifest.works);
    const close = [];
    for (const [i, a] of works.entries()) {
      for (const b of works.slice(i + 1)) {
        const [p, q] = [lab(hex[a.display.cover]), lab(hex[b.display.cover])];
        const distance = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        if (distance < 12) close.push(`${a.title}(${a.display.cover}) ↔ ${b.title}(${b.display.cover}) ${distance.toFixed(1)}`);
      }
    }
    expect(close).toEqual([]);
  });

  it('장 첫 문장(incipit) — 30자 이하 첫 문장은 통째로, 길면 「、」에서(낱말 한가운데·마침표 뒤에서 자르지 않는다)', () => {
    const incipits = (key) => manifest.works[key].chapters.map((chapter) => chapter.incipit);
    expect(incipits(KEYS.hana)).toEqual(['禅智内供の鼻と云えば、池の尾で知らない者はない。', 'しばらく踏んでいると、やがて、粟粒のようなものが…']);
    expect(incipits(KEYS.gon).slice(0, 4)).toEqual(['これは、私が小さいときに…', '十日ほどたって、ごんが、弥助というお百姓の家の裏…', '兵十が、赤い井戸のところで、麦をといでいました。', '月のいい晩でした。']);
    for (const work of Object.values(manifest.works)) {
      // 끝이 「…」이면 쉼표 경계·24자 규칙, 아니면 30자 이하 통째 — 。까지의 문장, 대사 한 줄(「時間が減って、…妙だな」 — 坊っちゃん),
      // 또는 。 없는 짧은 첫 줄 통째(노래 「どっどど　どどうど…」·줄이 끊긴 「霧の中に立っていて、」 — 風の又三郎)
      for (const { incipit } of work.chapters) {
        expect(incipit.endsWith('…') ? /、…$|[^、。]…$/u.test(incipit) && !incipit.includes('。')
          : incipit.length <= 30 && (/[。」]$/u.test(incipit) || !incipit.includes('。'))).toBe(true);
      }
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

  it.each([
    ['한 줄에 드는 제목을 반반 나눔(아래가 비어 보인다)', '手袋を買いに', '手袋を\n買いに'],
    ['첫 줄이 짧은 계단(둘째 줄이 더 길다)', '注文の多い料理店', '注文の\n多い料理店'],
  ])('표지 제목 줄바꿈 거부 — %s', (_, title, coverTitle) => {
    const display = { titleReading: 'て', titleKo: '가', authorKo: '아', cover: 'ink', motif: 'ink-steam', coverTitle };
    expect(() => validateLiteratureDisplay(display, title)).toThrow('display.coverTitle breaks only');
  });
});

describe('화면 배선', () => {
  it('표지는 글자 + 자작 SVG 문양 — 이미지·외부 그림을 쓰지 않는다(금지⑴) · 팔레트 색·문양마다 CSS가 있다 · 인라인 색 없음', () => {
    const cover = read('src/components/books/LiteratureCover.jsx');
    expect(cover).not.toMatch(/<img|background-image|url\(/u);
    expect(cover).toContain('<LiteratureCoverArt motif={work.display.motif} />');
    const art = read('src/components/books/LiteratureCoverArt.jsx');
    // 그림은 코드 도형만, 색은 CSS에서만 — 같은 표지 안의 필터·그라디언트 참조(url(#…) · href="#…")만 허용(옛 종이 질감, 외부 그림·data: 없음)
    expect(art).not.toMatch(/<img|<image|href=(?!["{`]#|\{`#)|url\((?!#)|data:|style=|#[0-9a-f]{3,8}\b|rgba?\(/iu);
    expect(art).toContain('aria-hidden="true"');
    expect(art).toContain("import { LITERATURE_COVER_MOTIFS } from '../../lib/literatureDisplay';"); // 키 목록 정본 하나
    const artCss = read('src/components/books/literature-cover-art.css');
    for (const motif of LITERATURE_COVER_MOTIFS) {
      expect(artCss).toContain(`.lit-art--${motif}{`);
      expect(art).toMatch(new RegExp(`['\\s{]${motif.includes('-') ? `'${motif}'` : motif}: [A-Z]`, 'u')); // 키마다 그림이 있다
    }
    expect(artCss).not.toMatch(/url\(/u);
    // 제목 글꼴은 웹폰트 명조로 고정(기기마다 다른 시스템 명조 대신) — 사이트 전체 preload 없이
    // 글꼴은 오너가 실제 글꼴 비교에서 고른 しっぽり明朝 B1 500(2026-10-14 KST) — 제목·작가가 같은 굵기를 받는다(500 한 벌만 받으므로)
    expect(cover).toContain("Shippori_Mincho_B1({ weight: '500', subsets: ['latin'], display: 'swap', preload: false, variable: '--font-lit-serif' })");
    expect(cover).not.toMatch(/Noto_Serif_JP/u);
    expect(cover).not.toContain('style=');
    const css = read('src/components/books/literature-cover.css');
    for (const color of LITERATURE_COVER_COLORS) expect(css).toContain(`.lit-cover--${color}{`);
    expect(css).toContain('font-family:var(--font-lit-serif)');
    expect(css.match(/font-weight:500/gu)).toHaveLength(2);
    expect(css).not.toMatch(/font-weight:(?!500)/u);
    // 작가 끝은 아래 선(bottom:8px)보다 위에서 멈춘다 — 두 줄 제목이면 작가가 선 바로 위로 와 끝 글자가 선에 닿았다
    expect(css).toMatch(/\.lit-cover__author\{[^}]*margin:0 2px 3px 0/u);
    // 시리즈: 제목 크기는 한 값뿐 — 글자 수로 크기를 바꾸지 않는다(오너 지시 「서적마다 편차 없이」)
    expect(css.match(/\.lit-cover__title\{[^}]*font-size:11px/u)).toBeTruthy();
    expect(css.match(/font-size:/gu)).toHaveLength(2); // 제목 하나 + 작가 하나 — 작품마다 다른 크기가 없다
    expect(cover).not.toMatch(/longest|lit-cover__title--(xl|l|m|s)\b/u);
    // 균형: 작가는 제목 왼쪽 아래(대각선 짝) · 긴 제목만 둘째 줄을 아래에 붙인다(반반 떠서 아래가 비지 않게)
    expect(cover).toContain('<span lang="ja" className="lit-cover__author">{work.author}</span>');
    expect(css).toContain('.lit-cover__title--stepped .lit-cover__line:last-child{text-align:end}');
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
    expect(viewer).toContain('<h1 className="page-header__title" lang={contentLangTag}>{viewerTitle}</h1>'); // lang = LINE-BREAK-001
    expect(viewer).toContain("literatureBook.division === 'heading' ? ['이전 장', '다음 장'] : ['이전 부분', '다음 부분']");
    expect(viewer).toContain('nextLabel: bookNav.next ? `${nextLabel}: ${literatureTitleOf(bookNav.next.order)}` : nextLabel,'); // 목적지까지 읽어 준다
    expect(viewer).toContain("literatureBook?.division === 'heading' ? literatureChapterLabel(literatureBook, bookNav.next.order)"); // 「이어 읽기 · 二」
    expect(viewer).toContain('canAppend: !!user?.id && material?.owner_id === user.id && !literatureBook');
    expect(viewer).toContain('!composerOf(material) && !literatureBook && (');
  });
});
