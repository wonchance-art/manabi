// 첫 방문 온보딩(ONB-001)의 선택 · 저장 규칙. 화면(OnboardingModal)과 계약 테스트가 같은 함수를 읽는다.
// 새 열 · 새 사전 없음 — profiles 기존 열, LEVELS · PROFILE_LEVEL_COLUMN, viewer_language:v1을 그대로 쓴다.
import { LEVELS, PROFILE_LEVEL_COLUMN } from './constants';
import { canonicalViewerLocale } from './viewerLanguage';

/** 내 언어가 한국어일 때 배울 수 있는 언어 — 현행 순서(일 · 영 · 프 · 중). */
export const KO_LEARNABLE = Object.freeze(['Japanese', 'English', 'French', 'Chinese']);
/** 내 언어가 중국어(简体 · 繁體)일 때 — 한국어 하나(준비 중, D-L3). */
export const ZH_LEARNABLE = Object.freeze(['Korean']);

/** 내 언어 초기값 — 기기 언어로만 맞춘다(「미리 선택 없음」의 유일한 예외). 못 맞추면 한국어. */
export function initialUiLocale(navigatorLanguages) {
  const list = Array.isArray(navigatorLanguages) ? navigatorLanguages : [navigatorLanguages];
  for (const tag of list) {
    const locale = canonicalViewerLocale(tag);
    if (locale) return locale;
  }
  return 'ko';
}

export function learnableLanguages(uiLocale) {
  return uiLocale === 'ko' ? KO_LEARNABLE : ZH_LEARNABLE;
}

/** 수준 단계(②)를 묻는가 — 한국어 사용자만. 한국어 급수 체계가 아직 없다. */
export function asksLevel(uiLocale) {
  return uiLocale === 'ko';
}

/**
 * 고른 상태 — picked는 고른 순서, primary는 주 언어. 처음 고른 언어가 주 언어이고,
 * 주 언어를 해제하면 남은 것 중 먼저 고른 언어가 이어받는다.
 */
export function emptySelection(uiLocale) {
  const options = learnableLanguages(uiLocale);
  // 선택지가 하나뿐이면(중국어 사용자의 한국어) 미리 체크한다.
  return options.length === 1 ? { picked: [options[0]], primary: options[0] } : { picked: [], primary: null };
}

export function toggleLanguage(selection, language) {
  if (selection.picked.includes(language)) {
    const picked = selection.picked.filter(l => l !== language);
    const primary = selection.primary === language ? picked[0] ?? null : selection.primary;
    return { picked, primary };
  }
  const picked = [...selection.picked, language];
  return { picked, primary: selection.primary ?? language };
}

export function makePrimary(selection, language) {
  return selection.picked.includes(language) ? { ...selection, primary: language } : selection;
}

/** 내 언어를 바꾸면 새 목록에 없는 기존 선택은 해제한다. */
export function selectionForLocale(selection, uiLocale) {
  const options = learnableLanguages(uiLocale);
  if (options.length === 1) return emptySelection(uiLocale);
  const picked = selection.picked.filter(l => options.includes(l));
  const primary = picked.includes(selection.primary) ? selection.primary : picked[0] ?? null;
  return { picked, primary };
}

/** learning_language = [주 언어, 나머지는 고른 순서]. */
export function orderedLanguages(selection) {
  if (!selection.primary) return [...selection.picked];
  return [selection.primary, ...selection.picked.filter(l => l !== selection.primary)];
}

/** 3택 · 급수 칩에 쓰는 정규 급수 — 입문 단계(OT · A0)를 뺀 LEVELS. */
export function regularLevels(language) {
  return (LEVELS[language] || []).filter(level => !/^(OT|A0)\b/.test(level));
}

/**
 * 답 → 저장될 급수. /study q1과 같은 규칙: 처음 = regular[0], 기초 = regular[1], 배운 적 = 고른 급수.
 * @param {{kind:'fresh'|'basics'|'learned', level?:string}|null} answer
 */
export function levelForAnswer(language, answer) {
  const regular = regularLevels(language);
  if (!answer) return null;
  if (answer.kind === 'fresh') return regular[0] ?? null;
  if (answer.kind === 'basics') return regular[1] ?? regular[0] ?? null;
  if (answer.kind === 'learned') return regular.includes(answer.level) ? answer.level : null;
  return null;
}

/** 고른 언어마다 저장할 급수가 정해졌는가(「시작하기」 활성 조건). 급수 열이 없는 언어는 묻지 않는다. */
export function answersComplete(languages, answers) {
  return languages.length > 0 && languages
    .filter(l => PROFILE_LEVEL_COLUMN[l])
    .every(l => levelForAnswer(l, answers[l]) !== null);
}

/** 가입 때 이름 미리 채우기 — DB 기본 이름(「새로운 학습자」)과 구글 실명은 채우지 않는다(D-O5). */
export const DEFAULT_DISPLAY_NAME = '새로운 학습자';
export function prefillDisplayName(profile, user) {
  const name = typeof profile?.display_name === 'string' ? profile.display_name.trim() : '';
  if (!name || name === DEFAULT_DISPLAY_NAME) return '';
  const meta = user?.user_metadata || {};
  if (!meta.display_name && (name === meta.full_name || name === meta.name)) return '';
  return name;
}

/**
 * profiles에 쓸 값. 수준은 고른 언어만 쓴다(안 고른 언어 열은 건드리지 않는다).
 * 닉네임은 다듬은 값이 있을 때만 — 비우면 기존 값 유지.
 * @returns {{base:object, optional:object}} optional = 프 · 중 열(미적용 환경 재시도 때 뺀다)
 */
export function buildProfileUpdate({ selection, answers = {}, displayName = '', uiLocale = 'ko' }) {
  const languages = orderedLanguages(selection);
  const base = { learning_language: languages, onboarded: true };
  const name = typeof displayName === 'string' ? displayName.trim() : '';
  if (name) base.display_name = name;
  const optional = {};
  if (asksLevel(uiLocale)) {
    for (const language of languages) {
      const column = PROFILE_LEVEL_COLUMN[language];
      const level = levelForAnswer(language, answers[language]);
      if (!column || !level) continue;
      if (language === 'French' || language === 'Chinese') optional[column] = level;
      else base[column] = level;
    }
  }
  return { base, optional };
}

/** 프로필 급수('H3 중급') ↔ /study 레벨 키('H3'). LEVELS에 없는 키(중국어 LIFE 등)는 매핑 밖이다. */
export function studyKeyForProfileLevel(level) {
  return typeof level === 'string' && level.trim() ? level.trim().split(/\s+/)[0] : null;
}
export function profileLevelForStudyKey(language, key) {
  if (typeof key !== 'string' || !key) return null;
  return regularLevels(language).find(level => level.split(/\s+/)[0] === key) ?? null;
}
