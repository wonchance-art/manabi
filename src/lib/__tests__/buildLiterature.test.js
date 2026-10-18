import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildLiterature, LITERATURE_FILES, LITERATURE_OUTPUTS, LITERATURE_ROOT } from '../../../scripts/lib/literature-build.mjs';
import { LITERATURE_BOUNDARY_FILE, LITERATURE_BOUNDARY_VERSION } from '../../../scripts/lib/literature-boundaries.mjs';
import { aozoraFixture, sha256, sampleEntry } from './helpers/aozoraFixtures.js';
import { literatureIncipit } from '../literatureDisplay.js';

// 정본 문학책 빌드(scripts/build-literature.mjs) 계약 — 리포 상태 --check가 통과하고(prebuild와 같은 검사),
// 임시 작품 폴더로 생성·결정성·낡음·fail-closed를 확인한다. 작품 원문은 서식 견본(실제 작품 아님)이다.

const temps = [];
afterEach(() => { while (temps.length) rmSync(temps.pop(), { recursive: true, force: true }); });

function workspace(works) {
  const root = mkdtempSync(path.join(tmpdir(), 'manabi-literature-'));
  temps.push(root);
  for (const { dir, source, entry } of works) {
    mkdirSync(path.join(root, dir));
    if (source != null) writeFileSync(path.join(root, dir, LITERATURE_FILES.source), source);
    if (entry != null) writeFileSync(path.join(root, dir, LITERATURE_FILES.entry), `${JSON.stringify(entry, null, 2)}\n`);
  }
  return root;
}

const source = aozoraFixture('format-sample-headings.txt');
const sample = (overrides = {}) => ({
  dir: 'aozora-000001-000001',
  source,
  entry: sampleEntry({ textSha256: sha256(source), ...overrides }),
});

describe('build-literature — 리포 상태', () => {
  it('리포의 정본 폴더(5편)가 --check를 통과한다 — 목록·대조표 포함', async () => {
    const { errors } = await buildLiterature({ root: LITERATURE_ROOT, check: true });
    expect(errors).toEqual([]);
  });

  it('prebuild가 --check를 돈다 — 낡은 chapters.json·미승인 작품이 배포로 새지 않는다', () => {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts.prebuild).toContain('node scripts/build-literature.mjs --check');
  });
});

describe('build-literature — 생성·결정성·낡음', () => {
  it('chapters.json을 쓰고, 다시 돌리면 같은 바이트(unchanged), --check 통과', async () => {
    const root = workspace([sample()]);
    const written = await buildLiterature({ root });
    expect(written).toEqual({ works: [{ key: 'aozora-000001-000001', chapters: 2, status: 'written' }], errors: [] });
    const file = path.join(root, 'aozora-000001-000001', LITERATURE_FILES.chapters);
    const bytes = readFileSync(file, 'utf8');
    expect(JSON.parse(bytes).chapters.map((chapter) => chapter.title)).toEqual(['一', '二']);
    expect((await buildLiterature({ root })).works[0].status).toBe('unchanged');
    expect(readFileSync(file, 'utf8')).toBe(bytes);
    expect(await buildLiterature({ root, check: true })).toEqual({ works: [{ key: 'aozora-000001-000001', chapters: 2, status: 'checked' }], errors: [] });
  });

  it('--check는 쓰지 않는다 — 없거나 손댄 chapters.json은 실패', async () => {
    const root = workspace([sample()]);
    const missing = await buildLiterature({ root, check: true });
    expect(missing.errors).toEqual([expect.stringContaining('chapters.json가 원문과 다르다')]);
    await buildLiterature({ root });
    const file = path.join(root, 'aozora-000001-000001', LITERATURE_FILES.chapters);
    writeFileSync(file, readFileSync(file, 'utf8').replace('かわも', 'かわづら'));
    expect((await buildLiterature({ root, check: true })).errors).toEqual([expect.stringContaining('원문과 다르다')]);
  });
});

