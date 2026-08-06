import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('../../lib/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock('../../lib/learn/progressStore', () => ({
  getLessonProgress: vi.fn(),
  recordLessonCompleted: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {},
}));

import { unwrapAccountExportResults } from '../AccountSettings';
import {
  isConversationRequestCurrent,
} from '../ConversationPanel';
import {
  LessonCompletionActions,
  readLessonCompleted,
} from '../LessonCompletionCta';
import {
  isReadingTestRequestCurrent,
} from '../ReadingTest';
import { VoiceOption } from '../TtsVoicePicker';
import {
  persistQuestReviewGrade,
} from '../world/QuestReview';
import { getTtsCapabilities } from '../../lib/useTTS';

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('components C-04~C-13 reliability fixes', () => {
  it('실제 Web Speech 또는 서버 audio 재생 경로가 있을 때만 TTS를 지원한다', () => {
    expect(getTtsCapabilities(null).supported).toBe(false);
    expect(getTtsCapabilities({ speechSynthesis: {}, SpeechSynthesisUtterance() {} })).toEqual({
      webSpeech: true,
      serverAudio: false,
      supported: true,
    });
    expect(getTtsCapabilities({
      fetch() {},
      Audio() {},
      URL: { createObjectURL() {} },
    })).toEqual({ webSpeech: false, serverAudio: true, supported: true });
  });

  it('자료가 바뀌거나 새 요청이 시작되면 이전 회화·독해 응답을 거부한다', () => {
    const requestRef = { current: 7 };
    const materialRef = { current: 'material-b' };

    expect(isConversationRequestCurrent(requestRef, 7, materialRef, 'material-b')).toBe(true);
    expect(isConversationRequestCurrent(requestRef, 7, materialRef, 'material-a')).toBe(false);
    expect(isReadingTestRequestCurrent(requestRef, 6, materialRef, 'material-b')).toBe(false);

    expect(source('../ConversationPanel.jsx')).toContain('skipPersistRef.current = true');
    expect(source('../ReadingTest.jsx')).toContain('skipPersistRef.current = true');
  });

  it('음성 옵션의 선택과 미리듣기를 형제 버튼으로 렌더한다', () => {
    const markup = renderToStaticMarkup(
      <VoiceOption
        voice={{ voiceURI: 'voice-1', name: 'Kyoko', lang: 'ja-JP', localService: true }}
        selected
        onPick={() => {}}
        onPreview={() => {}}
      />,
    );
    const firstOpen = markup.indexOf('<button');
    const firstClose = markup.indexOf('</button>', firstOpen);
    const secondOpen = markup.indexOf('<button', firstOpen + 1);

    expect(markup).toContain('role="option"');
    expect(firstClose).toBeLessThan(secondOpen);
    expect(markup.match(/<button/g)).toHaveLength(2);
  });

  it('복습 저장 실패를 성공 진행으로 바꾸지 않는다', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ update })) };

    await expect(persistQuestReviewGrade(client, 'word-1', { interval: 3 }, '2026-08-06T00:00:00.000Z'))
      .resolves.toBeUndefined();
    expect(eq).toHaveBeenCalledWith('id', 'word-1');

    eq.mockResolvedValueOnce({ error: new Error('offline') });
    await expect(persistQuestReviewGrade(client, 'word-1', { interval: 3 })).rejects.toThrow('offline');
  });

  it('계정 export 쿼리 하나라도 실패하면 부분 bundle을 거부한다', () => {
    const ok = [
      { data: { id: 'u1' }, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ];
    expect(unwrapAccountExportResults(ok).profile).toEqual({ id: 'u1' });

    const partial = [...ok];
    partial[3] = { data: [], error: new Error('denied') };
    expect(() => unwrapAccountExportResults(partial)).toThrow('progress');

    const missing = [...ok];
    missing[6] = undefined;
    expect(() => unwrapAccountExportResults(missing)).toThrow('pdfs');
  });

  it('레슨 조회 실패를 전파하고 오류 안내를 렌더한다', async () => {
    const lesson = { id: 'l1', lang: 'en', slug: 'unit-1' };
    await expect(readLessonCompleted(
      vi.fn().mockResolvedValue({ completedSlugs: ['unit-1'] }),
      'u1',
      lesson,
    )).resolves.toBe(true);
    await expect(readLessonCompleted(vi.fn().mockRejectedValue(new Error('offline')), 'u1', lesson))
      .rejects.toThrow('offline');

    const markup = renderToStaticMarkup(
      <LessonCompletionActions
        completed={false}
        disabled={false}
        error="저장 실패"
        lessonId="l1"
        nextLesson={null}
        onComplete={() => {}}
      />,
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('저장 실패');
  });

  it('듣기 세션 변경과 NPC timer 정리를 명시한다', () => {
    const listen = source('../ListenControls.jsx');
    const npc = source('../world/NpcDialog.jsx');

    expect(listen).toContain('sessionRef.current !== sessionId');
    expect(listen).toContain('}, [text, language]);');
    expect(npc).toContain('rollTimerRef.current = null');
    expect(npc).toContain('useEffect(() => () =>');
  });

  it('신고·계정 삭제 dialog가 이름·Escape·포커스 복귀 계약을 갖는다', () => {
    for (const path of ['../ReportMaterialButton.jsx', '../AccountSettings.jsx']) {
      const text = source(path);
      expect(text).toContain('role="dialog"');
      expect(text).toContain('aria-modal="true"');
      expect(text).toContain("event.key === 'Escape'");
      expect(text).toContain('previousFocus?.focus?.()');
    }
  });
});
