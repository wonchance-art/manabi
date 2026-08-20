// 자료 언어명 → Web Speech 태그의 단일 소스.
// 매핑이 컴포넌트마다 흩어져 있던 탓에 불어·중국어 자료가 영어 보이스(en-US)로
// 낭독되는 실결함이 있었다(ListenControls — 전수 조사 발견). 새 언어를 열 때
// 여기 한 곳만 늘리면 낭독·음성 선택이 함께 따라온다.

const BCP47 = {
  Japanese: 'ja-JP', ja: 'ja-JP',
  Chinese: 'zh-CN', zh: 'zh-CN',
  French: 'fr-FR', fr: 'fr-FR',
  English: 'en-US', en: 'en-US',
};

/** Web Speech utterance/voice 매칭용 BCP-47 태그. 미지 언어는 en-US(기존 폴백 유지). */
export function bcp47ForLanguage(language) {
  return BCP47[language] || 'en-US';
}

/** 보이스 목록 필터·저장 키용 접두(ja·zh·fr·en). */
export function voicePrefixForLanguage(language) {
  return bcp47ForLanguage(language).split('-')[0];
}