describe('build-literature — 게시 목록·뷰어 대조표(AOZORA-P0-2)', () => {
  it('작품 폴더에서 index.generated.js(서버 게시용) · manifest.generated.json(뷰어 대조용) · 표시용 표 둘(화면 표지·제목 · 장 첫 문장)을 만든다', async () => {
    const root = workspace([sample()]);
    await buildLiterature({ root });
    expect(readFileSync(path.join(root, LITERATURE_OUTPUTS.index), 'utf8'))
      .toContain("import book0 from './aozora-000001-000001/chapters.json';");
    const manifest = JSON.parse(readFileSync(path.join(root, LITERATURE_OUTPUTS.manifest), 'utf8'));
    const chapters = JSON.parse(readFileSync(path.join(root, 'aozora-000001-000001', LITERATURE_FILES.chapters), 'utf8')).chapters;
    expect(manifest.works['aozora-000001-000001'].chapters).toEqual(chapters.map((chapter) => ({ order: chapter.order, title: chapter.title,
      incipit: literatureIncipit(chapter.rawText), sha256: sha256(chapter.rawText) })));
    // 표지·목차 표기(AOZORA-P0-5) — entry.json display + 나눈 방식
    expect(manifest.works['aozora-000001-000001']).toMatchObject({ division: 'heading', display: sampleEntry().display });
    expect(manifest.works['aozora-000001-000001'].literature).not.toHaveProperty('rubyLocks');
    // 표시용 표(LIT-DISPLAY-001) — 전체 표에서 파생: 장은 순서·이름만, 크레딧은 발표 연도만, 장 첫 문장은 따로
    const display = JSON.parse(readFileSync(path.join(root, LITERATURE_OUTPUTS.display), 'utf8'));
    const work = manifest.works['aozora-000001-000001'];
    expect(display.works['aozora-000001-000001']).toEqual({ title: work.title, author: work.author, level: work.level, total: work.total,
      division: work.division, chars: work.chars, display: work.display, literature: { publishedYear: work.literature.publishedYear },
      chapters: work.chapters.map((chapter) => ({ order: chapter.order, title: chapter.title })) });
    const incipits = JSON.parse(readFileSync(path.join(root, LITERATURE_OUTPUTS.incipits), 'utf8'));
    expect(incipits.works['aozora-000001-000001']).toEqual(Object.fromEntries(work.chapters.map((chapter) => [String(chapter.order), chapter.incipit])));
  });

  it('--check: 손댄 대조표·목록은 실패', async () => {
    const root = workspace([sample()]);
    await buildLiterature({ root });
    const file = path.join(root, LITERATURE_OUTPUTS.manifest);
    writeFileSync(file, readFileSync(file, 'utf8').replace('見本入力者', '偽者'));
    expect((await buildLiterature({ root, check: true })).errors).toEqual([expect.stringContaining(`${LITERATURE_OUTPUTS.manifest}가 작품 폴더와 다르다`)]);
  });

  it.each(['display', 'incipits'])('--check: 손댄 표시용 표(%s)도 실패 — 화면이 읽는 표가 전체 표와 갈라지지 않게', async (output) => {
    const root = workspace([sample()]);
    await buildLiterature({ root });
    const file = path.join(root, LITERATURE_OUTPUTS[output]);
    const table = JSON.parse(readFileSync(file, 'utf8'));
    table.works['aozora-000001-000001'] = { ...table.works['aozora-000001-000001'], forged: true }; // 전체 표에 없는 값을 끼워 넣는다
    writeFileSync(file, `${JSON.stringify(table, null, 2)}\n`);
    expect((await buildLiterature({ root, check: true })).errors).toEqual([expect.stringContaining(`${LITERATURE_OUTPUTS[output]}가 작품 폴더와 다르다`)]);
  });

  it('한 편이라도 실패하면 목록·대조표를 다시 쓰지 않는다(깨진 작품이 빠진 채 목록이 줄지 않게)', async () => {
    const root = workspace([sample()]);
    await buildLiterature({ root });
    const before = readFileSync(path.join(root, LITERATURE_OUTPUTS.index), 'utf8');
    writeFileSync(path.join(root, 'aozora-000001-000001', LITERATURE_FILES.source), source.replace('霧', '雲'));
    expect((await buildLiterature({ root })).errors).toEqual([expect.stringContaining('SHA-256')]);
    expect(readFileSync(path.join(root, LITERATURE_OUTPUTS.index), 'utf8')).toBe(before);
  });
});

