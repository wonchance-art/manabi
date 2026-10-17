// STUDY-FOCUS-001 · STREAK-DEDUPE-001 (2026-10-17 KST) — 학습 순환 /study · /vocab 합성 로그인 점검 후속.
// ① 키보드: 누른 단추(「계속 →」 · 「결과 보기 →」 · 온보딩 선택 · 복습 시작/채점)가 사라지면 초점이 body로 떨어져 머리글부터
//    2~12번 Tab을 다시 눌러야 했다 → 다음에 누를 자리(첫 답 컨트롤 · 제목 · 「정답 확인하기」)로 잇는다. 화면은 바꾸지 않는다.
// ② 온보딩 선택 상태가 화면 읽기에 없었다(관심사 aria-pressed · 「배운 적 있어요」 aria-expanded).
// ③ /study 한 세션에 update_streak RPC가 문항 수만큼 나갔다 → 같은 계정 · 같은 날 · 10분 안의 반복은 RPC 없이 끝낸다.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../supabase', () => ({ supabase: { rpc } }));
import { ACTIVITY_DEDUPE_MS, forgetActivityDedupe, recordActivity } from '../streak';
import { firstAnswerControl } from '../focusAfterAction';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('firstAnswerControl — 새 문항의 첫 답 컨트롤', () => {
  const el = (name, disabled = false) => ({ name, disabled });
  const root = map => ({ querySelectorAll: selector => map[selector] || [] });
  it('보기 → 어순 칩 → 입력칸 → 그 밖의 버튼(발음 듣기 제외) 순, 잠긴 것은 건너뛴다', () => {
    expect(firstAnswerControl(root({ '.fr-quiz__opt': [el('a', true), el('b')], 'button:not(.fr-speak)': [el('x')] })).name).toBe('b');
    expect(firstAnswerControl(root({ '.fr-quiz__token': [el('t')], 'input[type="text"]': [el('i')] })).name).toBe('t');
    expect(firstAnswerControl(root({ 'input[type="text"]': [el('i')], 'button:not(.fr-speak)': [el('x')] })).name).toBe('i');
    expect(firstAnswerControl(root({ 'textarea': [el('w')] })).name).toBe('w');
    expect(firstAnswerControl(root({ 'button:not(.fr-speak)': [el('바로 문제로 →')] })).name).toBe('바로 문제로 →');
    expect(firstAnswerControl(root({ '.fr-quiz__opt': [el('a', true)] }))).toBeNull();
    expect(firstAnswerControl(null)).toBeNull();
  });
});

