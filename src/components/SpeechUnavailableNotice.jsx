'use client';
// 소리를 끝내 내지 못했을 때 한 줄 안내(TTS-GAP-001) — useTTS가 알리는 이유를 기존 토스트로 보여 준다. 화면은 그리지 않는다.
// 이유별 문구 표 — 'no-voice'는 레벨 화면의 같은 상황 문구, 'failed'는 오너 확정 문구(2026-10-17 KST, 권장안 A).
import { useEffect } from 'react';
import { useToast } from '@/lib/ToastContext';
import { onSpeechUnavailable } from '@/lib/useTTS';
import { SPEECH_FAILED_MESSAGE, SPEECH_UNAVAILABLE_MESSAGE } from '@/lib/errorMessage';

export const SPEECH_NOTICES = Object.freeze({ 'no-voice': SPEECH_UNAVAILABLE_MESSAGE, failed: SPEECH_FAILED_MESSAGE });

export default function SpeechUnavailableNotice() {
  const toast = useToast();
  useEffect(() => onSpeechUnavailable((reason) => {
    const message = SPEECH_NOTICES[reason];
    if (message) toast(message, 'warning');
  }), [toast]);
  return null;
}
