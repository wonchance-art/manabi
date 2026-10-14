import { describe, expect, it } from 'vitest';
import { AOZORA_EDIT_NOTES, aozoraRubyLockable, createAozoraMaterialDraft } from '../aozoraMaterial.js';
import { parseAozoraText } from '../aozoraParser.js';
import { getBook, groupByBook } from '../bookMeta.js';
import { aozoraFixture, plainSampleEntry, sampleEntry } from './helpers/aozoraFixtures.js';

const headed = () => parseAozoraText(aozoraFixture('format-sample-headings.txt'));
const plain = () => parseAozoraText(aozoraFixture('format-sample-plain.txt'));
const wrap = (body, header = ['書式見本　朝の川', '見本太郎']) => [
  ...header, '', body, '', '', '底本：「見本」架空書房', '入力：甲', '校正：乙',
].join('\n');

/** 계약의 핵심 — 모든 잠금이 최종 장 raw_text의 그 자리를 정확히 가리킨다. */
function expectLocksExact(draft) {
  for (const chapter of draft.chapters) {
    for (const lock of chapter.metadata.literature.rubyLocks) {
      expect(chapter.rawText.slice(lock.start, lock.end), `${chapter.title} ${lock.base}`).toBe(lock.base);
    }
    // 표식·루비 기호·주석이 평문에 새지 않는다(《》는 해결된 기호 외자로 본문에 올 수 있어 제외).
    expect(chapter.rawText).not.toMatch(/[\uE000\uE001｜]|［＃/u);
  }
}

describe('createAozoraMaterialDraft — 見出し 기준 장 분할(기존 splitTextIntoChapters)', () => {
  const draft = createAozoraMaterialDraft(sampleEntry(), headed());

  it('見出し가 장 제목, 문단은 빈 줄로 띄운 평문(들여쓰기 전각 공백 제거)', () => {
    expect(draft.book).toEqual({ key: 'aozora-000001-000001', title: '書式見本　朝の川', author: '見本太郎', level: 'N3 중급', total: 2 });
    expect(draft.chapters.map(({ order, title, materialTitle }) => ({ order, title, materialTitle }))).toEqual([
      { order: 1, title: '一', materialTitle: '書式見本　朝の川 — 一' },
      { order: 2, title: '二', materialTitle: '書式見本　朝の川 — 二' },
    ]);
    expect(draft.chapters[0].rawText).toBe([
      '朝の川面は、まだ薄い霧に包まれていた。私は小さな舟着場に立って、向こう岸の灯を数えた。',
      '「今日も渡るのかい。」と、船頭が笑いながら言った。',
      '私は黙ってうなずき、冷たい欄干に手を置いた。',
    ].join('\n\n'));
    expect(draft.diagnostics).toMatchObject({ headingCount: 2, splitByHeadings: true, rubyCount: 5, mappedRubyCount: 5, droppedRubyCount: 0, midParagraphSplitCount: 0 });
  });

  it('루비 잠금은 장 로컬 오프셋이고 rawText.slice(lock) === base', () => {
    expect(draft.chapters[0].metadata.literature.rubyLocks).toEqual([
      { start: 2, end: 4, base: '川面', reading: 'かわも' },
      { start: 24, end: 27, base: '舟着場', reading: 'ふなつきば' },
      { start: 46, end: 48, base: '今日', reading: 'きょう' },
      { start: 58, end: 60, base: '船頭', reading: 'せんどう' },
      { start: 85, end: 87, base: '欄干', reading: 'らんかん' },
    ]);
    expect(draft.chapters[1].metadata.literature.rubyLocks).toEqual([]);
    expectLocksExact(draft);
  });

  it('장마다 기존 책 묶음(metadata.book)·편집 레벨·크레딧을 싣는다', () => {
    const [first] = draft.chapters;
    expect(getBook(first.metadata)).toEqual({ key: 'aozora-000001-000001', title: '書式見本　朝の川', order: 1, total: 2 });
    expect(first.metadata).toMatchObject({ language: 'Japanese', level: 'N3 중급' });
    expect(first.metadata.literature).toMatchObject({
      provider: 'aozora', workKey: 'aozora-000001-000001', personId: '000001', workId: '1',
      publishedYear: 1920, authorDeathYear: 1940, charset: '新字新仮名',
      cardUrl: 'https://www.aozora.gr.jp/cards/000001/card1.html',
      attribution: { author: '見本太郎', translator: null, illustrator: null },
      rights: { status: 'approved', basis: 'public-domain', reviewedJurisdictions: ['JP', 'KR', 'US'] },
      colophon: {
        sourceBook: ['「書式見本集」架空書房', '2026（令和8）年10月12日第1刷発行'],
        parentBook: ['「書式見本原稿」架空書房', '2026（令和8）年10月1日'],
        inputter: '見本入力者', proofreader: '見本校正者',
      },
      edits: [...AOZORA_EDIT_NOTES],
    });
    // 공개 탭 책 카드(groupByBook)가 코드 변경 없이 한 권으로 묶는다(설계 §1.3 · D3).
    const rows = draft.chapters.map((chapter, index) => ({ id: index, processed_json: { metadata: chapter.metadata } })).reverse();
    expect(groupByBook(rows).books.map((book) => [book.key, book.chapters.map((row) => row.id)])).toEqual([['aozora-000001-000001', [0, 1]]]);
  });
});