describe('build-literature — 단어 경계 미리 묶기(AOZORA-P1-10)', () => {
  /** 빌드한 장들에서 장마다 첫 두 글자를 묶는 boundaries.json(경계 생성기 대신 — 형식·대조만 본다). */
  async function withBoundaries(root, edit = (boundaries) => boundaries) {
    await buildLiterature({ root });
    const dir = path.join(root, 'aozora-000001-000001');
    const { chapters } = JSON.parse(readFileSync(path.join(dir, LITERATURE_FILES.chapters), 'utf8'));
    const boundaries = {
      schemaVersion: LITERATURE_BOUNDARY_VERSION,
      tokenizer: 'fake',
      chapters: chapters.map((chapter) => {
        const line = chapter.rawText.split('\n').findIndex((item) => item.replace(/\s+/gu, '').length >= 2);
        const text = chapter.rawText.split('\n')[line].replace(/\s+/gu, '').slice(0, 2);
        return { order: chapter.order, textSha256: sha256(chapter.rawText), edits: [{ line, start: 0, end: 2, text, reason: 'katakana' }] };
      }),
    };
    writeFileSync(path.join(dir, LITERATURE_BOUNDARY_FILE), `${JSON.stringify(edit(boundaries), null, 2)}\n`);
    return dir;
  }

  it('boundaries.json이 있으면 장 metadata.viewerBoundaries로 싣고(분석 요청에 실린다), --check 통과', async () => {
    const root = workspace([sample()]);
    const dir = await withBoundaries(root);
    expect((await buildLiterature({ root })).works[0].status).toBe('written');
    const { chapters, diagnostics } = JSON.parse(readFileSync(path.join(dir, LITERATURE_FILES.chapters), 'utf8'));
    expect(chapters.map((chapter) => chapter.metadata.viewerBoundaries.edits.map((edit) => [edit.id, edit.status, edit.cuts])))
      .toEqual([[['aozora_1_0', 'pending', []]], [['aozora_2_0', 'pending', []]]]);
    expect(diagnostics.boundaryMergeCount).toBe(2);
    expect((await buildLiterature({ root, check: true })).errors).toEqual([]);
  });

  it('원문과 어긋난 boundaries.json(낡은 해시)은 실패 — 엉뚱한 자리를 묶지 않는다', async () => {
    const root = workspace([sample()]);
    await withBoundaries(root, (boundaries) => ({ ...boundaries, chapters: boundaries.chapters.map((chapter) => ({ ...chapter, textSha256: '0'.repeat(64) })) }));
    expect((await buildLiterature({ root })).errors.join('\n')).toContain('boundaries.mjs로 다시 만든다');
  });
});

describe('build-literature — fail-closed', () => {
  it.each([
    ['권리 미승인', sample({ rights: { status: 'reviewing', basis: 'unknown' } }), 'not publishable'],
    ['관할 누락', sample({ rights: { ...sampleEntry().rights, reviewedJurisdictions: ['JP', 'US'] } }), 'JP·KR'],
    ['원문 수정(해시 불일치)', { ...sample(), source: source.replace('霧', '雲') }, 'SHA-256'],
    ['폴더 이름 ≠ 작품 키', { ...sample(), dir: 'aozora-000001-000009' }, '작품 키'],
    ['entry.json 없음', { ...sample(), entry: null }, 'entry.json'],
    ['표지 표기 없음', sample({ display: undefined }), 'display is required'],
    ['팔레트 밖 표지 색', sample({ display: { ...sampleEntry().display, cover: '#ff0000' } }), 'display.cover'],
    ['없는 표지 문양', sample({ display: { ...sampleEntry().display, motif: 'original-cover-scan' } }), 'display.motif'],
    ['표지 제목이 작품명과 다름', sample({ display: { ...sampleEntry().display, coverTitle: '書式見本\n朝の海' } }), 'coverTitle'],
    ['표지 한 줄이 너무 김', sample({ display: { ...sampleEntry().display, coverTitle: undefined } }), 'cover title lines'],
    ['미해결 외자', (() => {
      const text = source.replace('水の音', '※［＃「魚＋花」］の音'); // 면-구-점·U+ 없는 외자 — JIS X 0213 표로도 못 푼다
      return { ...sample({ textSha256: sha256(text) }), source: text };
    })(), 'unresolved gaiji'],
  ])('%s → 실패하고 chapters.json을 쓰지 않는다', async (_, work, message) => {
    const root = workspace([work]);
    const result = await buildLiterature({ root });
    expect(result.errors.join('\n')).toContain(message);
    expect(result.works).toEqual([]);
  });

  it('문단 한가운데를 가르는 장 경계는 실패(문장이 두 장으로 찢긴다)', async () => {
    // 문장 끝(。)이 없는 장문 — 문장 끝 분할로도 장 상한 안에 들 수 없다
    const long = `${'長い一文が続いていく、'.repeat(700)}`;
    const text = source.replace('　向こう岸に着いたとき、霧はすっかり晴れていた。', `　${long}`);
    const root = workspace([{ ...sample({ textSha256: sha256(text) }), source: text }]);
    const result = await buildLiterature({ root });
    expect(result.errors.join('\n')).toContain('장 경계가 문단');
  });

  it('두 폴더가 같은 원 zip을 가리키면 카탈로그 중복으로 실패', async () => {
    const other = { dir: 'aozora-000002-000002', source, entry: sampleEntry({
      personId: '000002', workId: '2', cardUrl: 'https://www.aozora.gr.jp/cards/000002/card2.html',
      sourceFileUrl: 'https://www.aozora.gr.jp/cards/000002/files/2_ruby_2.zip', textSha256: sha256(source),
    }) };
    const result = await buildLiterature({ root: workspace([sample(), other]) });
    expect(result.errors).toContain('catalog: Aozora catalog contains duplicate source files');
  });
});
