import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { aozoraDocumentToPlainText, parseAozoraText } from '../aozoraParser.js';
import { createAozoraMaterialDraft } from '../aozoraMaterial.js';
import { aozoraCatalogEntryPublishable } from '../aozoraCatalog.js';
import { JP_LEVELS } from '../constants.js';
import { LITERATURE_FILES, LITERATURE_ROOT } from '../../../scripts/lib/literature-build.mjs';
import { aozoraFixture } from './helpers/aozoraFixtures.js';

// 실물 青空文庫 txt로 다시 고정한 계약(AOZORA-P0-2). 1차의 서식 견본(format-sample-*)은 배치만 흉내 낸 것이라,
// 실제 파일에서만 드러나는 것 — 기호 설명 블록·암시 루비·판권 연속 줄·見出し·JIS 외자 — 을 여기서 다시 잡는다.
// 정본 5편은 src/content/literature/aozora/에 있고, 실패 견본 「羅生門」은 fixtures/aozora/real-*.txt다(모두 퍼블릭 도메인 원작).

const work = (key) => {
  const dir = path.join(process.cwd(), LITERATURE_ROOT, key);
  const read = (file) => readFileSync(path.join(dir, file), 'utf8');
  return { source: read(LITERATURE_FILES.source), entry: JSON.parse(read(LITERATURE_FILES.entry)), chapters: JSON.parse(read(LITERATURE_FILES.chapters)) };
};
const rubies = (document) => document.blocks.flatMap((block) => block.children.filter((child) => child.type === 'ruby'));

describe('실물 「鼻」(芥川龍之介) — 머리·기호 블록·루비·판권', () => {
  const { source } = work('aozora-000879-000042');
  const document = parseAozoraText(source);

  it('기호 설명 블록의 （例） 줄은 본문도 판권도 아니다', () => {
    expect(document.header).toEqual({ title: '鼻', author: '芥川龍之介', lines: ['鼻', '芥川龍之介'] });
    const plain = aozoraDocumentToPlainText(document);
    expect(plain.startsWith('禅智内供の鼻と云えば、池の尾で知らない者はない。')).toBe(true);
    expect(plain).not.toMatch(/テキスト中に現れる記号|（例）|底本：/);
    expect(document.warnings).toEqual([]);
  });

  it('암시 루비는 직전 같은 문자종 연속에만, ｜는 그 지점부터 — 원문 그대로', () => {
    const pairs = rubies(document).map(({ base, reading }) => `${base}《${reading}》`);
    expect(pairs).toHaveLength(145);
    expect(pairs.slice(0, 5)).toEqual(['禅智内供《ぜんちないぐ》', '池《いけ》', '尾《お》', '上唇《うわくちびる》', '顋《あご》']);
    // 「勿論｜竜樹《りゅうじゅ》」 — ｜가 없으면 勿論竜樹 전체가 기준이 된다.
    expect(pairs).toContain('竜樹《りゅうじゅ》');
    expect(pairs).not.toContain('勿論竜樹《りゅうじゅ》');
    // 「腸詰《ちょうづ》め」 — 기준은 한자 연속까지, 뒤 送り仮名는 본문.
    expect(pairs).toContain('腸詰《ちょうづ》');
  });

  it('판권은 底本：부터, 들여쓴 연속 줄은 위 항목에 붙는다', () => {
    expect(document.colophon).toMatchObject({
      sourceBook: ['「芥川龍之介全集1」ちくま文庫、筑摩書房', '1986（昭和61）年9月24日第1刷発行', '1997（平成9）年4月15日第14刷発行'],
      parentBook: ['「筑摩全集類聚版芥川龍之介全集」筑摩書房', '1971（昭和46）年3月〜1971（昭和46）年11月'],
      firstAppearance: ['「新思潮」', '1916（大正5）年2月'],
      inputter: '平山誠、野口英司',
      proofreader: 'もりみつじゅんじ',
    });
  });
});

describe('실물 「ごん狐」(新美南吉) — 見出し 주석이 장을 가른다', () => {
  const { source, chapters } = work('aozora-000121-000628');

  it('［＃「一」は中見出し］ 6개 → 표제 블록 6개 → 장 6개(제목 = 표제)', () => {
    const document = parseAozoraText(source);
    expect(document.blocks.filter((block) => block.type === 'heading').map((block) => block.children[0].value))
      .toEqual(['一', '二', '三', '四', '五', '六']);
    expect(chapters.chapters.map((chapter) => chapter.title)).toEqual(['一', '二', '三', '四', '五', '六']);
    expect(chapters.diagnostics.splitByHeadings).toBe(true);
  });
});

