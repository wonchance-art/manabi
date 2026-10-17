import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { sliceBetween } from '../../__tests__/helpers/sliceBetween.js';
import { readLearningAdmissionStatus } from '../learningAdmission.js';
import { readFsrsStatus } from '../fsrsLearning.js';
import { introduceFsrsCard } from '../../fsrsScheduler.js';

// 능력 RPC 중복 조사(2026-10-17 KST, 운영 pg_stat_statements: fsrs_capabilities 평균 ~570ms · learning_language_capabilities ~1s ·
// learning_admission_status ~750ms) — 캐시(신선도)는 바꾸지 않고, 한 화면 이동에서 같은 함수가 두 번 나가지 않게 · 서로 기다리지 않게.
// 계약 = ① 서버 경계 한 번 · 병렬 ② 화면 배선(마운트당 읽기 하나) ③ 호출 지점 목록(새 경로가 생기면 여기서 드러난다).
const owner = '10000000-0000-0000-0000-000000000001';
const cardId = '20000000-0000-0000-0000-000000000001';
const at = '2026-10-04T00:00:00.000Z';
const admission = { version: 1, actorId: owner, installed: true, enabled: true, active: true, fsrsEnabled: true, startsAt: '2026-10-03T19:00:00.000Z',
  now: at, learningDay: '2026-10-04', timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 1, used: 0, remaining: 15,
  fsrsUsed: 0, legacyUsed: 0, admittedLegacyCardIds: [] };
const state = { cardId, userId: owner, card: introduceFsrsCard('2026-10-03T23:59:00.000Z'), attempt: null, enrolled: true, excluded: false, eligible: true, firstQuestionAt: null };
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const flush = () => new Promise((r) => setTimeout(r, 0));
const names = (client) => client.rpc.mock.calls.map(([name]) => name);
function clients({ capability = { data: { version: 1, enabled: true, policyVersion: 'anki-seconds-v1' } } } = {}) {
  const gate = deferred();
  const authClient = { rpc: vi.fn(async () => { await gate.promise; if (capability instanceof Error) throw capability; return capability; }) };
  const serviceClient = { rpc: vi.fn(async (name) => ({ data: name === 'learning_admission_status' ? { ...admission } : [state] })) };
  return { authClient, serviceClient, gate };
}

describe('① 서버 경계 — 능력은 한 번, 다른 읽기는 기다리지 않는다', () => {
  it('입장 상태(GET /api/learning/admission): fsrs_capabilities 1 · learning_admission_status 1, 상태 요청이 능력 응답 전에 나가 있다', async () => {
    const { authClient, serviceClient, gate } = clients();
    const pending = readLearningAdmissionStatus({ authClient, serviceClient, userId: owner, now: at });
    await flush();
    expect(names(serviceClient)).toEqual(['learning_admission_status']); // 능력 응답을 기다리지 않았다
    gate.resolve();
    expect(await pending).toMatchObject({ installed: true, fsrsEnabled: true });
    expect(names(authClient)).toEqual(['fsrs_capabilities']);
  });
  it('둘 다 실패하면 능력 오류가 먼저다(순차일 때와 같은 우선순위)', async () => {
    const { authClient, serviceClient, gate } = clients({ capability: new TypeError('fetch failed') });
    serviceClient.rpc.mockImplementation(async () => ({ error: { code: '57014', message: 'timeout' } }));
    const pending = readLearningAdmissionStatus({ authClient, serviceClient, userId: owner, now: at }).catch((e) => e);
    gate.resolve();
    expect(await pending).toMatchObject({ detail: 'fsrs_capabilities threw: TypeError fetch failed' });
  });
  it('FSRS 상태(GET /api/learning/fsrs): 능력 · 목록 · 입장 상태가 함께 나가고, 입장 상태의 능력 대조는 같은 읽기를 나눠 받는다(능력 1번)', async () => {
    const { authClient, serviceClient, gate } = clients();
    const pending = readFsrsStatus({ authClient, serviceClient, userId: owner, now: at });
    await flush();
    expect(names(serviceClient).sort()).toEqual(['fsrs_list_states', 'learning_admission_status']); // 능력을 기다리지 않았다
    gate.resolve();
    const status = await pending;
    expect(status).toMatchObject({ enabled: true, admission: { installed: true }, cards: [{ cardId }] });
    expect(names(authClient)).toEqual(['fsrs_capabilities']);
    expect(names(serviceClient).filter((n) => n === 'learning_admission_status')).toHaveLength(1);
  });
  it('능력과 입장 상태의 FSRS 켜짐이 다르면 그대로 막는다(대조는 남는다)', async () => {
    const { authClient, serviceClient, gate } = clients({ capability: { data: { version: 1, enabled: false, policyVersion: 'anki-seconds-v1' } } });
    const pending = readFsrsStatus({ authClient, serviceClient, userId: owner, now: at }).catch((e) => e);
    gate.resolve();
    expect(String((await pending)?.detail || '')).toContain('fsrsEnabled=true/false');
  });
});

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const walk = (dir) => fs.readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  if (fs.statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(full);
  return /\.(m?js|jsx)$/u.test(name) && !/\.test\./u.test(name) ? [full] : [];
});
const files = walk(path.join(ROOT, 'src')).map((file) => [path.relative(ROOT, file), fs.readFileSync(file, 'utf8')]);
const users = (pattern) => files.filter(([, src]) => pattern.test(src)).map(([rel]) => rel).sort();

