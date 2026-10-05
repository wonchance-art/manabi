/** 실제 인증 사용자와 DB clock만 공통 첫 문제 입장권을 만들 수 있다. */
import { UUID } from '../learningSources.js';
import { FSRS_POLICY, learningDay, schedulerTime } from '../fsrsScheduler.js';
import { normalizeAdmissionRequest, normalizeAdmissionStatus, validateAdmissionReceipt } from '../learningAdmission.js';
import { validateVocabularyLearningSnapshot } from './fsrsVocabulary.js';

const reject = (code = 'fsrs_admission_unavailable', status = 503) => { throw Object.assign(new Error(code), { code, status }); };
const authenticated = userId => { if (!UUID.test(userId || '')) reject('fsrs_auth_required', 401); };
function databaseError(error) {
  if (!error) return;
  const message = String(error.message || '');
  for (const [pattern, code, status] of [
    [/policy_revision|policy_conflict/, 'fsrs_admission_policy_conflict', 409],
    [/replay_mismatch|operation_conflict|request_conflict/, 'fsrs_admission_conflict', 409],
    [/budget|daily_new_limit/, 'fsrs_new_budget_exhausted', 409],
    [/excluded|known_word/, 'fsrs_card_excluded', 409],
    [/not_due/, 'fsrs_card_not_due', 409],
    [/enrolled/, 'fsrs_already_enrolled', 409],
    [/not_found|not_available|owner|forbidden/, 'fsrs_card_not_found', 404],
    [/pending|not_started|stopped|disabled|admission_inactive/, 'fsrs_admission_pending', 409],
    [/invalid.*request/, 'fsrs_invalid_request', 400],
  ]) if (pattern.test(message)) reject(code, status);
  reject();
}
async function call(client, name, args) {
  try { return await client.rpc(name, args); } catch { reject(); }
}
const exactMissingRpc = (error, name) => error?.code === 'PGRST202'
  && String(error.message || '').startsWith(`Could not find the function public.${name}(`);

async function capability(authClient) {
  const response = await call(authClient, 'fsrs_capabilities');
  if (response?.error || response?.data?.version !== 1 || response.data.policyVersion !== FSRS_POLICY.version
    || typeof response.data.enabled !== 'boolean') reject();
  return response.data.enabled;
}

export async function readLearningAdmissionStatus({ authClient, serviceClient, userId, knownFsrsEnabled, now = new Date() }) {
  authenticated(userId);
  const fsrsEnabled = typeof knownFsrsEnabled === 'boolean' ? knownFsrsEnabled : await capability(authClient);
  const response = await call(serviceClient, 'learning_admission_status', { p_actor: userId });
  if (response?.error) {
    // 정확한 구 설치 + 확인된 FSRS 비활성만 호환이다. 네트워크/권한/기타 함수 오류는 대체하지 않는다.
    if (!fsrsEnabled && exactMissingRpc(response.error, 'learning_admission_status')) {
      // 020 marker는 기존 core가 추적하는 fsrs_* 함수다. status만 삭제된 새 설치를 구형으로 오인하지 않는다.
      const marker = await call(serviceClient, 'fsrs_learning_admission_marker', { p_actor: userId });
      if (!exactMissingRpc(marker?.error, 'fsrs_learning_admission_marker')) reject();
      // capabilities의 false에는 fingerprint 손상도 포함된다. 019의 완전한 정본 읽기로 건강한 구 계약임을 증명한다.
      let snapshot;
      const stored = await call(serviceClient, 'fsrs_vocabulary_snapshot', { p_actor: userId });
      // 기존 signature의 successor 표시는 신규 RPC schema-cache 지연에도 남는다. 정규화가 extra field를 버리기 전에 확인한다.
      if (stored?.error || !stored?.data || Object.hasOwn(stored.data, 'learningAdmissionVersion')) reject();
      try { snapshot = validateVocabularyLearningSnapshot(stored.data, userId); } catch { reject(); }
      if (snapshot.enabled !== false) reject();
      const at = new Date(schedulerTime(now)).toISOString();
      return normalizeAdmissionStatus({ version: 1, actorId: userId, installed: false, enabled: false,
        active: false, fsrsEnabled: false, startsAt: null, now: at,
        learningDay: new Date(learningDay(at) * 86400000).toISOString().slice(0, 10),
        timeZone: 'Asia/Seoul', rolloverHour: 4, limit: null, policyRevision: null,
        used: null, remaining: null, fsrsUsed: null, legacyUsed: null, admittedLegacyCardIds: null }, { actorId: userId });
    }
    reject();
  }
  const status = normalizeAdmissionStatus(response?.data, { actorId: userId });
  if (!status.installed || status.fsrsEnabled !== fsrsEnabled) reject();
  return status;
}

export async function applyLearningAdmissionRequest({ authClient, serviceClient, userId, body }) {
  authenticated(userId);
  const request = normalizeAdmissionRequest(body, userId);
  // 비활성 호환은 UI가 구 경로를 명시적으로 선택하는 경우뿐이다. 새 POST 자체는 성공을 꾸미지 않는다.
  const status = await readLearningAdmissionStatus({ authClient, serviceClient, userId });
  if (!status.installed) reject('fsrs_admission_pending', 409);
  const response = await call(serviceClient, request.action === 'configure' ? 'learning_configure_admission' : 'learning_admit_legacy',
    { p_actor: userId, p_request: request });
  databaseError(response?.error);
  return validateAdmissionReceipt(response?.data, { request });
}