describe('실물 「羅生門」 — JIS 3·4수준 외자는 미해결로 보고 공개하지 않는다(fail-closed)', () => {
  const document = parseAozoraText(aozoraFixture('real-rashomon-000879-127.txt'));

  it('면구점만 있는 외자 3개는 미해결, 그 외자에 걸린 루비는 RUBY_ON_GAIJI 경고', () => {
    expect(document.gaiji.map((item) => [item.line, item.status])).toEqual([[38, 'unresolved'], [40, 'unresolved'], [42, 'unresolved']]);
    expect(document.gaiji[0].description).toBe('「てへん＋丑」、第4水準2-12-93');
    expect(document.warnings.map((warning) => [warning.code, warning.line]))
      .toEqual([['RUBY_ON_GAIJI', 38], ['RUBY_ON_GAIJI', 40], ['RUBY_ON_GAIJI', 42]]);
  });

  it('책 초안을 만들지 않는다', () => {
    const entry = { ...work('aozora-000879-000042').entry, workId: '127', title: '羅生門',
      cardUrl: 'https://www.aozora.gr.jp/cards/000879/card127.html',
      sourceFileUrl: 'https://www.aozora.gr.jp/cards/000879/files/127_ruby_150.zip' };
    expect(() => createAozoraMaterialDraft(entry, document)).toThrow('unresolved gaiji');
  });
});

// 정본 5편 — 편집 레벨(D6)·장 수·루비 수를 고정한다. 장 크기는 10–15분 분량(설계 §1.2), 見出し 없는 작품은 고른 길이.
const WORKS = {
  'aozora-000081-043754': { title: '注文の多い料理店', level: 'N3 중급', chapters: 2, ruby: 106 },
  'aozora-000121-000628': { title: 'ごん狐', level: 'N3 중급', chapters: 6, ruby: 69 },
  'aozora-000121-000637': { title: '手袋を買いに', level: 'N4 기본', chapters: 1, ruby: 64 },
  'aozora-000148-000753': { title: '文鳥', level: 'N1 심화', chapters: 4, ruby: 444 },
  'aozora-000879-000042': { title: '鼻', level: 'N2 상급', chapters: 2, ruby: 145 },
};

describe('정본 5편 — 리포의 작품 폴더', () => {
  it('폴더 목록이 고정 표와 같다(작품 추가 시 이 표도 함께 고친다)', () => {
    const dirs = readdirSync(path.join(process.cwd(), LITERATURE_ROOT), { withFileTypes: true })
      .filter((item) => item.isDirectory()).map((item) => item.name).sort();
    expect(dirs).toEqual(Object.keys(WORKS));
  });

  it.each(Object.entries(WORKS))('%s — 공개 가능·잠금 정확·장 크기', (key, expected) => {
    const { entry, chapters } = work(key);
    expect(aozoraCatalogEntryPublishable(entry)).toBe(true);
    expect(JP_LEVELS).toContain(entry.level);
    expect([entry.title, entry.level, chapters.chapters.length]).toEqual([expected.title, expected.level, expected.chapters]);
    expect(chapters.diagnostics).toMatchObject({ rubyCount: expected.ruby, mappedRubyCount: expected.ruby, droppedRubyCount: 0, midParagraphSplitCount: 0 });
    for (const chapter of chapters.chapters) {
      expect(chapter.metadata.book).toMatchObject({ key, title: entry.title, total: expected.chapters });
      for (const lock of chapter.metadata.literature.rubyLocks) expect(chapter.rawText.slice(lock.start, lock.end)).toBe(lock.base);
      expect(chapter.rawText).not.toMatch(/[《》｜［］※〓]/u);
      expect(chapter.rawText.length).toBeLessThanOrEqual(4000);
    }
    if (!chapters.diagnostics.splitByHeadings) {
      const sizes = chapters.diagnostics.chapterChars;
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(2000);
      expect(Math.max(...sizes) / Math.min(...sizes)).toBeLessThan(1.25);
    }
  });
});
