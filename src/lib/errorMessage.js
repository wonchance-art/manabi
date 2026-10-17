// 에러 메시지를 사용자 친화적 안내로 변환
// 기술 메시지(HTTP, DB, API)를 사람이 이해할 수 있는 안내로
// 화면 오류 문구의 정본 파일 — 문구는 화면 문구 표준(docs/design/copy-standard.md)을 따른다(해요체 · 「…해 주세요」 · 「…」).

// 「서비스 설정」 오류 — AI 제공자 결제 · 크레딧 소진(Gemini 402, 같은 문구가 429 RESOURCE_EXHAUSTED로도 온다).
// 기다려도 풀리지 않으므로 혼잡(재시도 · 「잠시 붐비고 있어요」)으로 보지 않는다. 서버(llm.js · tts) · 클라(gemini.js) · 안내 문구가
// 이 한 판정을 쓴다(GEMINI-402-GUARD, 2026-10-17 KST — 운영 402 「Your prepayment credits are depleted」 실측).
// HTTP 402이거나 **구체적인 크레딧 소진 문구**만 본다. 「billing」 단독은 쓰지 않는다 — 보통 쿼터 초과 429도
// 「…check your plan and billing details」(Gemini) · 「…/settings/billing」(Groq)를 싣는데, 그건 기다리면 풀리는 혼잡이다.
export const SERVICE_CONFIG_PATTERN = /prepayment credits|credits?\s+(?:are\s+|have been\s+)?(?:depleted|exhausted)/i;
export function isServiceConfigError(status, detail) {
  if (status === 402) return true;
  let text = '';
  try { text = typeof detail === 'string' ? detail : JSON.stringify(detail ?? ''); } catch { text = ''; }
  return SERVICE_CONFIG_PATTERN.test(text || '');
}

// 안내는 기존 「서비스 설정」 문구(api key 패턴과 같은 말) 그대로 — 새 문구를 만들지 않는다.
const SERVICE_CONFIG_MESSAGE = '서비스 설정에 문제가 있어요. 관리자에게 문의해 주세요.';

const PATTERNS = [
  // 서비스 설정(결제 · 크레딧) — 용량 패턴보다 먼저 본다: 같은 문구가 429 · RESOURCE_EXHAUSTED로 와도 「붐빔」이 아니다.
  { match: SERVICE_CONFIG_PATTERN, user: SERVICE_CONFIG_MESSAGE },

  // 네트워크
  { match: /failed to fetch|network|ERR_NETWORK|connection/i,
    user: '인터넷 연결을 확인해 주세요. 잠시 후 다시 시도하면 대개 해결돼요.',
    retry: true },

  // 용량/속도 제한
  { match: /high demand|overloaded|unavailable|resource_exhausted|503/i,
    user: 'AI 서비스가 잠시 붐비고 있어요. 잠시 후 다시 시도해 주세요.',
    retry: true },
  { match: /rate|too many|429|요청이 너무/i,
    user: '요청이 너무 많아요. 1~2분 기다린 뒤 다시 시도해 주세요.',
    retry: true },

  // JSON 파싱 — 인증 패턴(/token/)보다 먼저 본다: 「Unexpected token」이 「로그인이 만료됐어요」로 오분류되던 문제.
  // gemini.js의 내부 문구(「Gemini 응답 JSON 파싱 실패」·「JSON 괄호를 찾을 수 없습니다」·
  // 「서버 응답 형식 오류 (HTTP n)」·「Gemini 응답이 비어있습니다」)도 같은 안내로 받는다.
  { match: /unexpected token|not valid json|json parse|JSON 파싱|JSON 괄호|응답 형식 오류|응답이 비어/i,
    user: '응답을 읽지 못했어요. 다시 시도하면 대개 해결돼요.',
    retry: true },

  // 인증
  { match: /unauthor|not authenticated|jwt|token/i,
    user: '로그인이 만료됐어요. 다시 로그인해 주세요.' },
  { match: /admin access required|403|forbidden/i,
    user: '이 작업은 관리자만 할 수 있어요.' },

  // Supabase/DB 공통
  { match: /duplicate key|already exists|23505/i,
    user: '이미 저장된 항목이에요.' },
  { match: /violates foreign key|23503/i,
    user: '관련 항목이 없어서 저장하지 못했어요. 관련 항목을 먼저 확인해 주세요.' },
  { match: /violates row-level security|42501/i,
    user: '권한이 없어요. 본인의 항목만 수정·삭제할 수 있어요.' },

  // 파일/업로드
  { match: /too large|payload|413/i,
    user: '파일이 너무 커요. 50MB 이하로 줄여 주세요.' },
  { match: /bucket not found|storage.*not found/i,
    user: '저장소 설정에 문제가 있어요. 관리자에게 문의해 주세요.' },

  // AI 특정
  { match: /no longer available|not found.*model|model.*404/i,
    user: 'AI 모델 설정에 문제가 있어요. 관리자에게 문의해 주세요.' },
  { match: /api key/i,
    user: '서비스 설정에 문제가 있어요. 관리자에게 문의해 주세요.' },
];

// 매칭도 안 되고 우리 한국어 안내도 아닌 오류에 보여 주는 고정 문구 — 화면 문구 표준(docs/design/copy-standard.md §2)의
// 「원인을 모르는 오류」 형태(「문제가 발생했어요」 + 「잠시 후 다시 시도해 주세요.」). 「알 수 없는 오류」는 표준이 금한다.
export const UNKNOWN_ERROR_MESSAGE = '문제가 발생했어요. 잠시 후 다시 시도해 주세요.';

