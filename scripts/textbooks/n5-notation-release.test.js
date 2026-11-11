import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyPatch, bareKanji, deriveNotation, loadBase } from './n5-derive-notation.mjs';
import { candidate } from '../../src/lib/textbook/server.js';
import { BUNDLED_EDITIONS } from '../../src/lib/textbook/bundledEditions.js';

// N5-NOTATION-001 1단계 출시 후보(2026-11-11 KST, 오너 목업 승인) — 저장소 안 재현 계약.
//   판본 86593008 = 운영 공개 판본 8a8c + Data 표기 패치 판 5(오케스트레이터 검수 통과)를 도구로 다시 만든 것과 바이트 단위로 같다.
//   qa.passed는 새 release-verification 전까지 false — 이 상태로는 공개 화면 · 관리자 편집 목록이 바뀌지 않는다(아래 「공개 화면 불변」).
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
    expect(JSON.stringify(result.bundle)).toBe(read(`${ROOT}/${NEXT}/bundle.json`));
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

describe('공개 화면 불변 — qa.passed false인 후보는 어디에서도 열리지 않는다', () => {
  it('후보 번들은 qa.passed false · 검수 범위 문구가 남아 있다(예전 QA를 복사하지 않음)', () => {
    const bundle = JSON.parse(read(`${ROOT}/${NEXT}/bundle.json`));
    expect(bundle.qa.passed).toBe(false);
    expect(bundle.qa.scope).toMatch(/pending/);
  });
  it('로더가 거절한다(503) — ?edition= 동적 화면 · 관리자 미리보기 · 발행 API · 자산 경로 모두 candidate()를 거친다', async () => {
    await expect(candidate(NEXT)).rejects.toMatchObject({ status: 503 });
    await expect(candidate(BASE)).resolves.toMatchObject({ editionId: BASE });
  });
  it('기본 판본 · 편집 후보 목록은 그대로 — 후보를 reviewCandidates에 넣으면 관리자 편집 목록(editorCandidates)이 503이 된다', () => {
    const index = JSON.parse(read(`${ROOT}/index.json`));
    expect(index.current).toBe('7f572327dc67893e9453246c');
    expect(index.reviewCandidates).not.toContain(NEXT);
    for (const id of index.reviewCandidates) expect(JSON.parse(read(`${ROOT}/${id}/bundle.json`)).qa.passed, id).toBe(true);
  });
});
