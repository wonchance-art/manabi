// 서버 전용 — 탭 단어 문맥 설명 R1 (오너 승인 2026-08-30 "ㄱㄱ" — 버튼형+suspect).
// 카드는 사전 즉답을 유지하고, 학습자가 [이 문장에서는?]을 눌렀을 때만 문장 맥락과
// 문장 구조 속 배치를 읽은 설명을 생성한다(선례: Language Reactor의 즉답+지연 설명 병행).
//
// suspect = 2차 방어의 수확 신호(오너 토의 확정): 설명 LLM은 토큰열이 아니라 원문
// 문장을 읽으므로, 1차 파이프라인의 분할·기본형이 문장과 안 맞아 보이면 같은 호출의
// 부산물로 신고한다(추가 비용 0 — 판별기 단어성 판정 선례). suspect는 학습자에게
// 보이지 않고 token_corrections(source: ai_explain_suspect)에 적재만 된다 — 정본
// 반영은 반드시 사람 검토 + 계약 게이트를 거친다(LLM 판정은 정본이 될 수 없다).

export const EXPLAIN_TOKEN_MAX = 500; // 설명 길이 캡(카드 한 섹션 분량)
const SUSPECT_REASON_MAX = 120;

/** 프롬프트 — 호출부가 각 필드를 이미 길이 캡했다고 가정한다(라우트의 cap과 쌍). */
export function buildTokenExplainPrompt({ language, sentence, word, base, pos }) {
  const cur = [base && base !== word ? `기본형 ${base}` : null, pos ? `품사 ${pos}` : null]
    .filter(Boolean).join(', ');
  return `${language} 문장과 학습자가 탭한 단어입니다.
문장: ${sentence}
단어: ${word}${cur ? ` (현재 분석 — ${cur})` : ''}

이 문장의 맥락과 문장 구조 속 배치를 검토해 JSON으로만 답하세요:
{"exp":"이 문장에서 이 단어의 뜻과 역할·쓰임을 한국어 2~3문장으로. 문법 용어 최소, 학습자 눈높이","suspect":null}

규칙:
- exp는 이 문장에서의 쓰임에 집중(사전식 나열 금지)
- 현재 분석의 분할·기본형이 이 문장과 맞지 않아 보일 때만 suspect를
  {"base":"옳은 기본형(문장에 있는 글자로만)","reason":"한 문장 근거"}로 채우고,
  분석이 맞으면 반드시 null
- 설명·주석·마크다운 없이 JSON만 출력`;
}

/** 모델 출력 → { exp, suspect } | null. 코드펜스·앞뒤 잡문은 관용 파싱(관례: parseJsonLenient). */
export function parseTokenExplain(raw) {
  if (!raw) return null;
  let t = String(raw).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(t.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 파싱 결과 검증·정리(신뢰 경계 — 모델 응답은 검증 없이 쓰지 않는다).
 * @returns {{ explanation: string, suspect: {base, reason}|null } | null} 설명이 없으면 null.
 */
export function sanitizeTokenExplain(parsed, { sentence, word, base }) {
  const exp = typeof parsed?.exp === 'string' ? parsed.exp.replace(/\s+/g, ' ').trim() : '';
  if (!exp) return null;
  const explanation = exp.slice(0, EXPLAIN_TOKEN_MAX);

  let suspect = null;
  const s = parsed?.suspect;
  if (s && typeof s === 'object' && typeof s.base === 'string') {
    const sBase = s.base.trim();
    const cur = base || word;
    const chars = new Set([...String(sentence)]);
    const valid = sBase.length >= 1 && sBase.length <= 4
      && sBase !== cur
      && [...sBase].every((ch) => chars.has(ch)); // 문장 글자로 합성 가능한 제안만(분할·기본형 오류 신고 용도)
    if (valid) {
      suspect = {
        base: sBase,
        reason: typeof s.reason === 'string' ? s.reason.trim().slice(0, SUSPECT_REASON_MAX) : '',
      };
    }
  }
  return { explanation, suspect };
}