const logged = new Set();

// 한국어여도 내부 사정인 표지 — gemini.js의 「Gemini 응답 …」·「(HTTP 500)」, DB 열·제약 이름(snake_case),
// 환경 변수 이름, JS 예외 이름, PostgREST 코드, 스택·마크업 조각.
const TECHNICAL_MARKERS = /HTTP\s*\d{3}|\bJSON\b|Gemini 응답|\b[A-Za-z]*Error\b|\bnull\b|\bundefined\b|\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b|[{}<>]|\bPGRST\d+|\bat [\w.$]+ \(/;

/**
 * 우리 API·화면이 이미 학습자용으로 쓴 한국어 안내인가 (WALL-STATES-001).
 * 한글이 있고, 라틴 글자가 한글보다 적고, 내부 표지가 없을 때만 그대로 보여 줄 수 있다.
 * 영어 원문(Supabase·브라우저·제공자 오류)과 내부 한국어 문구(gemini.js)는 여기서 걸러진다.
 */
export function isUserFacingMessage(text) {
  if (typeof text !== 'string' || !text.trim()) return false;
  const hangul = (text.match(/[가-힣]/g) || []).length;
  if (!hangul) return false;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (latin > hangul) return false;
  return !TECHNICAL_MARKERS.test(text);
}

/**
 * 기술 에러 메시지 → 사용자 친화 메시지
 * 매칭 → 정해 둔 안내, 우리 한국어 안내 → 그대로(접두어 제거·200자), 그 밖 → 고정 문구 + 콘솔.
 * 원문은 화면에 내지 않는다(WALL-001과 같은 원칙) — technical과 콘솔로만 남긴다.
 * @param {Error|string} err
 * @param {{ fallback?: string }} [options] 고정 문구 대신 쓸 그 화면의 한국어 폴백
 * @returns {{ message: string, retry?: boolean, technical: string }}
 */
export function friendlyError(err, { fallback } = {}) {
  const technical = typeof err === 'string' ? err : (err?.message || (err == null ? '' : String(err)));
  // 본문 없이 상태만 온 402(「API 요청 실패 (HTTP 402)」)도 서비스 설정이다.
  if (err && typeof err === 'object' && err.status === 402) return { message: SERVICE_CONFIG_MESSAGE, retry: false, technical };

  for (const p of PATTERNS) {
    if (p.match.test(technical)) {
      return { message: p.user, retry: !!p.retry, technical };
    }
  }

  const cleaned = technical.replace(/^(Error:|HTTP \d+:|오류:|Server Error:)\s*/i, '').trim().slice(0, 200);
  if (isUserFacingMessage(cleaned)) return { message: cleaned, retry: false, technical };

  // 렌더 중에 불리는 자리(쿼리 오류 표시)도 있어 같은 원문은 한 번만 남긴다.
  if (technical && !logged.has(technical)) {
    if (logged.size >= 50) logged.clear();
    logged.add(technical);
    console.warn('[friendlyError] 원문은 화면에 내지 않음:', technical);
  }
  return { message: fallback || UNKNOWN_ERROR_MESSAGE, retry: false, technical };
}

/** 토스트·오류 상자용 한 줄 메시지 — fallback은 그 화면의 한국어 폴백(없으면 고정 문구) */
export function friendlyToastMessage(err, fallback) {
  return friendlyError(err, { fallback }).message;
}

// 원인을 모를 때 실패 문장 뒤에 붙는 다음 행동 한 문장.
export const RETRY_LATER_MESSAGE = '잠시 후 다시 시도해 주세요.';

/**
 * 실패 토스트 — 「〔무엇〕을 〔동작〕하지 못했어요.」 + 원인 안내(모르는 오류면 「잠시 후 다시 시도해 주세요.」).
 * 화면마다 짓던 「저장 실패 — {원인}」 명사형을 대신한다(copy-standard.md §2 「실패」, COPY-STD-001).
 * @param {string} head 실패 문장 — 예: '단어를 저장하지 못했어요.'
 * @param {Error|string} err
 */
export function failureMessage(head, err) {
  return `${head} ${friendlyToastMessage(err, RETRY_LATER_MESSAGE)}`;
}

// 관리자 역할 변경 실패(public.admin_set_user_role RPC 오류 코드 → 안내). 화면마다 짓지 않도록 여기 둔다.
//   PGRST202 — 운영에 RPC가 아직 없다(마이그레이션 적용 전) · 42501 — 마지막 관리자 강등 거부 / 관리자 아님 ·
//   22023 — 역할 값이 student · host · admin 밖 · P0002 — 대상 프로필 없음.
export const ROLE_CHANGE_FAILED = '역할을 바꾸지 못했어요.';
export function roleChangeFailureMessage(err) {
  const code = err?.code;
  const text = err?.message || '';
  if (code === 'PGRST202') return `${ROLE_CHANGE_FAILED} 역할 변경 기능이 아직 준비 중이에요.`;
  if (code === '42501' && /last admin/i.test(text)) return '마지막 관리자는 학습자로 바꿀 수 없어요. 다른 관리자를 먼저 지정해 주세요.';
  if (code === '42501') return `${ROLE_CHANGE_FAILED} 이 작업은 관리자만 할 수 있어요.`;
  if (code === '22023') return `${ROLE_CHANGE_FAILED} 학습자 · 호스트 · 관리자 중에서만 고를 수 있어요.`;
  if (code === 'P0002') return `${ROLE_CHANGE_FAILED} 이 사용자를 찾지 못했어요.`;
  return failureMessage(ROLE_CHANGE_FAILED, err);
}
