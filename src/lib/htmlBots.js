// 메타데이터를 <head>에 막고(blocking) 보낼 봇 — Next htmlLimitedBots(LH-BASELINE-001, 2026-11-09 KST).
// Next 15.5는 메타데이터를 흘려 보낸다(streaming): 기본 목록(html-bots.js HTML_LIMITED_BOT_UA_RE)에 없는 UA는 description · og 태그를
// <body> 뒤쪽에 받고, 브라우저에서도 <head>로 올라가지 않는다(운영 /viewer/120 실측 — head 0 · body 1). Next는 「JS를 실행한다」며 Googlebot을
// 기본 목록에서 뺐고, 다음 검색 Daumoa도 없다 — 이들에게 설명이 head에 없었다. 기본 목록을 그대로 두고 더한다(사람 방문자는 그대로 흘려 받는다).
// 카카오톡 미리 보기(kakaotalk-scrap)는 UA에 facebookexternalhit가 함께 있어 이미 기본 목록에 걸리지만, 단독 UA도 받도록 적어 둔다.
export const EXTRA_HTML_LIMITED_BOTS = Object.freeze(['Googlebot', 'Daumoa', 'kakaotalk-scrap']);

/** Next 기본 목록(source)에 우리 봇을 더한 정규식. */
export function htmlLimitedBotsRegex(nextDefaultSource) {
  const extra = EXTRA_HTML_LIMITED_BOTS.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(nextDefaultSource ? `${nextDefaultSource}|${extra}` : extra, 'i');
}
