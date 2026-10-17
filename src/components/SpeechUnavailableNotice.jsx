'use client';
// 소리를 끝내 내지 못했을 때 한 줄 안내(TTS-GAP-001) — useTTS가 알리는 이유를 기존 토스트로 보여 준다. 화면은 그리지 않는다.
// 이유별 문구 표 — 'failed'(서버 · 브라우저 음성 둘 다 실패)는 새 문구라 오너 확정 전이다(텍스트 목업 보고). 확정되면 여기에 한 줄.
import { useEffect } from 'react';
import { useToast } from '@/lib/ToastContext';
import { onSpeechUnavailable } from '@/lib/useTTS';
import { SPEECH_UNAVAILABLE_MESSAGE } from '@/lib/errorMessage';

export const SPEECH_NOTICES = Object.freeze({ 'no-voice': SPEECH_UNAVAILABLE_MESSAGE });

export default function SpeechUnavailableNotice() {
  const toast = useToast();
  useEffect(() => onSpeechUnavailable((reason) => {
    const message = SPEECH_NOTICES[reason];
    if (message) toast(message, 'warning');
  }), [toast]);
  return null;
}
