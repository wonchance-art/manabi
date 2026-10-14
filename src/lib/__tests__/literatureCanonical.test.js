import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  CANONICAL_LITERATURE_EDIT_BLOCKED,
  canonicalLiteratureChapter,
  isCanonicalLiteratureMaterial,
  literatureDisplayTitle,
  verifiedCanonicalLiterature,
} from '../literatureCanonical.js';
import { runPreservedReanalysis } from '../reanalysisPreservation';
import { literatureAttributionParts } from '../videoAttribution.js';
import { LITERATURE_BOOKS } from '../../content/literature/aozora/index.generated.js';
import manifest from '../../content/literature/aozora/manifest.generated.json';
import { sliceBetween } from './helpers/sliceBetween';

// 정본 문학책 대조(AOZORA-P0-2) — ① 출처 줄은 정본 대조표 크레딧을 원문 해시가 맞을 때만 ② 정본 원문 수정 차단.
// 실물 「鼻」 1장을 게시 행 모양({raw_text, processed_json.metadata})으로 만들어 확인한다.

const book = LITERATURE_BOOKS.find((item) => item.book.key === 'aozora-000879-000042');
const row = (chapter = book.chapters[0], overrides = {}) => ({
  id: 1,
  raw_text: chapter.rawText,
  processed_json: { sequence: [], dictionary: {}, status: 'pending', metadata: chapter.metadata },
  ...overrides,
});

describe('정본 대조표(manifest.generated.json)', () => {
  it('책 목록의 장 원문과 해시가 같고, 원문·잠금은 싣지 않는다(뷰어 번들용)', () => {
    expect(Object.keys(manifest.works)).toEqual(LITERATURE_BOOKS.map((item) => item.book.key));
    for (const item of LITERATURE_BOOKS) {
      const work = manifest.works[item.book.key];
      expect(work.chapters.map((chapter) => chapter.sha256))
        .toEqual(item.chapters.map((chapter) => createHash('sha256').update(chapter.rawText, 'utf8').digest('hex')));
      expect(work.literature.provider).toBe('aozora');
      expect(work.literature).not.toHaveProperty('rubyLocks');
      // 장 첫 문장(incipit, 목차 줄 — AOZORA-P0-5)만 싣고 그 뒤 본문은 싣지 않는다
      for (const chapter of item.chapters) expect(JSON.stringify(work)).not.toContain(chapter.rawText.slice(40, 80));
    }
  });

  it('작품 키·장 순서로 찾는다 — 없는 작품·장·아오조라가 아닌 자료는 null', () => {
    const { metadata } = book.chapters[1];
    expect(canonicalLiteratureChapter(metadata)).toMatchObject({ work: { title: '鼻' }, chapter: { order: 2 } });
    expect(canonicalLiteratureChapter({ ...metadata, book: { ...metadata.book, order: 9 } })).toBe(null);
    expect(canonicalLiteratureChapter({ ...metadata, book: { ...metadata.book, key: 'aozora-000001-000001' } })).toBe(null);
    expect(canonicalLiteratureChapter({ book: metadata.book })).toBe(null);
    expect(canonicalLiteratureChapter({ ...metadata, book: { ...metadata.book, key: '__proto__' } })).toBe(null);
  });
});

// 서재에 예전 표기(「鼻 — 1편」)로 옮겨 둔 사본도 다시 받지 않고 정본 표기로 보인다(AOZORA-P0-5 후속, 오너 2026-10-14 KST).
// 저장된 제목을 그대로 그리던 홈 두 자리(이어 읽기 타일 · 다시 읽기 카드)가 같은 함수를 쓴다.
describe('literatureDisplayTitle — 저장된 제목 대신 정본 장 제목', () => {
  const byKey = (key) => LITERATURE_BOOKS.find((item) => item.book.key === key);
  it('나눈 장 · 작가 見出し · 한 장 작품 — 저장된 예전 제목을 표기로 바꾼다', () => {
    expect(literatureDisplayTitle(book.chapters[0].metadata, '鼻 — 1편')).toBe('鼻 (1/2)');
    expect(literatureDisplayTitle(byKey('aozora-000121-000628').chapters[1].metadata, 'ごん狐 — 2편')).toBe('ごん狐 — 二');
    expect(literatureDisplayTitle(byKey('aozora-000121-000637').chapters[0].metadata, '手袋を買いに — 1편')).toBe('手袋を買いに');
  });

  it('정본이 아니면(아오조라 표식 없음 · 표에 없는 장 · metadata 없음) 저장된 제목 그대로', () => {
    const { metadata } = book.chapters[0];
    expect(literatureDisplayTitle({ book: metadata.book }, '내 자료')).toBe('내 자료');
    expect(literatureDisplayTitle({ ...metadata, book: { ...metadata.book, order: 9 } }, '鼻 — 9편')).toBe('鼻 — 9편');
    expect(literatureDisplayTitle(undefined, '그냥 글')).toBe('그냥 글');
    expect(literatureDisplayTitle(null, undefined)).toBe(undefined);
  });

  it('홈 두 자리가 책 위치와 아오조라 표식만 더 받아 이 함수로 제목을 그린다', () => {
    const read = (rel) => readFileSync(path.join(process.cwd(), rel), 'utf8');
    const metaColumns = 'book:processed_json->metadata->book, provider:processed_json->metadata->literature->>provider)';
    const usage = 'literatureDisplayTitle({ book: m';
    const home = read('src/views/HomePage.jsx');
    expect(home).toContain(metaColumns);
    expect(home).toContain(`${usage}.book, literature: { provider: m.provider } }, m.title)`);
    const reread = read('src/lib/useRereadCandidate.js');
    expect(reread).toContain(metaColumns);
    expect(reread).toContain('literatureDisplayTitle({ book: material?.book, literature: { provider: material?.provider } }, material?.title)');
  });
});

