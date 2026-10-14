import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLearningAdmissionController } from '../useLearningAdmission';
import { createFsrsReviewController } from '../useFsrsReview';

/**
 * 계약: 복습 준비 · 일정 오류를 화면에 띄울 때 콘솔에 코드 · 상태만 남긴다(REVIEW-LOAD-TRANSIENT-001).
 * M09 #1337 6166527435 — 서버 로그는 fsrs · admission 모두 200인데 「복습을 준비하지 못했어요」·
 * 「복습 일정을 불러오지 못했어요」가 떴고, 클라이언트 단계(시간 초과 · 응답 검증 · 저장소)를 가를 근거가 없었다.
 * 원문 메시지는 싣지 않는다(오류 원문 비노출 계약과 같은 방향).
 */

const actor = '10000000-0000-0000-0000-000000000001';
const failure = Object.assign(new Error('private detail'), { code: 'fsrs_invalid_response', status: 200 });
let warn;
afterEach(() => warn?.mockRestore());

describe('복습 준비 실패 — 콘솔에 코드 · 상태', () => {
  it('admission 읽기 실패: [learning] admission load 실패 <code> <status>, 원문 없음', async () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const value = createLearningAdmissionController({ accountId: actor, eventTarget: null, visibilityTarget: null,
      client: { load: async () => { throw failure; }, pending: async () => [] } });
    expect(await value.refresh()).toBe(false);
    expect(value.getSnapshot().status).toBe('error');
    expect(warn).toHaveBeenCalledWith('[learning] admission load 실패', 'fsrs_invalid_response', 200);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private detail');
    value.dispose();
  });

  it('FSRS 일정 읽기 실패: [learning] fsrs load 실패 — 폐기된 컨트롤러는 남기지 않는다', async () => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const value = createFsrsReviewController({ accountId: actor, eventTarget: null, visibilityTarget: null,
      client: { load: async () => { throw Object.assign(new TypeError('Failed to fetch')); }, pending: async () => [] } });
    expect(await value.refresh()).toBe(false);
    expect(value.getSnapshot().status).toBe('error');
    expect(warn).toHaveBeenCalledWith('[learning] fsrs load 실패', 'TypeError', '');
    warn.mockClear();
    const late = createFsrsReviewController({ accountId: actor, eventTarget: null, visibilityTarget: null,
      client: { load: async () => { late.dispose(); throw failure; }, pending: async () => [] } });
    await late.refresh();
    expect(warn).not.toHaveBeenCalled();
    value.dispose();
  });
});
