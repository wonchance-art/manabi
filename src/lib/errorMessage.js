// 에러 메시지를 사용자 친화적 안내로 변환
// 기술 메시지(HTTP, DB, API)를 사람이 이해할 수 있는 안내로

const PATTERNS = [
  // 네트워크
  { match: /failed to fetch|network|ERR_NETWORK|connection/i,
    user: '네트워크 연결을 확인해주세요. 잠시 후 다시 시도하면 대개 해결돼요.',
    retry: true },

  // 용량/속도 제한
  { match: /high demand|overloaded|unavailable|resource_exhausted|503/i,
    user: 'AI 서비스가 잠시 붐비고 있어요. 잠시 후 자동으로 재시도됩니다.',
    retry: true },
  { match: /rate|too many|429|요청이 너무/i,
    user: '요청이 너무 많아요. 1~2분 기다린 뒤 다시 시도해주세요.',
    retry: true },

  // 인증
  { match: /unauthor|not authenticated|jwt|token/i,
    user: '로그인이 만료됐어요. 다시 로그인해주세요.' },
  { match: /admin access required|403|forbidden/i,
    user: '이 작업은 관리자만 할 수 있어요.' },

  // Supabase/DB 공통
  { match: /duplicate key|already exists|23505/i,
    user: '이미 저장된 항목이에요.' },
  { match: /violates foreign key|23503/i,
    user: '참조 무결성 오류예요. 관련 항목이 먼저 있어야 합니다.' },
  { match: /violates row-level security|42501/i,
    user: '권한이 없어요. 본인의 항목만 수정/삭제할 수 있습니다.' },

  // 파일/업로드
  { match: /too large|payload|413/i,
    user: '파일이 너무 커요. 50MB 이하로 줄여주세요.' },
  { match: /bucket not found|storage.*not found/i,
    user: '저장소 설정에 문제가 있어요. 관리자에게 문의하세요.' },

  // AI 특정
  { match: /no longer available|not found.*model|model.*404/i,
    user: 'AI 모델 설정에 문제가 있어요. 관리자에게 문의하세요.' },
  { match: /api key/i,
    user: '서비스 설정에 문제가 있어요. 관리자에게 문의하세요.' },

  // JSON 파싱
  { match: /unexpected token|not valid json|json parse/i,
    user: '응답 형식 오류예요. 다시 시도하면 대개 해결됩니다.',
    retry: true },
];

/**
 * 기술 에러 메시지 → 사용자 친화 메시지
 * @param {Error|string} err
 * @returns {{ message: string, retry?: boolean, technical: string }}
 */
export function friendlyError(err) {
  const technical = typeof err === 'string' ? err : (err?.message || String(err));

  for (const p of PATTERNS) {
    if (p.match.test(technical)) {
      return { message: p.user, retry: !!p.retry, technical };
    }
  }

  // 매치 없으면 원본 노출 (단, 프리픽스는 제거)
  const cleaned = technical.replace(/^(Error:|HTTP \d+:|오류:|Server Error:)\s*/i, '').slice(0, 200);
  return {
    message: cleaned || '알 수 없는 오류가 발생했어요.',
    retry: false,
    technical,
  };
}

/** 토스트용 한 줄 메시지 */
export function friendlyToastMessage(err) {
  return friendlyError(err).message;
}
