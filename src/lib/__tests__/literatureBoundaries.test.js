import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { LITERATURE_ROOT } from '../../../scripts/lib/literature-build.mjs';
import {
  LITERATURE_BOUNDARY_FILE, literatureBoundaryMerges, serializeBoundaries, withBoundaryMerges,
} from '../../../scripts/lib/literature-boundaries.mjs';
import { applyRequestBoundaries } from '../server/analyzeBoundaries.js';

// 정본 문학책 단어 경계 미리 묶기(AOZORA-P1-10) — 저자 루비 낱말·같은 낱말의 다른 자리·쪼개진 카타카나를 「한 단어로 묶기」
// 기록으로 미리 싣는다. 토크나이저는 가짜(「|」로 나눈 줄)라 분석기 사전과 무관하게 규칙만 고정한다.

const LIMITS = { maxTokens: 8, maxChars: 12, maxEdits: 200 };
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/** 「|」로 토큰을 나눈 줄들 → 장 하나 + 그 줄을 그대로 나누는 가짜 토크나이저. locks: [[루비 기준, 몇 번째 등장(0부터)]] */
function fixture(segmentedLines, locks = [], order = 1) {
  const rawText = segmentedLines.map((line) => line.replaceAll('|', '')).join('\n');
  const rubyLocks = locks.map(([base, nth = 0]) => {
    let start = -1;
    for (let k = 0; k <= nth; k += 1) start = rawText.indexOf(base, start + 1);
    return { start, end: start + base.length, base, reading: 'よみ' };
  });
  const table = new Map(segmentedLines.map((line) => [line.replaceAll('|', ''), line.split('|')]));
  const chapter = { order, rawText, metadata: { literature: { rubyLocks } } };
  const tokenize = async (line) => (table.get(line) || [line]).map((text) => ({ text }));
  return { chapter, tokenize };
}

describe('literatureBoundaryMerges — 무엇을 묶나', () => {
  it('저자 루비 낱말이 쪼개진 자리 → ruby, 같은 작품의 다른 자리 → ruby-repeat(루비가 처음에만 붙어도)', async () => {
    const one = fixture(['苦|沙弥|先生|は|書斎|に', '迷|亭|が|来|た'], [['苦沙弥'], ['書斎']]);
    const two = fixture(['苦|沙弥|は|また|苦|沙弥|だ'], [], 2);
    const merges = await literatureBoundaryMerges([one.chapter, two.chapter], (line) => one.tokenize(line).then((tokens) => (tokens.length > 1 ? tokens : two.tokenize(line))), LIMITS);
    expect(merges[0]).toEqual({ order: 1, textSha256: sha256(one.chapter.rawText), edits: [{ line: 0, start: 0, end: 3, text: '苦沙弥', reason: 'ruby' }] });
    expect(merges[1].edits).toEqual([
      { line: 0, start: 0, end: 3, text: '苦沙弥', reason: 'ruby-repeat' },
      { line: 0, start: 6, end: 9, text: '苦沙弥', reason: 'ruby-repeat' },
    ]);
  });

  it('카타카나만 맞붙은 토큰 → katakana(가운뎃점·히라가나 사이는 끊는다)', async () => {
    const { chapter, tokenize } = fixture(['ペ|テロ|は|フロック|コート|を|着|た', 'ドグラ|・|マグラ']);
    const [merge] = await literatureBoundaryMerges([chapter], tokenize, LIMITS);
    expect(merge.edits).toEqual([
      { line: 0, start: 0, end: 3, text: 'ペテロ', reason: 'katakana' },
      { line: 0, start: 4, end: 11, text: 'フロックコート', reason: 'katakana' },
    ]);
  });

  it('서버가 적용하지 못할 자리는 내지 않는다 — 토큰 안쪽 끝·한 토큰·공백 사이·묶기 상한 초과', async () => {
    const { chapter, tokenize } = fixture([
      '杜子|春|は', // 루비 「子春」은 토큰 「杜子」 안쪽에서 시작
      '檸檬|を', // 이미 한 토큰
      '李|　|徴|が', // 공백을 사이에 둔 자리 — 서버 whitespace_inside
      'ア|イ|ウ|エ|オ|カ|キ|ク|ケ', // 토큰 9개 > 8
    ], [['子春'], ['檸檬'], ['李　徴']]);
    expect((await literatureBoundaryMerges([chapter], tokenize, LIMITS))[0].edits).toEqual([]);
  });

  it('겹치면 우선순위(ruby > ruby-repeat > katakana), 장마다 기록 상한(maxEdits)', async () => {
    const { chapter, tokenize } = fixture(['ペ|テロ|ペ|テロ|ペ|テロ'], [['ペテロ', 1]]);
    expect((await literatureBoundaryMerges([chapter], tokenize, LIMITS))[0].edits.map((edit) => [edit.start, edit.reason]))
      .toEqual([[0, 'ruby-repeat'], [3, 'ruby'], [6, 'ruby-repeat']]);
    // 상한 2 — 루비 자리를 먼저 담고 남은 칸에 다른 자리(출력은 자리 순)
    expect((await literatureBoundaryMerges([chapter], tokenize, { ...LIMITS, maxEdits: 2 }))[0].edits.map((edit) => [edit.start, edit.reason]))
      .toEqual([[0, 'ruby-repeat'], [3, 'ruby']]);
  });

  it('만든 기록은 서버(applyRequestBoundaries)가 모두 적용한다 — 묶인 자리는 토큰 하나', async () => {
    const { chapter, tokenize } = fixture(['苦|沙弥|は|ペ|テロ|と', '迷|亭|　|苦|沙弥'], [['苦沙弥'], ['迷亭']]);
    const draft = withBoundaryMerges({ chapters: [chapter], diagnostics: {} }, JSON.parse(serializeBoundaries(await literatureBoundaryMerges([chapter], tokenize, LIMITS), 'fake')));
    const lines = chapter.rawText.split('\n');
    const tokenized = await Promise.all(lines.map(async (line) => ({ original: line, tokens: (await tokenize(line)).map((token) => ({ ...token, pos: '명사', furigana: '' })) })));
    const byLine = new Map();
    for (const edit of draft.chapters[0].metadata.viewerBoundaries.edits) byLine.set(edit.line, [...(byLine.get(edit.line) || []), edit]);
    const state = applyRequestBoundaries(tokenized, byLine, 'Japanese');
    const results = [...state.lines.values()].flatMap((line) => line.results);
    expect(results.map((result) => result.status)).toEqual(['applied', 'applied', 'applied', 'applied']);
    expect(state.tokenizedLines.map((line) => line.tokens.map((token) => token.text).join('|'))).toEqual(['苦沙弥|は|ペテロ|と', '迷亭|　|苦沙弥']);
  });
});

