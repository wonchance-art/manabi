// 단어 목록 하루 분량 알림(LEVEL-ROUND-001 ④)이 읽는 복습의 새 카드 자리 — 목록 화면은 처음 담을 때 import()로만 부른다
// (복습 한도 모듈을 첫 그림에 싣지 않는다 — levelListLazy 계약과 같은 이유). 자리 계산은 배움 칸 · 복습방과 같은 reviewScopeQuota 하나.
import { canUseLegacyAdmissionCompatibility } from './learningAdmission';
import { reviewScopeQuota } from './reviewScope';
import { createLearningAdmissionClient, createLearningAdmissionController } from './useLearningAdmission';
import { isNewPerDayValue, loadIntroIds, loadNewPerDay } from './vocabStudy';
import { admissionCardKinds, normalizeCardKinds } from './fsrsCardKinds';

const FRESH_MS = 60_000;
let cached = null;

/** 남은 새 카드 자리 — { remaining, ... } 또는 null(읽지 못함). 연달아 담아도 1분에 한 번만 묻는다. */
export function levelNewQuota(accountId, nowMs = Date.now()) {
  if (!accountId) return Promise.resolve(null);
  if (cached?.accountId === accountId && nowMs - cached.at < FRESH_MS) return cached.promise;
  const promise = createLearningAdmissionClient({ accountId }).load()
    .then((quota) => reviewScopeQuota({ quota, compatibility: canUseLegacyAdmissionCompatibility(quota) },
      { newPerDay: loadNewPerDay(), introIds: loadIntroIds() }))
    .catch(() => null);
  cached = { accountId, at: nowMs, promise };
  return promise;
}

/**
 * 단어 페이지(HSK · JLPT)의 오늘 새 단어 몫(LEVEL-SAVED-TAG-001) — { limit, used, remaining } 또는 null.
 * 첫 문제에서 몫을 쓰는 것은 서버(fsrs_new_receipts)라 서버 입장 한도가 정본이다. 기기가 센 수(newStartedToday — 오늘 생긴 행만)는
 * 전에 담고 오늘 처음 공부한 단어를 빠뜨렸다(운영 2026-10-30 KST 서버 15/15 · 화면 0). remaining은 배움 칸 · 복습방과 같은
 * reviewScopeQuota 값(새 셈을 만들지 않는다). 호환(사전 활성) 모드 · 미설치 · 못 읽음이면 null — 화면은 지금처럼 기기 셈으로.
 * 채점마다 다시 읽어야 해서 위 1분 묶음은 쓰지 않는다(화면 질의 캐시가 맡는다).
 */
export function levelNewSlots(accountId) {
  if (!accountId) return Promise.resolve(null);
  return createLearningAdmissionClient({ accountId }).load().then((quota) => {
    if (canUseLegacyAdmissionCompatibility(quota) || !Number.isInteger(quota?.used) || !Number.isInteger(quota.limit)) return null;
    // cardKinds = 켜진 카드 종류(CARD-TYPES-001 3단계 — 「카드」 줄 · 종류 카드 그리기). 칸이 없으면 단어 → 뜻 하나(「모르면 지금처럼」).
    return { limit: quota.limit, used: quota.used, remaining: reviewScopeQuota({ quota, compatibility: false }).remaining,
      cardKinds: [...admissionCardKinds(quota)] };
  }).catch(() => null);
}

/**
 * 단어 페이지 제목 시트 「하루」 줄이 하루 새 단어 수를 바꾼다(LEVEL-WAIT-001 · 오너 승인 2026-11-01 KST) — 새 설정을 만들지 않는다:
 * 단어장 복습 설정(VocabPage)과 같은 길이다. 입장 모드면 서버 입장 한도를 controller.configure(useLearningAdmission이 감싼 같은 controller)로
 * 바꾸고, 호환(사전 활성) 모드면 이 기기 설정(vocab_new_per_day — loadNewPerDay가 읽는 키)만 바꾼다. 어느 쪽이든 성공하면 기기 설정도 같은
 * 값으로 둔다(단어장 설정이 serverLimit을 기기 설정에 맞추는 것과 같은 짝 — 배움 칸 · 손님 셈이 읽는다).
 * 한도 모듈은 첫 그림 밖이라 화면은 이 함수를 import()로만 부른다. 반환 = { ok, limit } — ok false면 화면이 앞 값으로 되돌린다.
 */
export async function levelSetNewPerDay(accountId, limit) {
  if (!accountId || !isNewPerDayValue(limit)) return { ok: false };
  const controller = createLearningAdmissionController({ accountId, client: createLearningAdmissionClient({ accountId }) });
  try {
    if (!(await controller.refresh())) return { ok: false };
    const { quota } = controller.getSnapshot();
    if (!canUseLegacyAdmissionCompatibility(quota) && !(await controller.configure(limit))) return { ok: false };
    try { localStorage.setItem('vocab_new_per_day', String(limit)); } catch { /* 저장소 차단 — 서버 한도는 이미 바뀌었다 */ }
    cached = null; // 위 1분 묶음(levelNewQuota)이 옛 한도를 내지 않게
    return { ok: true, limit };
  } finally { controller.dispose(); }
}

/**
 * 「카드」 줄(학습 옵션 시트 · CARD-TYPES-001 3단계)이 켜진 카드 종류를 바꾼다 — 하루 새 단어 수와 같은 길(입장 configure · 같은 판본 +1)에
 * cardKinds 칸만 더한다(하루 새 단어 수는 지금 값 그대로 보낸다). 새 설정 · 새 표를 만들지 않는다(설계 §4 「입장 정책 행에 열 하나」).
 * 호환(사전 활성) 모드에는 서버 입장 정책이 없어 바꾸지 않는다(ok false — 화면은 그 모드에서 줄을 그리지 않는다).
 * 반환 = { ok, cardKinds } — ok false면 화면이 앞 값으로 되돌린다.
 */
export async function levelSetCardKinds(accountId, kinds) {
  let cardKinds;
  try { cardKinds = [...normalizeCardKinds(kinds)]; } catch { return { ok: false }; }
  if (!accountId) return { ok: false };
  const controller = createLearningAdmissionController({ accountId, client: createLearningAdmissionClient({ accountId }) });
  try {
    if (!(await controller.refresh())) return { ok: false };
    const { quota } = controller.getSnapshot();
    if (!quota || canUseLegacyAdmissionCompatibility(quota)) return { ok: false };
    if (!(await controller.configure(quota.limit, { cardKinds }))) return { ok: false };
    const saved = admissionCardKinds(controller.getSnapshot().quota);
    return { ok: true, cardKinds: [...saved] };
  } finally { controller.dispose(); }
}
