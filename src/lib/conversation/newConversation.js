// 새 대화(자료 없이) 화면의 선택지 — v2-Z Z-R2(시안 conv.html 「새 대화」).
// 언어·수준 이름은 정본(constants LEVELS·langNameKo)을 그대로 쓴다. 지역 목록을 또 만들지 않는다.
import { LEVELS, levelRank } from '../constants';
import { CONVERSATION_LANGUAGES, CONVERSATION_MAX_TOPIC_CHARS } from './turnModel';

export const CONVERSATION_TOPICS = Object.freeze(['오늘 하루', '주말 계획', '여행', '음식', '학교·일', '취미']);
export const NEW_CONVERSATION_PATH = '/conversation/new';

/** 수준 선택지 = 그 언어의 학습 수준 정본. */
export const conversationLevels = (language) => LEVELS[language] || [];

/**
 * 추천 수준: 내 프로필 수준이 있으면 그것, 없으면 그 언어 첫 단계.
 * 프로필 값이 정본에 없으면(옛 값) 첫 단계로 둔다.
 */
export function recommendedLevel(language, profileValue) {
  const levels = conversationLevels(language);
  if (profileValue && levelRank(language, profileValue) != null && levels.includes(profileValue)) return profileValue;
  return levels[0] || '';
}

/**
 * 새 대화의 처음 언어 — 프로필의 첫 학습 언어(대화가 받는 언어만), 없으면 중국어(오너 「권장대로」 2026-10-17 KST).
 * 예전에는 프로필과 무관하게 중국어였다 — 일본어 학습자도 「중국어 · OT 입문」으로 열렸다(합성 로그인 실측).
 * learning_language는 배열(현행)과 문자열(옛 행)을 둘 다 받는다.
 */
export function preferredConversationLanguage(profile) {
  const raw = profile?.learning_language;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((language) => CONVERSATION_LANGUAGES.includes(language)) || 'Chinese';
}

/** 주소 → 처음 선택(「주제·수준 바꾸기」가 지금 대화 값으로 연다). 모르는 값은 버린다. */
export function newConversationDefaults(params, { profileLevelOf = () => null, fallbackLanguage = 'Chinese' } = {}) {
  const lang = params.get('lang');
  const language = CONVERSATION_LANGUAGES.includes(lang) ? lang : fallbackLanguage;
  const level = params.get('level');
  const topic = String(params.get('topic') || '').trim().slice(0, CONVERSATION_MAX_TOPIC_CHARS);
  return {
    language,
    level: conversationLevels(language).includes(level) ? level : recommendedLevel(language, profileLevelOf(language)),
    topic,
  };
}

/** 지금 대화의 값으로 새 대화 화면 주소를 만든다(「주제·수준 바꾸기」). */
export function newConversationHref({ language, level, topic } = {}) {
  const query = new URLSearchParams();
  if (language) query.set('lang', language);
  if (level) query.set('level', level);
  if (topic) query.set('topic', topic);
  return `${NEW_CONVERSATION_PATH}${query.size ? `?${query}` : ''}`;
}

/** 시작 버튼을 눌러도 되나 — 주제(고른 것 또는 직접 적은 것)와 언어·수준이 다 있어야 한다. */
export function canStartConversation({ topic, language, level }) {
  return !!String(topic || '').trim() && CONVERSATION_LANGUAGES.includes(language) && conversationLevels(language).includes(level);
}