describe('초점 잇기 배선 — 화면은 그대로, 초점만', () => {
  it('/study: 문항이 바뀌면(첫 문항 제외) 첫 답 컨트롤로, 끝나면 「세션 완료」 제목으로', () => {
    const page = read('src/views/StudySessionPage.jsx');
    const effect = sliceBetween(page, 'const firstItemUidRef = useRef(item?.uid);', '}, [phase, item?.uid]);');
    expect(effect).toContain("if (phase !== 'answer' || !item?.uid || item.uid === firstItemUidRef.current) return;");
    expect(effect).toContain("focusIfFree(firstAnswerControl(root), root?.closest('.page-container'));");
    expect(page).toContain('<div key={item.uid} ref={itemRef} className="study-item">');
    const result = sliceBetween(page, 'const resultHeadingRef = useRef(null);', '}, [finished]);');
    expect(result).toContain("focusIfFree(heading, heading?.closest('.page-container'));");
    expect(page).toContain('<h1 ref={resultHeadingRef} tabIndex={-1}');
  });

  it('온보딩: 질문이 바뀌면 그 제목으로, 시작하면 첫 문항으로 — 첫 질문(진입)은 그대로. 선택 상태를 화면 읽기에 알린다', () => {
    const onboarding = read('src/views/StudyOnboarding.jsx');
    const effect = sliceBetween(onboarding, 'const prevPhaseRef = useRef(phase);', '}, [phase]);');
    expect(effect).toContain("if (prev === phase || prev === 'loading') return;");
    expect(effect).toContain("document.querySelector('.study-item')");
    expect(effect).toContain("focusIfFree(headingRef.current, headingRef.current?.closest('.page-container'));");
    expect(onboarding.match(/<h1 ref=\{headingRef\} tabIndex=\{-1\}/g)).toHaveLength(3);
    expect(onboarding).toContain('aria-pressed={interest === o.key}');
    expect(onboarding).toContain("aria-expanded={knowledge === 'learned'}");
  });

  it('/vocab: 새 카드의 「정답 확인하기」로 — 예전 일정 카드 · 새 일정 카드 둘 다, 카드마다 한 번', () => {
    const parts = read('src/components/vocab/ReviewCardParts.jsx');
    const hook = sliceBetween(parts, 'export function useRevealFocus(', 'export function useGradeBarFocus(');
    expect(hook).toContain('if (!front || disabled || cardKey == null || focusedKey.current === cardKey) return;');
    expect(hook).toContain("focusIfFree(button.current, button.current?.closest('.review-room-session'))");
    const legacy = read('src/views/VocabReview.jsx');
    expect(legacy).toContain("const revealRef = useRevealFocus(mode === 'flash' && !reviewFinished && !showAnswer && !!currentWord, currentWord?.id);");
    expect(legacy).toContain('<Button ref={revealRef} variant="secondary" size="lg" onClick={reveal} className="review-reveal-btn">');
    const fsrs = read('src/components/vocab/FsrsReviewSession.jsx');
    expect(fsrs).toContain('const revealRef = useRevealFocus(!!word0 && !revealed, current?.attempt?.id || null, busy || !current?.attempt);');
    expect(fsrs).toContain('<Button ref={revealRef} variant="secondary" size="lg" disabled={disabled || !current.attempt} className="review-reveal-btn"');
  });
});

describe('recordActivity — 같은 계정의 연이은 활동은 RPC 한 번', () => {
  const t0 = new Date('2026-10-17T03:00:00.000Z');
  const at = ms => new Date(t0.getTime() + ms);
  beforeEach(() => { forgetActivityDedupe(); rpc.mockReset(); rpc.mockResolvedValue({ error: null }); });
  afterEach(() => { forgetActivityDedupe(); });

  it('10분 안 · 같은 날의 반복은 RPC 없이 true, onUpdate(프로필 갱신)는 매번 부른다', async () => {
    const onUpdate = vi.fn();
    expect(await recordActivity('u1', onUpdate, { now: t0 })).toBe(true);
    expect(await recordActivity('u1', onUpdate, { now: at(60_000) })).toBe(true);
    expect(await recordActivity('u1', undefined, { now: at(ACTIVITY_DEDUPE_MS - 1) })).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('update_streak', { uid: 'u1' });
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('10분이 지나거나 · 다른 계정이거나 · 날짜가 바뀌면 다시 보낸다', async () => {
    await recordActivity('u1', undefined, { now: t0 });
    await recordActivity('u1', undefined, { now: at(ACTIVITY_DEDUPE_MS) });
    await recordActivity('u2', undefined, { now: at(ACTIVITY_DEDUPE_MS) });
    const beforeMidnight = new Date('2026-10-17T23:58:00.000Z');
    await recordActivity('u3', undefined, { now: beforeMidnight });
    await recordActivity('u3', undefined, { now: new Date('2026-10-18T00:01:00.000Z') }); // 3분 뒤지만 UTC 날짜가 바뀌었다
    expect(rpc).toHaveBeenCalledTimes(5);
  });

  it('실패는 기억하지 않는다(다음 호출이 다시 보낸다) · 동시에 온 호출은 한 RPC를 같이 기다린다', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'offline' } });
    expect(await recordActivity('u1', undefined, { now: t0 })).toBe(false);
    expect(await recordActivity('u1', undefined, { now: at(1000) })).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
    forgetActivityDedupe(); rpc.mockClear();
    let release; rpc.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
    const both = Promise.all([recordActivity('u9', undefined, { now: t0 }), recordActivity('u9', undefined, { now: t0 })]);
    release({ error: null });
    expect(await both).toEqual([true, true]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
