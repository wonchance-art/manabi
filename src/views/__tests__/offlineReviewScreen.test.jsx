// F9 오프라인 복습 허용 — 학습자가 보는 것(오너 승인 2026-10-25 KST 「권장대로」).
// 이미 입장한 카드는 끊겨도 그대로 열린다(화면 변화 없음). 아직 입장하지 않은 카드에 닿았을 때만 조용한 끊김 카드:
//   ┌────────────────────────────────┐
//   │ 이 표현은 연결되면 볼 수 있어요   │  (굵게 — 끊김 안내 정본 REVIEW_CARD_OFFLINE_TITLE)
//   │ 복습 기록은 그대로 남아 있어요.   │  (보존 한 문장 — vocabOfflineLine(0) 재사용)
//   │ [다시 시도]                     │  (연결되면 저절로 다시 묻는다)
//   └────────────────────────────────┘
// 「복습을 준비하지 못했어요. 연결을 확인하고…」(실패 · alert)는 연결된 채 실패했을 때만이다.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import VocabReview, { REVIEW_PREP_FAILED } from '../VocabReview';
import { REVIEW_CARD_OFFLINE_TITLE, VOCAB_OFFLINE_TITLE, vocabOfflineLine } from '../../components/OfflineNotice';
import { LEARNING_ADMISSION_OFFLINE } from '../../lib/learningAdmission';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

vi.mock('next/link', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));
const word = { id: '20000000-0000-0000-0000-000000000002', word_text: '未入場', meaning: '보이면 안 되는 뜻' };
const render = admissionError => renderToStaticMarkup(createElement(VocabReview, { vocab: [word], reviewWords: [word], reviewIdx: 0,
  currentWord: undefined, admissionPending: false, admissionError, reviewMode: 'flash', contextOptions: [], onAdmissionRetry: () => {} }));

describe('끊긴 동안 아직 입장하지 않은 카드', () => {
  it('조용한 끊김 카드(status) — 제목 · 보존 한 줄 · 다시 시도, 단어 · 뜻은 보이지 않는다', () => {
    const html = render(Object.assign(new Error(LEARNING_ADMISSION_OFFLINE), { code: LEARNING_ADMISSION_OFFLINE }));
    expect(html).toContain(REVIEW_CARD_OFFLINE_TITLE);
    expect(html).toContain(vocabOfflineLine(0));
    expect(html).toContain('다시 시도');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain(REVIEW_PREP_FAILED);
    expect(html).not.toContain(word.word_text); expect(html).not.toContain(word.meaning);
  });

  it('연결된 채 실패는 지금처럼 「복습을 준비하지 못했어요」(alert)다', () => {
    const html = render(Object.assign(new Error('fsrs_admission_unavailable'), { status: 503 }));
    expect(html).toContain(REVIEW_PREP_FAILED); expect(html).toContain('role="alert"');
    expect(html).not.toContain(REVIEW_CARD_OFFLINE_TITLE);
  });

  it('문구는 화면 문구 표준을 따른다 — 해요체 · 두 문장 이내 · 기존 끊김 안내와 같은 결', () => {
    expect(REVIEW_CARD_OFFLINE_TITLE).toMatch(/연결되면 .+ 수 있어요$/);
    expect(VOCAB_OFFLINE_TITLE).toMatch(/연결되면 .+ 수 있어요$/);
    expect(`${REVIEW_CARD_OFFLINE_TITLE}. ${vocabOfflineLine(0)}`.split(/[.?!]\s/).length).toBeLessThanOrEqual(2);
  });
});

describe('VocabPage 배선', () => {
  const page = readFileSync(new URL('../VocabPage.jsx', import.meta.url), 'utf8');
  it('복습방 위 「준비하지 못했어요」 알림은 끊김 기다림에는 뜨지 않는다', () => {
    expect(page).toContain("{admission.error && !isAdmissionOfflineError(admission.error) && tab !== 'review' && !isOffline && <div role=\"alert\" className=\"card\">");
  });
  it('이 기기의 입장 응답이 바꾼 한도는 FSRS 줄이 받는다(GET 생략) — 받지 못하면 지금처럼 다시 읽는다', () => {
    const quota = sliceBetween(page, 'const admission = useLearningAdmission({', '} });');
    expect(quota).toContain("if (meta?.source === 'admit' && fsrsControllerRef.current?.adoptAdmission?.(quota)) return;");
    expect(quota.indexOf('adoptAdmission')).toBeLessThan(quota.lastIndexOf('fsrsControllerRef.current?.refresh();'));
  });
  it('서버가 질문을 거절한 카드(다른 기기가 먼저 복습 · 제외 · 등록 · 삭제)는 「준비하지 못했어요」로 멈추지 않고 건너뛴다', () => {
    expect(page).toContain("const ADMISSION_GONE_CODES = new Set(['fsrs_card_not_due', 'fsrs_card_excluded', 'fsrs_already_enrolled', 'fsrs_card_not_found']);");
    const effect = sliceBetween(page, 'const admissionGone =', '}, [admissionGone, candidateId, questionKey]);');
    expect(effect).toContain('ADMISSION_GONE_CODES.has(admission.error?.code)');
    expect(effect).toContain('admission.controller.dismissError();');
    expect(effect).toContain('skipCard(candidateId);');
  });
  it('보낼함이 서버에 닿으면 학습 목록을 한 번 다시 읽는다(세션 중엔 복습방 전용 조회는 미룬다)', () => {
    const effect = sliceBetween(page, '// 보낼함이 서버에 닿았다', '}, [user?.id, queryClient]);');
    expect(effect).toContain("window.addEventListener('manabi:outbox-flushed', reread);");
    expect(effect).toContain('invalidateVocabularyLearning(queryClient, actorId, { deferReviewRoom: inSessionRef.current })');
  });
});