describe('withBoundaryMerges — 빌드에 싣기·낡은 기록 거부', () => {
  const build = async () => {
    const { chapter, tokenize } = fixture(['苦|沙弥|は|書斎|に'], [['苦沙弥']]);
    const boundaries = JSON.parse(serializeBoundaries(await literatureBoundaryMerges([chapter], tokenize, LIMITS), 'fake'));
    return { draft: { chapters: [chapter], diagnostics: { chapterCount: 1 } }, boundaries };
  };

  it('장 metadata.viewerBoundaries(분석 요청에 실리는 기록 v1, 모두 pending·「한 단어로」) + 진단 수', async () => {
    const { draft, boundaries } = await build();
    const out = withBoundaryMerges(draft, boundaries);
    expect(out.chapters[0].metadata.viewerBoundaries).toEqual({ version: 1, edits: [
      { id: 'aozora_1_0', line: 0, start: 0, end: 3, text: '苦沙弥', cuts: [], base: [], status: 'pending', source: 'aozora-ruby' },
    ] });
    expect(out.diagnostics).toEqual({ chapterCount: 1, boundaryMergeCount: 1 });
    expect(withBoundaryMerges(draft, null)).toBe(draft);
  });

  it('원문이 바뀌었거나(해시)·장 수가 다르거나·자리 글자가 다르거나·형식이 다르면 throw — 다시 만들라고 안내', async () => {
    const { draft, boundaries } = await build();
    const edited = { ...draft, chapters: [{ ...draft.chapters[0], rawText: `${draft.chapters[0].rawText}。` }] };
    expect(() => withBoundaryMerges(edited, boundaries)).toThrow(/boundaries\.mjs로 다시 만든다/u);
    expect(() => withBoundaryMerges(draft, { ...boundaries, chapters: [] })).toThrow(/장 수가 다르다/u);
    const moved = structuredClone(boundaries);
    moved.chapters[0].edits[0].start = 1;
    expect(() => withBoundaryMerges(draft, moved)).toThrow(/원문 자리와 다르다/u);
    expect(() => withBoundaryMerges(draft, { ...boundaries, schemaVersion: 2 })).toThrow(/형식이 아니다/u);
  });
});

describe('리포 정본 — 모든 작품에 경계 기록(작품 추가 때 boundaries.mjs를 빠뜨리지 않게)', () => {
  it('aozora-* 폴더마다 boundaries.json이 있다(원문 대조는 build-literature --check가 한다)', () => {
    const dirs = readdirSync(LITERATURE_ROOT).filter((dir) => dir.startsWith('aozora-'));
    expect(dirs.length).toBeGreaterThanOrEqual(34);
    expect(dirs.filter((dir) => !existsSync(path.join(LITERATURE_ROOT, dir, LITERATURE_BOUNDARY_FILE)))).toEqual([]);
  });
});
