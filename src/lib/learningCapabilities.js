import { viewerLanguageInfo } from './viewerLanguage';

export const LEARNING_CONTRACT_VERSION = 1;
const ACTIONS = ['save', 'review', 'known', 'exclude'];
const DISABLED = Object.freeze(Object.fromEntries(ACTIONS.map(action => [action, false])));
const ENABLED = Object.freeze(Object.fromEntries(ACTIONS.map(action => [action, true])));

export const isLearningStorageUnavailableError = error => error?.code === 'learning_storage_unavailable'
  || (error?.code === '55000' && /korean_learning_not_ready/.test(error.message || ''));

// DB의 완전한 계약만 인정한다. 언어 등록이나 일부 RPC 성공은 저장 지원의 증거가 아니다.
export function normalizeLearningCapabilities(value) {
  const supported = value?.version === LEARNING_CONTRACT_VERSION
    && value.languages && typeof value.languages === 'object'
    && !Array.isArray(value.languages)
    && ACTIONS.every(action => value.languages.Korean?.[action] === true);
  return { version: LEARNING_CONTRACT_VERSION, languages: supported ? { Korean: { ...ENABLED } } : {} };
}

export function learningLanguageCapabilities(language, contract) {
  const info = viewerLanguageInfo(language);
  if (!info) return DISABLED;
  if (info.releaseStatus === 'legacy' && info.capabilities.save === 'supported') return ENABLED;
  if (info.language === 'Korean' && normalizeLearningCapabilities(contract).languages.Korean) return ENABLED;
  return DISABLED;
}
