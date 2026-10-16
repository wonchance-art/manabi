import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import VocabReview from '../VocabReview';
import FsrsReviewSession from '../../components/vocab/FsrsReviewSession';
import { ReviewIntroCard } from '../../components/vocab/ReviewCardParts';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { buildPracticeEvent } from '../../lib/practiceEvents';

// REV-SCOPE-R1B-1 화면 계약(설계 §3-3 · §5-3 · §5-5 · §5-6 · §6-1 ④⑥ · §8 증거 모델 줄).
vi.mock('../../components/learning/VocabularyContexts', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ children, ...props }) => createElement('a', props, children) }));
const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const page = read('src/views/VocabPage.jsx');
const zh = { id: 'z1', word_text: '早餐', meaning: '아침 식사', furigana: 'zǎo cān', language: 'Chinese' };
const ja = { id: 'j1', word_text: '駅', meaning: '역', furigana: 'えき', language: 'Japanese' };
const kana = { id: 'j2', word_text: 'きっかけ', meaning: '계기', furigana: 'きっかけ', language: 'Japanese' };
const fr = { id: 'f1', word_text: 'bonjour', meaning: '안녕하세요', language: 'French' };
const card = (word, extra = {}) => renderToStaticMarkup(createElement(VocabReview, { vocab: [word], reviewWords: [word], reviewIdx: 0, currentWord: word,
  effectiveMode: 'flash', reviewFinished: false, showAnswer: false, contextOptions: [], speak() {}, ttsSupported: true, setShowHint() {}, ...extra }));
const buttons = html => html.match(/<button[^>]*class="review-score-btn[^"]*"[^>]*>/g) || [];

