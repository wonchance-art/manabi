// 자료 언어명 → Web Speech 태그의 단일 소스.
// 매핑이 컴포넌트마다 흩어져 있던 탓에 불어·중국어 자료가 영어 보이스(en-US)로
// 낭독되는 실결함이 있었다(ListenControls — 전수 조사 발견). 새 언어를 열 때
// 여기 한 곳만 늘리면 낭독·음성 선택이 함께 따라온다.
import { viewerLanguageInfo } from './viewerLanguage';

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

/**
 * 낭독 utterance 태그 — 뷰어 언어 등록부(viewerLanguage)의 speechLocale이 정본, 없으면 위 표.
 * 등록부에만 있는 언어(Korean → ko-KR)가 위 표의 en-US 폴백으로 떨어지지 않게 한다(본문 듣기 실결함 2026-10-18 KST).
 * 단어 발음(useTTS)과 본문 듣기(ListenControls)가 같이 쓴다 — 표에 Korean을 겹쳐 적지 않는다(두 정본 금지).
 */
export function speechTagForLanguage(language) {
  return viewerLanguageInfo(language)?.speechLocale || bcp47ForLanguage(language);
}

/** 보이스 목록 필터·저장 키용 접두(ja·zh·fr·en). */
export function voicePrefixForLanguage(language) {
  return bcp47ForLanguage(language).split('-')[0];
}
