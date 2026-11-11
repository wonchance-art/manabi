import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyPatch, bareKanji, deriveNotation, loadBase } from './n5-derive-notation.mjs';
import { candidate } from '../../src/lib/textbook/server.js';
import { BUNDLED_EDITIONS } from '../../src/lib/textbook/bundledEditions.js';

// N5-NOTATION-001 1단계 출시 후보(2026-11-11 KST, 오너 목업 승인) — 저장소 안 재현 계약.
//   판본 86593008 = 운영 공개 판본 8a8c + Data 표기 패치 판 5(오케스트레이터 검수 통과)를 도구로 다시 만든 것과 바이트 단위로 같다.
//   qa는 release-verification(docs/verification/n5-notation-release-20261111.md) 뒤에만 true다 — 좁은 scope와 함께. 공개는 DB 발행 포인터가 정한다.
const ROOT = 'src/content/textbookEditions';
const BASE = '8a8c1c1fd452773810abaf8c', NEXT = '86593008c8f915a0b71aa15e';
const PATCH = 'scripts/textbooks/n5-notation/n5-8a8c-stage1-patch.json'; // 표 · 패치 · 제외 목록은 Data 커밋(ja-n5-stage1-generate.mjs)이 둔다
const PATCH_SHA256 = 'f4b97637fa48f3e22d1465c6c15e397b9c260410983e67502c92f6e058a1bdf9';
const read = (file, enc = 'utf8') => fs.readFileSync(file, enc);
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

let base, result;
beforeAll(async () => {
  base = await loadBase(`${ROOT}/${BASE}`);
  result = deriveNotation(base, applyPatch(base.bundle.manuscript, JSON.parse(read(PATCH))));
}, 120_000);

describe('판본 86593008 = 8a8c + 표기 패치 판 5(도구로 다시 만들면 같은 판본)', () => {
  it('패치는 검수 통과한 판 5 그대로다(sha256 · 549줄)', () => {
    expect(sha256(read(PATCH, null))).toBe(PATCH_SHA256);
    expect(Object.keys(JSON.parse(read(PATCH)))).toHaveLength(549);
  });
  it('다시 만든 판본 ID와 네 파일이 저장소 폴더와 바이트 단위로 같다', () => {
    expect(result.editionId).toBe(NEXT);
    expect(result.html).toBe(read(`${ROOT}/${NEXT}/index.html`));
    expect(result.app).toBe(read(`${ROOT}/${NEXT}/app.js`));
    expect(result.css).toBe(read(`${ROOT}/${NEXT}/style.css`));
    // qa만 검증 기록으로 바뀐다(도구 출력은 false) — 그 밖의 번들은 바이트 단위로 같다
    const committed = JSON.parse(read(`${ROOT}/${NEXT}/bundle.json`));
    expect(result.bundle.qa.passed).toBe(false);
    expect(JSON.stringify({ ...result.bundle, qa: committed.qa })).toBe(read(`${ROOT}/${NEXT}/bundle.json`));
  });
  it('파생 보고 — 549 치환 · sourceIndex 183쪽 · 루비 없는 한자 1,421자 불변 · 오변환 경고 0', () => {
    expect(result.report).toMatchObject({ changes: 549, replaced: 549, changedSources: 183, bareKanji: 1421, misread: [] });
    expect(bareKanji(result.html)).toHaveLength(bareKanji(base.html).length);
  });
  it('바탕 판본 8a8c는 그대로 남는다(구판 귀환 · 저장 기록의 판본 고정)', () => {
    expect(BUNDLED_EDITIONS['japanese-n5']).toEqual(expect.arrayContaining([BASE, NEXT]));
    expect(result.bundle.artifactManifest).toMatchObject({ baseEdition: BASE, baseBundleSha256: sha256(read(`${ROOT}/${BASE}/bundle.json`, null)) });
  });
});

describe('검증 뒤 — 관리자 후보로 열리고, 공개는 DB 포인터가 정한다', () => {
  it('qa는 검증 기록을 가리키는 좁은 scope로만 true다(예전 QA를 복사하지 않음)', () => {
    const { qa } = JSON.parse(read(`${ROOT}/${NEXT}/bundle.json`));
    expect(qa.passed).toBe(true);
    expect(qa.scope).toMatch(/Not independent language\/coverage certification; live admin preview and publication pending/);
    expect(fs.existsSync(qa.verification)).toBe(true);
    expect(qa.verification).toBe('docs/verification/n5-notation-release-20261111.md');
  });
  it('로더가 연다 — 관리자 미리보기 · 발행 버튼의 전제. 바탕 8a8c도 그대로 열린다(구판 귀환)', async () => {
    await expect(candidate(NEXT)).resolves.toMatchObject({ editionId: NEXT });
    await expect(candidate(BASE)).resolves.toMatchObject({ editionId: BASE });
  });
  it('저장소 기본 판본(current)은 그대로 · 편집 후보 맨 앞에 후보 — reviewCandidates의 판본은 모두 qa.passed true(아니면 editorCandidates가 503)', () => {
    const index = JSON.parse(read(`${ROOT}/index.json`));
    expect(index.current).toBe('7f572327dc67893e9453246c');
    expect(index.reviewCandidates[0]).toBe(NEXT);
    for (const id of index.reviewCandidates) expect(JSON.parse(read(`${ROOT}/${id}/bundle.json`)).qa.passed, id).toBe(true);
  });
});