describe('createAozoraMaterialDraft — 見出し 없는 원작은 문단 경계 길이 분할', () => {
  it('제목은 「N편」, 의미 주석 루비(ノート《帳面》)는 잠그지 않는다', () => {
    const draft = createAozoraMaterialDraft(plainSampleEntry(), plain(), { targetChars: 80, maxChars: 120 });
    expect(draft.chapters.map((chapter) => chapter.title)).toEqual(['1편', '2편']);
    expect(draft.chapters.flatMap((chapter) => chapter.metadata.literature.rubyLocks.map((lock) => lock.base)))
      .toEqual(['夕方', '町', '時計台', '台所']);
    expect(draft.diagnostics).toMatchObject({ splitByHeadings: false, rubyCount: 4, mappedRubyCount: 4, annotationRubyCount: 2, midParagraphSplitCount: 0 });
    expect(draft.chapters[0].rawText.split('\n\n')[1]).toBe('姉はノートを開いて、今日あったことを短く書いた。窓の外では、かげろうのような光が揺れていた。');
    expectLocksExact(draft);
  });

  it('장 수를 먼저 정해 고르게 — 짧은 꼬리 장을 남기지 않는다(실물 「鼻」 2837·2752·230자, AOZORA-P0-2)', () => {
    const body = ['あ'.repeat(50), 'い'.repeat(50), 'う'.repeat(8)].join('\n');
    const draft = createAozoraMaterialDraft(sampleEntry(), parseAozoraText(wrap(body)), { targetChars: 60, maxChars: 200 });
    // 이전: 목표(60)를 넘기 전에 닫아 [50, 50, 8]. 지금: round(112/60) = 2장 안에 드는 가장 작은 목표 → [50, 60].
    expect(draft.diagnostics.chapterChars).toEqual([50, 60]);
    expect(draft.diagnostics.midParagraphSplitCount).toBe(0);
  });

  it('짧은 원작은 한 장, 상한보다 긴 원작은 상한 안에서 고르게', () => {
    const short = createAozoraMaterialDraft(sampleEntry(), parseAozoraText(wrap(['あ'.repeat(70), 'い'.repeat(30)].join('\n'))), { targetChars: 80, maxChars: 200 });
    expect(short.diagnostics.chapterChars).toEqual([102]);
    const long = createAozoraMaterialDraft(sampleEntry(), parseAozoraText(wrap(Array.from({ length: 9 }, () => 'え'.repeat(30)).join('\n'))), { targetChars: 100, maxChars: 120 });
    expect(long.diagnostics.chapterChars).toEqual([94, 94, 94]);
  });

  it('기본 크기면 짧은 원작은 한 장 — 긴 줄을 나누지 않는다(분석 분할은 analyzeText 몫, #1412)', () => {
    const long = `${'長い文が続く。'.repeat(60)}最後に｜時計台《とけいだい》が鳴った。`;
    const draft = createAozoraMaterialDraft(sampleEntry(), parseAozoraText(wrap(long)));
    expect(draft.chapters).toHaveLength(1);
    expect(draft.chapters[0].rawText.split('\n')).toHaveLength(1);
    expect(draft.chapters[0].rawText.length).toBeGreaterThan(400);
    expectLocksExact(draft);
  });

  it('상한을 넘는 한 문단이 루비 기준 한가운데서 갈리면 그 잠금만 버리고 센다(나머지는 정확)', () => {
    const body = `${'あ'.repeat(5)}｜時計台《とけいだい》${'い'.repeat(5)}｜台所《だいどころ》`;
    const draft = createAozoraMaterialDraft(sampleEntry(), parseAozoraText(wrap(body)), { targetChars: 10, maxChars: 10 });
    expect(draft.chapters.length).toBeGreaterThan(1);
    // 첫 장 끝에서 時計台의 여는 표식이 잘린다 → 그 잠금 1개는 버리고(빌드는 이 값이 0이 아니면 실패), 台所는 정확히 잇는다.
    expect(draft.diagnostics).toMatchObject({ rubyCount: 2, mappedRubyCount: 1, droppedRubyCount: 1, midParagraphSplitCount: 2 });
    expect(draft.chapters.at(-1).metadata.literature.rubyLocks.map((lock) => lock.base)).toEqual(['台所']);
    expectLocksExact(draft);
  });
});