describe('카드 앞뒤(§3-3) — 앞면 = 글자만, 뒷면 = 뜻 + 읽기 + 소리', () => {
  it('앞면에는 읽기 · 뜻 · 소리가 없고, 채점 막대는 하단에 있지만 잠겨 있다', () => {
    for (const word of [zh, ja]) {
      const html = card(word);
      expect(html).toContain(word.word_text);
      expect(html).not.toContain(word.furigana);
      expect(html).not.toContain(word.meaning);
      expect(html).not.toContain('<rt>');
      expect(html).not.toContain('발음 듣기');
      expect(buttons(html)).toHaveLength(4);
      for (const button of buttons(html)) expect(button).toContain('disabled=""');
      expect(html).toContain('정답 확인하기');
      expect(html).toContain('review-grade-bar is-locked');
    }
  });

  it('채점 막대는 화면 최하단 고정 — 카드 길이와 무관한 같은 자리, 세션은 막대 높이만큼 비운다(M09 6158372690)', () => {
    const css = read('src/components/web/review-room.css');
    const bar = sliceBetween(css, '.review-grade-bar {', '}');
    expect(bar).toContain('position:fixed');
    expect(bar).toContain('bottom:0');
    expect(bar).not.toContain('sticky');
    expect(css).toContain('.review-room-session:has(.review-grade-bar) { padding-bottom:');
    expect(css).toContain('body:has(.review-grade-bar) .review-known-undo { bottom:');
  });
  it('뒷면: 일본어 한자어는 한자 위 후리가나(ruby), 중국어는 병음, 둘 다 ▷ 듣기 — 발음 판정 문구', () => {
    const jaBack = card(ja, { showAnswer: true });
    expect(jaBack).toContain('<ruby>駅<rt>えき</rt></ruby>');
    expect(jaBack).toContain('역');
    expect(jaBack).toContain('aria-label="駅 발음 듣기"');
    expect(jaBack).toContain('뜻이나 발음 중 하나라도 막혔다면 다시');
    const zhBack = card(zh, { showAnswer: true });
    expect(zhBack).toContain('zǎo cān');
    expect(zhBack).toContain('아침 식사');
    expect(zhBack).toContain('뜻이나 발음 중 하나라도 막혔다면 다시');
  });
  it('발음 판정 대상이 아니면(가나만 · 프랑스어 · 읽기 없음) 「뜻을 못 떠올렸다면 다시」 — 소리는 그대로', () => {
    for (const word of [kana, fr, { ...zh, furigana: '' }]) {
      const html = card(word, { showAnswer: true });
      expect(html).toContain('뜻을 못 떠올렸다면 다시');
      expect(html).not.toContain('뜻이나 발음');
    }
    expect(card(kana, { showAnswer: true })).not.toContain('<rt>');
  });
  it('음성을 쓸 수 없으면 ▷를 숨기고 읽기 글만 낸다(§5-6 음성 불가)', () => {
    const html = card(zh, { showAnswer: true, ttsSupported: false });
    expect(html).toContain('zǎo cān');
    expect(html).not.toContain('발음 듣기');
  });
  it('버튼은 넷뿐 — 「무엇을 놓쳤나」 같은 추가 질문 없음', () => {
    const html = card(zh, { showAnswer: true });
    expect(buttons(html)).toHaveLength(4);
    expect(html).not.toMatch(/무엇을 놓쳤|뜻을 놓쳤|발음을 놓쳤/);
  });
  it('새 일정(FSRS) 카드도 같은 규격 — 앞면 읽기 없음, 뒷면 병음 · 듣기 · 문구(FSRS 화면에도 듣기)', () => {
    const controller = { question: async () => true, reveal() {}, grade() {}, undo() {}, refresh() {}, leave() {}, getSnapshot: () => ({}) };
    const review = { busy: false, ready: [], registryAvailable: true, enabled: true, completed: 0, controller,
      current: { cardId: 'z1', phase: 'question', attempt: { id: 'a' }, word: zh } };
    const front = renderToStaticMarkup(createElement(FsrsReviewSession, { review, embedded: true, cardId: 'z1', stepKey: 's', onExit() {}, speak() {}, ttsSupported: true }));
    expect(front).not.toContain('zǎo cān');
    expect(front).not.toContain('아침 식사');
    expect(front).not.toContain('review-room-session-nav'); // 진행 · 나가기는 복습방 상단바가 진다
    const back = renderToStaticMarkup(createElement(FsrsReviewSession, { review: { ...review, current: { ...review.current, phase: 'revealed', previews: {}, previewAt: '2026-10-13T00:00:00Z' } },
      embedded: true, cardId: 'z1', stepKey: 's', onExit() {}, speak() {}, ttsSupported: true }));
    expect(back).toContain('zǎo cān');
    expect(back).toContain('aria-label="早餐 발음 듣기"');
    expect(back).toContain('뜻이나 발음 중 하나라도 막혔다면 다시');
  });
});

describe('처음 보는 표현(§6-1 ⑥) — 채점 없는 첫 학습 카드', () => {
  it('머리 「처음 보는 표현」 · 버튼 「다음 →」 · 안내 「잠시 뒤 다시 물어볼게요」 — 전부 보여 주고 채점 버튼은 없다', () => {
    const html = renderToStaticMarkup(createElement(ReviewIntroCard, { word: zh, speak() {}, ttsSupported: true, onNext() {} }));
    expect(html).toContain('처음 보는 표현');
    expect(html).toContain('다음 →');
    expect(html).toContain('잠시 뒤 다시 물어볼게요');
    expect(html).toContain('아침 식사');
    expect(html).toContain('zǎo cān');
    expect(buttons(html)).toHaveLength(0);
  });
  it('복습방은 새 표현의 첫 등장을 처음 보는 표현으로 열고, 넘기면 3장 뒤 채점 단계를 끼운다(일정 저장 없음)', () => {
    const intro = sliceBetween(page, 'const advanceIntro = trigger => {', '\n  };');
    expect(intro).toContain('insertAfterIntro(reviewQueueRef.current, reviewIdxRef.current)');
    expect(intro).not.toMatch(/recordReviewCompleted|persistVocabGrade|controller\.grade|calculateFSRS/);
    expect(page).toContain('const queue = initialSteps(planned);');
  });
});

