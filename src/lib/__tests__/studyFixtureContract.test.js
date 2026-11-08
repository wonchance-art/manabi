import { describe, expect, it } from 'vitest';
import { createHeavyBackend, HEAVY_SERVICE_KEY, HEAVY_UID } from '../../../e2e/fixtures/heavy-account.mjs';
import { readVocabularyLearningSnapshotLight } from '../server/fsrsVocabulary';

// STUDY-FIXTURE-001 — /study e2e(e2e/study-session.e2e.mjs)가 기대는 합성 백엔드(heavy-account)의 응답이 운영 앱의 읽기 검사를 통과하는지.
// /study 서버 조립(assembleStudyMaterials)은 서비스 클라이언트로 fsrs_vocabulary_snapshot_light를 읽고 readVocabularyLearningSnapshotLight가
// 모양을 검사한다 — 앱의 검사가 바뀌었는데 고정물이 옛 모양이면 e2e는 「학습 기록에 연결하지 못했어요」로 엉뚱하게 깨진다. 여기서 먼저 깨지게 한다.
function serviceClientOver(backend) {
  return {
    async rpc(name, params) {
      const response = await backend.handle({ method: 'POST', url: new URL(`https://e2e.supabase.co/rest/v1/rpc/${name}`),
        headers: new Headers({ authorization: `Bearer ${HEAVY_SERVICE_KEY}`, apikey: HEAVY_SERVICE_KEY }), body: params, origin: 'server' });
      const body = response.payload ? JSON.parse(response.payload) : null;
      return response.status === 200 ? { data: body, error: null } : { data: null, error: body };
    },
  };
}

describe('/study 합성 백엔드 — 학습 snapshot 응답 모양(STUDY-FIXTURE-001)', () => {
  it('fsrs_vocabulary_snapshot_light 응답이 앱 검사를 통과하고, 요청 언어 행만 · 계정 그대로 돌아온다', async () => {
    const serviceClient = serviceClientOver(createHeavyBackend());
    const snapshot = await readVocabularyLearningSnapshotLight({ serviceClient, userId: HEAVY_UID, language: 'Japanese', summary: false });
    expect(snapshot.actorId).toBe(HEAVY_UID);
    expect(snapshot.complete).toBe(true);
    expect(snapshot.rows.length).toBeGreaterThan(100); // 세션에 낼 일본어 카드가 있다(공허 통과 방지)
    expect(new Set(snapshot.rows.map((row) => row.language))).toEqual(new Set(['Japanese']));
  });

  it('잘못된 요청(summary가 불리언이 아님)은 앱보다 먼저 막힌다 — 고정물이 아무 값이나 받아 주지 않는다', async () => {
    const serviceClient = serviceClientOver(createHeavyBackend());
    await expect(readVocabularyLearningSnapshotLight({ serviceClient, userId: HEAVY_UID, language: 'Japanese', summary: 'no' })).rejects.toBeTruthy();
  });
});
