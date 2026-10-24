// 요청 범위(scope)의 직렬화를 렌더마다 다시 하지 않는다(VIEWER-TAP-INP-001). 뷰어의 scope에는 자료 원문 · 분석 전체
// (processed_json)가 들어 있어, 낱말을 누를 때마다 뷰어가 다시 그려지며 해설 훅 셋(문형 · 쉬운 말 · 낱말 설명)이 그 전체를
// JSON으로 만들고 있었다(e2e 빌드 · 390 · CPU×4 · 48줄 자료에서 탭마다 약 9ms — 자료 길이에 비례한다).
// 입력의 각 칸이 지난번과 같은 값(Object.is)이면 지난 문자열을 그대로 돌려준다 — 결과는 JSON.stringify(parts)와 같다.
// cache = 호출부 훅의 useRef 칸. 렌더 중 갱신해도 같은 입력이면 같은 결과라, 버려진 렌더가 남긴 값도 무해하다.
export function stableJson(cache, parts) {
  const last = cache.current;
  if (last && last.parts.length === parts.length && last.parts.every((value, i) => Object.is(value, parts[i]))) return last.json;
  const json = JSON.stringify(parts);
  cache.current = { parts, json };
  return json;
}