describe('집중 연습(§6-1 ④⑤) — FSRS · 예전 일정 · 새 표현 한도 호출 0회', () => {
  const practiceSource = ['const startPractice = (words', 'const advancePractice = missed =>', 'const handlePractice = rating =>']
    .map(anchor => sliceBetween(page, anchor, '\n  };')).join('\n');
  it('연습 경로는 채점 · 일정 · 한도 함수를 부르지 않는다 — 기록은 logReviewEvents(source practice) 하나', () => {
    for (const forbidden of ['recordReviewCompleted', 'persistVocabGrade', 'scoreMutation', 'calculateFSRS', 'controller.grade', 'controller.question',
      'controller.reveal', 'admission.controller', 'registerNewIntro', 'handleScore', 'saveIntroIds']) {
      expect(practiceSource, forbidden).not.toContain(forbidden);
    }
    expect(practiceSource).toContain('buildPracticeEvent({ word, qtype, scope: practice.scopeKey, result })');
    expect(practiceSource).toContain('logReviewEvents(user.id, [event])');
    // 연습 화면에는 미루기(일정 쓰기)가 없고, 입장권 효과는 복습 탭에서만 돈다.
    const practiceView = sliceBetween(page, "tab === 'practice' && practice ? (", '      ) : null}');
    expect(practiceView).not.toContain('handleSkip');
    expect(practiceView).toContain('handleScore={handlePractice}');
    expect(page).toContain("if (tab === 'review' && !reviewFinished && candidateId !== undefined) admission.controller.question(candidateId, questionKey);");
  });
  it('실제 연습 핸들러를 실행하면 연습 기록 한 줄만 남는다(일정 · 한도 0회)', () => {
    const handler = sliceBetween(page, '  const handlePractice = rating => {', '\n  };') + '\n  };';
    const spies = { logReviewEvents: vi.fn(), advancePractice: vi.fn() };
    const run = new Function('practiceWord', 'practice', 'user', 'effectiveMode', 'buildPracticeEvent', 'logReviewEvents', 'advancePractice',
      `${handler}\nreturn handlePractice;`);
    const handlePractice = run(zh, { ids: ['z1'], idx: 0, finished: false, scopeKey: '/vocab?lang=Chinese' }, { id: 'actor' }, 'flash', buildPracticeEvent, spies.logReviewEvents, spies.advancePractice);
    handlePractice(1);
    expect(spies.logReviewEvents).toHaveBeenCalledWith('actor', [{ lang: 'Chinese', source: 'practice', item_key: 'z1', correct: false,
      detail: { qtype: 'self', scope: '/vocab?lang=Chinese', result: 'unknown' } }]);
    expect(spies.advancePractice).toHaveBeenCalledWith(true);
  });
  it('화면: 「집중 연습 · 일정은 바뀌지 않아요」 · 두 버튼(몰랐어요 / 알았어요) · 미루기 없음', () => {
    const html = card(zh, { showAnswer: true, practice: { total: 3, unknown: 0 }, metaLabel: '집중 연습 · 1 / 3', handleSkip() {} });
    expect(html).toContain('집중 연습 · 일정은 바뀌지 않아요');
    expect(html).toContain('몰랐어요');
    expect(html).toContain('알았어요');
    expect(html).not.toContain('스킵');
    expect(html).not.toContain('review-score-btn--hard');
    const done = card(zh, { reviewFinished: true, practice: { total: 3, unknown: 2, onFragile() {} } });
    expect(done).toContain('일정은 바뀌지 않았어요.');
    expect(done).toContain('흐릿 · 위험 보기');
  });
  it('타이핑 · 리스닝은 집중 연습의 갈래 — 본 복습은 플래시뿐', () => {
    expect(page).toContain("['flash', '스스로 확인'], ['typing', '뜻 쓰기'], ['listening', '듣고 고르기']");
    expect(page).toMatch(/const effectiveMode = tab === 'practice'\n\s+\? usableVocabReviewMode\([\s\S]*?\n\s+: 'flash';/);
    expect(page).not.toContain('id="review-mode"');
  });
});

describe('세션 · 끝 화면 · 상태 문구(§5-5 · §5-6)', () => {
  it('끝 화면: 「오늘 몫 끝」 · 「18개 · 다시 4」 · 학습 단계가 남으면 「「다시」 N개는 잠시 뒤 다시 나와요」 — 「전체 복습 끝」이라고 하지 않는다', () => {
    const html = card(zh, { reviewFinished: true, finish: { scopeLabel: '중국어 · HSK 2', total: 18, again: 4, waiting: { count: 4, ready: false, nextAt: null },
      outOfScope: { count: 22, label: '중국어', onClick() {} } } });
    for (const text of ['중국어 · HSK 2', '오늘 몫 끝', '18개 · 다시 4', '「다시」 4개는 잠시 뒤 다시 나와요', '잠시 뒤 이어 하기', '범위 밖 중국어 22개 이어서']) expect(html).toContain(text);
    expect(html).not.toContain('전체 복습 끝');
    const cut = card(zh, { reviewFinished: true, finish: { total: 20, cutRemaining: 38, onContinueCut() {} } });
    expect(cut).toContain('20개 끝 · 오늘 몫 38개 남음');
    expect(cut).toContain('이어서 38개');
  });
  it('§5-6 상태 12종 문구가 화면 코드에 있다', () => {
    const bar = read('src/components/vocab/ReviewScopeBar.jsx');
    const notice = read('src/components/OfflineNotice.jsx');
    const copies = [
      [bar, '이 범위에는 지금 복습할 표현이 없어요'], [bar, "empty ? '집중 연습' : '지금 집중 연습으로 보기'"],
      [page, '<h2>범위를 불러오지 못했어요.</h2><p>전체로 바꾸지 않았어요.'],
      [bar, '(새 표현 한도) · 나머지 ${count.newLocked}개는 내일'],
      [bar, '밀린 복습부터 — 잊기 쉬운 순서로.'],
      [page, '멈춘 복습 이어 하기 ('],
      [bar, '뜻이 없는 표현 {count.noMeaning}개는 복습에서 빠져요.'], [read('src/views/VocabList.jsx'), '뜻 채우기</button>'],
      [read('src/components/learning/VocabularyContexts.jsx'), '{primary&&'],
      [page, '아는 단어로 옮겼어요 <button'],
      [notice, '연결되면 이어서 보낼게요.'],
      [read('src/components/vocab/ReviewCardParts.jsx'), 'if (!ttsSupported || !speak) return null;'],
      [page, 'role="group" aria-label="연습 방식"'],
      [page, '`문법 ${dueGrammarCount}개 →`'],
    ];
    for (const [source, text] of copies) expect(source, text).toContain(text);
  });
  it('세션 길이 칩 「5분 · 약 20개 · 50개 · 전부」 = 서로 다른 카드 수, 이어 하기는 세션 저장소(24시간)', () => {
    expect(page).toContain('`5분 · 약 ${length}개`');
    expect(page).toContain('`전부 ${session.total}`');
    expect(page).toContain('writeResume(storage, user.id, value)');
    expect(page).toContain('window.sessionStorage');
    expect(page).not.toContain('멈춘 복습 이어가기 ·');
  });
});

describe('「다시」 재노출(예전 일정) — 입장권 · 일정 저장 없이 확인만(M09 #1337 6171362813)', () => {
  // 입장 RPC(learning_admit_legacy)는 채점된 적 있고 next_review_at이 미래인 카드를 learning_card_not_due(409)로 거절한다.
  // 예전 일정의 채점은 next_review_at을 최소 하루 뒤로 두므로, 재노출이 입장권을 다시 받으면 세션이 「복습을 준비하지 못했어요」로 멈춘다.
  const candidate = sliceBetween(page, 'const candidateWord = useMemo', '}, [reviewQueue, reviewIdx');
  const score = sliceBetween(page, 'const handleScore = async (rating) => {', 'const actorId = user?.id;');
  const skip = sliceBetween(page, 'const handleSkip = () => {', 'const tomorrow');

  it('재노출 단계는 입장권 후보가 아니다 — 지금 카드는 againWord로 바로 연다', () => {
    expect(candidate).toContain("step.phase !== 'again'");
    expect(page).toMatch(/const currentWord = againWord \|\|/);
  });

  it('재노출의 채점 · 미루기는 기록 · 일정 저장 없이 다음으로 — 「다시」면 한 번 더 끝에', () => {
    expect(score).toContain('goNextReview(rating === 1 ? againWord.id : null)');
    expect(score).not.toContain('recordReviewCompleted');
    expect(skip).toContain('goNextReview()');
    expect(skip).not.toContain('scoreMutation');
  });

  it('끝 화면 「다시」 수는 같은 표현을 한 번으로 센다', () => {
    expect(page).toContain("new Set(reviewQueue.filter(step => step.phase === 'again').map(step => step.id)).size");
  });
});

describe('「다시」 재노출 — 준비된 카드로 세고, 건너뛰기 판정에서도 살린다(M09 #1337 6173065866)', () => {
  // 지금 카드가 준비됐는지(stepReady)에 againWord가 빠지면, 아래 effect가 재노출을 「준비된 카드 없음」으로 보고
  // 다음 유효 단계로 건너뛰거나(마지막이면) 세션을 끝냈다 — 첫 「다시」 뒤 재노출 없이 「오늘 몫 끝」.
  const block = sliceBetween(page, '  const stepValid = step =>', '  // 새 일정 학습 단계');
  const run = ({ queue, idx, againWord, candidateWord, fsrsStepWord, vocab }) => {
    const calls = { idx: null, finished: 0 };
    const env = {
      reviewQueue: queue, reviewIdx: idx, againWord, candidateWord, fsrsStepWord, vocab,
      reviewFinished: false, isLoading: false, vocabError: null, koreanCapabilities: { isLoading: false },
      fsrsReview: { registryAvailable: true, controller: { canLegacy: () => true } }, fsrsStepValid: () => true,
      reviewSupported: () => true, reviewAvailable: row => !row.last_reviewed_at,
      setReviewIdx: value => { calls.idx = value; }, finishRun: () => { calls.finished += 1; }, useEffect: fn => fn(),
    };
    new Function(...Object.keys(env), block)(...Object.values(env));
    return calls;
  };
  const graded = { id: 'a', last_reviewed_at: '2026-10-15T00:00:00Z' };

  it('마지막 단계가 재노출이면 그 카드를 연다 — 세션을 끝내지 않는다', () => {
    const calls = run({ queue: [{ id: 'a', engine: 'legacy', phase: 'question' }, { id: 'a', engine: 'legacy', phase: 'again' }],
      idx: 1, againWord: graded, vocab: [graded] });
    expect(calls).toEqual({ idx: null, finished: 0 });
  });

  it('지금 카드가 빠졌을 때 다음 유효 단계 찾기에서도 재노출은 유효하다(채점돼 reviewAvailable이 거짓이어도)', () => {
    const gone = { id: 'b', last_reviewed_at: null, is_excluded: true };
    const calls = run({ queue: [{ id: 'b', engine: 'legacy', phase: 'question' }, { id: 'a', engine: 'legacy', phase: 'again' }],
      idx: 0, vocab: [gone, graded] });
    expect(calls.idx).toBe(1);
    expect(calls.finished).toBe(0);
  });

  it('제외 · 아는 단어가 된 재노출은 건너뛴다', () => {
    const known = { ...graded, is_known: true };
    const calls = run({ queue: [{ id: 'b', engine: 'legacy', phase: 'question' }, { id: 'a', engine: 'legacy', phase: 'again' }],
      idx: 0, vocab: [{ id: 'b', is_excluded: true }, known] });
    expect(calls.finished).toBe(1);
  });
});
