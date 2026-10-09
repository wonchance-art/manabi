'use client';
import { useMemo } from 'react';
import { useLearningCapabilities } from './useLearningCapabilities';
import { koreanStudyReady, studyLanguages } from './materialComposer';

// 작성·원본 화면의 「공부할 언어」 선택지 — 한국어는 계정 계약이 확인됐을 때만(확인 중·실패면 숨김).
// koreanChecking: 저장된 언어가 한국어인 자료가 확인 중에 다른 선택지를 잠깐 펼치지 않게 하는 데만 쓴다.
export function useStudyLanguages() {
  const korean = useLearningCapabilities('Korean');
  const ready = koreanStudyReady(korean);
  const languages = useMemo(() => studyLanguages(ready), [ready]);
  return { languages, koreanChecking: !!korean.isLoading };
}
