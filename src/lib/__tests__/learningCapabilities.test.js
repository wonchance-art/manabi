import { describe, expect, it } from 'vitest';
import { isLearningStorageUnavailableError, learningLanguageCapabilities, normalizeLearningCapabilities } from '../learningCapabilities';

const ready = { version: 1, languages: { Korean: { save: true, review: true, known: true, exclude: true } } };
describe('배포된 한국어 학습 저장 계약', () => {
  it('한국어 계약 거부와 일반 통신 실패를 구분한다', () => {
    expect(isLearningStorageUnavailableError({ code: '55000', message: 'korean_learning_not_ready' })).toBe(true);
    expect(isLearningStorageUnavailableError({ code: 'learning_storage_unavailable' })).toBe(true);
    expect(isLearningStorageUnavailableError({ code: '55000', message: 'vocabulary_excluded' })).toBe(false);
    expect(isLearningStorageUnavailableError(new Error('Failed to fetch'))).toBe(false);
  });
  it.each(['Japanese', 'Chinese', 'English', 'French'])('기존 %s 지원은 새로운 RPC에 의존하지 않는다', language => {
    expect(learningLanguageCapabilities(language, null)).toEqual({ save: true, review: true, known: true, exclude: true });
  });
  it('정확한 완전한 계약만 한국어 저장을 연다', () => {
    expect(learningLanguageCapabilities('Korean', ready)).toEqual(ready.languages.Korean);
    expect(learningLanguageCapabilities('ko-KR', ready)).toEqual(ready.languages.Korean);
    expect(learningLanguageCapabilities('Korean', null)).toEqual({ save: false, review: false, known: false, exclude: false });
  });
  it.each([null, {}, { ...ready, version: 2 }, { ...ready, version: '1' }, { version: 1, languages: [] }, { version: 1, languages: { Korean: true } }])('불명확한 계약은 비활성화한다: %j', contract => {
    expect(normalizeLearningCapabilities(contract)).toEqual({ version: 1, languages: {} });
  });
  it.each(['save', 'review', 'known', 'exclude'])('%s가 빠지거나 false/문자열이면 전체 기능을 열지 않는다', action => {
    for (const value of [undefined, false, 'true', 1]) {
      const contract = structuredClone(ready); contract.languages.Korean[action] = value;
      expect(learningLanguageCapabilities('Korean', contract).save).toBe(false);
    }
  });
  it('표시 locale이나 미등록 목표어를 저장 언어로 인정하지 않는다', () => {
    expect(learningLanguageCapabilities('Vietnamese', ready).save).toBe(false);
    expect(learningLanguageCapabilities('zh-TW', null).save).toBe(true);
    expect(normalizeLearningCapabilities({ version: 1, languages: { ko: ready.languages.Korean } }).languages).toEqual({});
  });
  it('외부 응답을 변경하거나 참조를 공유하지 않는다', () => {
    const copy = structuredClone(ready), parsed = normalizeLearningCapabilities(copy);
    copy.languages.Korean.save = false;
    expect(parsed.languages.Korean.save).toBe(true);
    expect(() => { learningLanguageCapabilities('Korean', ready).save = false; }).toThrow(TypeError);
  });
});