describe('verifiedCanonicalLiterature — 가짜 크레딧 차단', () => {
  it('원문이 정본 장과 같으면 대조표의 크레딧 → 출처 줄', async () => {
    const literature = await verifiedCanonicalLiterature(row());
    expect(literatureAttributionParts(literature)).toEqual({
      provider: '青空文庫',
      sourceBook: '「芥川龍之介全集1」ちくま文庫、筑摩書房',
      inputter: '平山誠、野口英司',
      proofreader: 'もりみつじゅんじ',
      cardUrl: 'https://www.aozora.gr.jp/cards/000879/card42.html',
      publicDomain: true,
      editNote: true,
      smallKanaNote: false,
    });
  });

  it('자료 metadata의 크레딧은 쓰지 않는다 — 꾸민 입력·교정·권리는 무시하고 대조표 값을 그린다', async () => {
    const chapter = book.chapters[0];
    const forged = { ...chapter.metadata.literature, colophon: { sourceBook: ['偽の本'], inputter: '偽者' }, cardUrl: 'https://www.aozora.gr.jp/cards/000001/card1.html' };
    const literature = await verifiedCanonicalLiterature(row(chapter, { processed_json: { metadata: { ...chapter.metadata, literature: forged } } }));
    expect(literatureAttributionParts(literature)).toMatchObject({ inputter: '平山誠、野口英司', cardUrl: 'https://www.aozora.gr.jp/cards/000879/card42.html' });
  });

  it.each([
    ['원문 한 글자 수정', (chapter) => row(chapter, { raw_text: chapter.rawText.replace('鼻', '耳') })],
    ['다른 장 원문', (chapter) => row(chapter, { raw_text: book.chapters[1].rawText })],
    ['원문 없음', (chapter) => row(chapter, { raw_text: null })],
    ['아오조라 표식 없음', (chapter) => row(chapter, { processed_json: { metadata: { ...chapter.metadata, literature: undefined } } })],
  ])('%s → null(출처 줄 없음)', async (_, make) => {
    expect(await verifiedCanonicalLiterature(make(book.chapters[0]))).toBe(null);
  });
});

describe('정본 원문 수정 차단', () => {
  it('metadata.literature.provider가 aozora인 자료가 정본 책', () => {
    expect(isCanonicalLiteratureMaterial(row())).toBe(true);
    expect(isCanonicalLiteratureMaterial({ processed_json: { metadata: { book: book.chapters[0].metadata.book } } })).toBe(false);
    expect(isCanonicalLiteratureMaterial(null)).toBe(false);
  });

  it('runPreservedReanalysis(뷰어 원문 수정·책 정제 공용 경로)가 바뀐 원문을 거부한다 — 저장 호출 전에', async () => {
    const material = row();
    const signal = new AbortController().signal;
    const analyze = async () => { throw new Error('분석까지 가면 안 된다'); };
    await expect(runPreservedReanalysis(null, material, signal, analyze, { rawTextOverride: `${material.raw_text}\n\n追記` }))
      .rejects.toThrow(CANONICAL_LITERATURE_EDIT_BLOCKED);
  });

  it('뷰어: 「원문 수정」 항목 대신 이유를 보이고, 저장 처리도 막는다', () => {
    const viewer = readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    const manage = sliceBetween(viewer, 'className="reader-manage"', "reanalyzePanel === 'confirm-full'");
    expect(manage).toContain('!canonicalLiteratureLocked && <button className="reanalyze-panel__item" onClick={() => { setReanalyzePanel(null); setSourceEditOpen(true); }}>');
    expect(manage).toContain('{canonicalLiteratureLocked && <p className="reader-metadata">{vt("정본 책이라 원문은 고칠 수 없어요")}');
    // 같은 줄에 다른 정본 잠금(큐레이션 책 artBookLocked, ART-P0-3)이 뒤에 붙어도 된다 — 문학 잠금 조건이 빠지면 안 된다.
    expect(viewer).toMatch(/if \(composerOf\(material\) \|\| canonicalLiteratureLocked(?: \|\| \w+Locked)*\) return;/);
  });
});
