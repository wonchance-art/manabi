import { isWordToken } from '../wordState';

/**
 * 공유 사전(morpheme_dictionary)에 뜻을 물어야 할 base_form 목록.
 *
 * 라우트 안의 루프였다가 떼어냈다(2026-09-02) — 이유는 계약 가능성이다. 분석기의 모든 토큰이
 * `base_form`을 달고 나오므로 문장부호도 예외가 아니고, 거르지 않으면 `。`·`，`의 뜻을 Gemini에
 * 묻고 그 답이 전 사용자 공유 사전에 적재된다. 실제로 그렇게 쌓인 4행(，。“ ”)을 운영 감사에서
 * 찾았다. 라우트 안에 있으면 「거르고 있는가」를 계약으로 못 박을 수 없어 지우기만 해선 다시 쌓인다.
 *
 * 어휘 판정은 뷰어가 쓰는 정본 그대로(`isWordToken` — 기호 배제 + 글자 없는 토큰 배제).
 * 같은 질문에 술어를 두 벌 두면 한쪽만 낡는다.
 */
export function collectMissingBaseForms(tokenizedLines, cache) {
  const out = [];
  const seen = new Set();
  for (const { tokens } of tokenizedLines) {
    for (const t of tokens) {
      if (!t.base_form || seen.has(t.base_form) || cache.has(t.base_form)) continue;
      if (!isWordToken(t)) continue;
      // 이합사 O 조각(sep_link)은 V의 base_form(VO)이 이미 조회한다 — 歉 같은 낱글자를 Gemini에
      // 묻고 공유 사전에 적재하던 자리(운영 DB 歉 행, 2026-09-02).
      if (t.sep_link) continue;
      seen.add(t.base_form);
      out.push({ base_form: t.base_form, pos: t.pos, reading: t.furigana });
    }
  }
  return out;
}