describe('createAozoraMaterialDraft — 결정성·불변·fail-closed', () => {
  it('결정적이고 깊게 동결되며 입력을 바꾸지 않는다', () => {
    const entry = sampleEntry();
    const before = JSON.stringify(entry);
    const first = createAozoraMaterialDraft(entry, headed());
    expect(JSON.stringify(first)).toBe(JSON.stringify(createAozoraMaterialDraft(entry, headed())));
    expect(JSON.stringify(entry)).toBe(before);
    expect(Object.isFrozen(first.chapters[0].metadata.literature.rubyLocks)).toBe(true);
    expect(() => { first.chapters.push({}); }).toThrow();
  });

  it.each([
    ['미승인', () => [sampleEntry({ rights: { status: 'candidate', basis: 'unknown' } }), headed()], 'not publishable'],
    ['번역작', () => [sampleEntry({ attribution: { author: '見本太郎', translator: '翻訳者', illustrator: null } }), headed()], 'not publishable'],
    ['D5 밖', () => [sampleEntry({ publishedYear: 1946, authorDeathYear: 1948 }), headed()], 'not publishable'],
    ['旧字旧仮名', () => [sampleEntry({ charset: '旧字旧仮名' }), headed()], 'not publishable'],
    ['제목 불일치', () => [sampleEntry({ title: '別作品' }), headed()], 'title'],
    ['저자 불일치', () => [sampleEntry(), parseAozoraText(wrap('本文。', ['書式見本　朝の川', '別人']))], 'author'],
    ['판권 없음', () => [sampleEntry(), parseAozoraText('書式見本　朝の川\n見本太郎\n\n本文。')], '底本'],
    ['미해결 외자', () => [sampleEntry(), parseAozoraText(wrap('古い※［＃「魚＋花」、第4水準2-93-10］。'))], 'unresolved gaiji'],
    ['깨진 루비', () => [sampleEntry(), parseAozoraText(wrap('｜壊れた《ルビ'))], 'MALFORMED_RUBY'],
  ])('%s → 실패', (_, args, message) => {
    expect(() => createAozoraMaterialDraft(...args())).toThrow(message);
  });
});

describe('aozoraRubyLockable — 사전 furigana와 같은 뜻(한자 읽기)만 잠근다', () => {
  it.each([
    [{ base: '先生', reading: 'せんせい' }, true],
    [{ base: '人々', reading: 'ひとびと' }, true],
    [{ base: '煙草', reading: 'タバコ' }, true],
    [{ base: 'ノート', reading: '帳面' }, false],
    [{ base: 'かげろう', reading: '陽炎' }, false],
    [{ base: 'ＡＢＣ', reading: 'えーびーしー' }, false],
  ])('%j → %s', (ruby, expected) => {
    expect(aozoraRubyLockable(ruby)).toBe(expected);
  });
});