describe('② 화면 배선 — 한 화면 이동에 같은 읽기는 하나', () => {
  it('단어장(/vocab): 첫 입장 한도에는 FSRS 목록을 다시 읽지 않는다(마운트 읽기가 이미 같은 상태) — 바뀐 한도 · 첫 읽기 실패만', () => {
    const page = read('src/views/VocabPage.jsx');
    const onQuota = sliceBetween(page, 'const admission = useLearningAdmission({ accountId: user?.id, onQuota: quota => {', '} });');
    expect(onQuota).toMatch(/if \(quotaOwner\.current !== quota\.actorId\) \{\s*quotaOwner\.current = quota\.actorId; quotaSignature\.current = signature;\s*if \(fsrsControllerRef\.current\?\.getSnapshot\?\.\(\)\.status === 'error'\) fsrsControllerRef\.current\.refresh\(\);\s*return;\s*\}/u);
    expect(onQuota).toMatch(/if \(signature !== quotaSignature\.current\) \{\s*quotaSignature\.current = signature;\s*fsrsControllerRef\.current\?\.refresh\(\);/u);
  });
  it('입장 한도 · FSRS 목록 훅은 화면마다 한 번만 만든다(배움 1 · 단어장 1 / 단어장 1)', () => {
    expect(users(/(?<!function )\buseLearningAdmission\(\{/u)).toEqual(['src/views/HomePage.jsx', 'src/views/VocabPage.jsx']);
    for (const rel of ['src/views/HomePage.jsx', 'src/views/VocabPage.jsx']) expect(read(rel).match(/\buseLearningAdmission\(\{/gu), rel).toHaveLength(1);
    expect(users(/(?<!function )\buseFsrsReview\(\{/u)).toEqual(['src/views/VocabPage.jsx']);
    expect(read('src/views/VocabPage.jsx').match(/\buseFsrsReview\(\{/gu)).toHaveLength(1);
  });
  it('한국어 능력(learning_language_capabilities)은 계정당 한 쿼리 키 — 같은 화면의 여러 칸이 한 요청을 나눠 받는다', () => {
    const hook = read('src/lib/useLearningCapabilities.js');
    expect(hook).toContain("queryKey: ['learning-capabilities', user?.id],");
    expect(users(/\/api\/learning\/capabilities/u)).toEqual(['src/lib/useLearningCapabilities.js']);
  });
});

describe('③ 호출 지점 목록 — 무거운 능력 RPC를 부르는 곳(새로 생기면 여기서 드러난다)', () => {
  it("rpc('fsrs_capabilities') · rpc('learning_language_capabilities')", () => {
    expect(users(/['"]fsrs_capabilities['"]\s*\)/u)).toEqual(['src/lib/server/fsrsLearning.js', 'src/lib/server/fsrsVocabulary.js', 'src/lib/server/learningAdmission.js']);
    expect(users(/rpc\(\s*['"]learning_language_capabilities['"]/u)).toEqual(['src/lib/reviewOutbox.js', 'src/lib/server/learningCapabilities.js']);
  });
});
