// STUDY-FOCUS-001 · STREAK-DEDUPE-001 (2026-10-17 KST) — 학습 순환 /study · /vocab 합성 로그인 점검 후속.
// ① 키보드: 누른 단추(「계속 →」 · 「결과 보기 →」 · 온보딩 선택 · 복습 시작/채점)가 사라지면 초점이 body로 떨어져 머리글부터
//    2~12번 Tab을 다시 눌러야 했다 → 다음 자리(문항의 질문/제목 머리 · 제목 · 「정답 확인하기」)로 잇는다. 화면은 바꾸지 않는다.
//    첫 답 컨트롤로 보내면 설명 · 문단 카드에서 내용을 건너뛰었다(리뷰 차단) → 머리(tabIndex −1 · 고리 없음)로, 보기 묶음은 그 머리가 이름.
// ② 온보딩 선택 상태가 화면 읽기에 없었다(관심사 aria-pressed · 「배운 적 있어요」 aria-expanded).
// ③ /study 한 세션에 update_streak RPC가 문항 수만큼 나갔다 → 같은 계정 · 같은 날 · 10분 안의 반복은 RPC 없이 끝낸다(UTC 자정 ±15분 제외).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../supabase', () => ({ supabase: { rpc } }));
import { ACTIVITY_DEDUPE_MS, MIDNIGHT_GUARD_MS, forgetActivityDedupe, recordActivity } from '../streak';
import { focusItemHead } from '../focusAfterAction';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('focusItemHead — 새 문항의 질문/제목 머리', () => {
  const setup = () => {
    const doc = { body: { isConnected: true } };
    doc.activeElement = doc.body;
    const node = name => ({ name, isConnected: true, disabled: false, ownerDocument: doc, focus() { doc.activeElement = this; } });
    const head = node('head'), input = node('input'), outside = node('outside');
    const root = { isConnected: true, ownerDocument: doc, contains: el => el === head || el === input,
      querySelector: selector => (selector === '[data-item-head]' ? head : null) };
    return { doc, head, input, outside, root };
  };
  it('초점이 떨어졌으면(body) 머리로 옮긴다', () => {
    const { doc, head, root } = setup();
    expect(focusItemHead(root)).toBe(true);
    expect(doc.activeElement).toBe(head);
  });
  it('autoFocus 입력칸이 이미 문항 안을 잡았으면 · 남의 초점이면 · 문항이 없으면 그대로', () => {
    const a = setup(); a.doc.activeElement = a.input;
    expect(focusItemHead(a.root)).toBe(false);
    expect(a.doc.activeElement).toBe(a.input);
    const b = setup(); b.doc.activeElement = b.outside;
    expect(focusItemHead(b.root)).toBe(false);
    expect(b.doc.activeElement).toBe(b.outside);
    expect(focusItemHead(null)).toBe(false);
    expect(focusItemHead({ ...setup().root, isConnected: false })).toBe(false);
  });
});

describe('초점 잇기 배선 — 화면은 그대로, 초점만', () => {
  it('/study: 문항이 바뀌면(첫 문항 제외) 그 문항 머리로, 끝나면 「세션 완료」 제목으로', () => {
    const page = read('src/views/StudySessionPage.jsx');
    const effect = sliceBetween(page, 'const firstItemUidRef = useRef(item?.uid);', '}, [phase, item?.uid]);');
    expect(effect).toContain("if (phase !== 'answer' || !item?.uid || item.uid === firstItemUidRef.current) return;");
    expect(effect).toContain("focusItemHead(root, root?.closest('.page-container'));");
    expect(page).not.toContain('firstAnswerControl');
    expect(page).toContain('<div key={item.uid} ref={itemRef} className="study-item">');
    const result = sliceBetween(page, 'const resultHeadingRef = useRef(null);', '}, [finished]);');
    expect(result).toContain("focusIfFree(heading, heading?.closest('.page-container'));");
    expect(page).toContain('<h1 ref={resultHeadingRef} tabIndex={-1}');
  });

  it('온보딩: 질문이 바뀌면 그 제목으로, 시작하면 첫 문항으로 — 첫 질문(진입)은 그대로. 선택 상태를 화면 읽기에 알린다', () => {
    const onboarding = read('src/views/StudyOnboarding.jsx');
    const effect = sliceBetween(onboarding, 'const prevPhaseRef = useRef(phase);', '}, [phase]);');
    expect(effect).toContain('if (prev === phase) return;');
    // 백필 리로드(기초 · 배운 적)로 돌아온 첫 그림만 — 표시를 한 번 읽고 지운다. 그 밖의 진입(loading → 무엇이든)은 그대로 둔다.
    expect(sliceBetween(effect, "if (prev === 'loading') {", "if (phase === 'session') {")).toContain("if (!resumed || phase !== 'session') return;");
    expect(effect).toContain("resumed = sessionStorage.getItem(FOCUS_AFTER_RELOAD) === '1'; sessionStorage.removeItem(FOCUS_AFTER_RELOAD);");
    expect(onboarding).toContain("try { sessionStorage.setItem(FOCUS_AFTER_RELOAD, '1'); } catch {}\n        window.location.reload();");
    expect(effect).toContain("document.querySelector('.study-item')");
    expect(effect).toContain("focusItemHead(item, item?.closest('.page-container'));");
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
    expect(legacy).toContain('<Button ref={revealRef} variant="secondary" size="lg" onClick={reveal} className="review-reveal-btn" aria-describedby={headwordId}>');
    expect(legacy).toContain('<ReviewHeadword word={currentWord} revealed={showAnswer} id={headwordId} />');
    const fsrs = read('src/components/vocab/FsrsReviewSession.jsx');
    expect(fsrs).toContain('const revealRef = useRevealFocus(!!word0 && !revealed, current?.attempt?.id || null, busy || !current?.attempt);');
    expect(fsrs).toContain('<Button ref={revealRef} variant="secondary" size="lg" disabled={disabled || !current.attempt} className="review-reveal-btn"');
    expect(fsrs).toContain('aria-describedby={headwordId} onClick={event => reveal(revealTrigger(event))}>정답 확인하기');
    expect(fsrs).toContain('<ReviewHeadword word={word} revealed={revealed} id={headwordId} />');
    expect(sliceBetween(parts, 'export function ReviewHeadword(', '</h2>;')).toContain('<h2 id={id} className="review-card__word"');
  });
});

describe('문항 머리 — 문항 종류마다 하나, 보기 묶음의 이름', () => {
  const HEAD = 'id={headId} tabIndex={-1} data-item-head=""';
  const page = read('src/views/StudySessionPage.jsx');
  const block = (from, to) => sliceBetween(page, from, to);
  it('설명 · 문단 카드는 맨 위 제목 줄이 머리 — 「바로 문제로 →」 · 재료 칩보다 앞', () => {
    const para = block("{item.type === 'paragraph' && (", '{/* ── 티칭 카드 ── */}');
    expect(para).toContain(`<div ${HEAD} style={{ fontSize: '0.75rem'`);
    expect(para.indexOf('data-item-head')).toBeLessThan(para.indexOf('className="chip"'));
    expect(para.indexOf('data-item-head')).toBeLessThan(para.indexOf('문제 풀기 →'));
    const teach = block("{item.type === 'teach' && (", '{/* ── 어휘: 뜻 고르기 ── */}');
    expect(teach).toContain(`<div ${HEAD} style={{ fontSize: '0.75rem'`);
    expect(teach.indexOf('data-item-head')).toBeLessThan(teach.indexOf('바로 문제로 →'));
  });
  it('뜻 고르기 · 독해는 질문이 머리이고 보기 묶음이 role=group으로 그 머리를 이름으로 쓴다', () => {
    const choice = block("{item.type === 'vocab-choice' && (", '{/* ── 어휘: 단서회상');
    expect(choice).toContain(`<span ${HEAD}>{item.word.word_text}</span>`);
    expect(choice).toContain('<div className="fr-quiz__opts fr-quiz__opts--col" role="group" aria-labelledby={headId}>');
    const reading = block("{item.type === 'read-meaning' && (", '{/* ── 격일 산출');
    expect(reading.match(/data-item-head=""/g)).toHaveLength(2); // 한국어 질문 · 원문 질문 — 둘 중 하나만 그려진다
    expect(reading).toContain('<div className="fr-quiz__opts fr-quiz__opts--col" role="group" aria-labelledby={headId}>');
  });
  it('입력 문항은 autoFocus 입력칸을 그대로 두고, 그 칸이 질문을 함께 읽는다(aria-describedby)', () => {
    const typed = block("{(item.type === 'vocab-cloze'", '{/* ── 공통 연습 엔진');
    expect(typed.match(/data-item-head=""/g)).toHaveLength(3); // 빈칸 · 타이핑 · 듣기
    expect(typed).toContain("placeholder={langName + '로 입력'} aria-describedby={headId}");
    const produce = block("{item.type === 'produce-writing' && (", '첨삭(AI');
    expect(produce.match(/data-item-head=""/g)).toHaveLength(2);
    expect(produce).toContain('rows={2} maxLength={200} autoFocus aria-describedby={headId}');
  });
  it('연습 엔진(문법 · 매칭 · 어순)도 같은 머리 · 묶음 — 부모의 headId를 받는다', () => {
    expect(block('<ExerciseEnginePrototype', '/>')).toContain('headId={headId}');
    const engine = read('src/components/ExerciseEnginePrototype.jsx');
    const exercise = sliceBetween(engine, 'function StudySessionExercise({', 'function StandaloneExerciseEngine(');
    expect(exercise).toContain("const head = headId ? { id: headId, tabIndex: -1, 'data-item-head': '' } : {};");
    expect(exercise).toContain("const labelledBy = headId ? { role: 'group', 'aria-labelledby': headId } : {};");
    expect(exercise.match(/className="fr-quiz__prompt"[^>]*\{\.\.\.head\}/g)).toHaveLength(3); // 매칭 · 고르기 · 어순
    expect(exercise.match(/\{\.\.\.labelledBy\}/g)).toHaveLength(4); // 매칭 두 열 · 고르기 보기 · 어순 칩
  });
  it('머리는 읽을 곳 — 초점 고리를 그리지 않는다', () => {
    expect(read('src/index.css')).toContain('.study-item [data-item-head]:focus, .study-item [data-item-head]:focus-visible { outline: none; }');
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

  it('UTC 자정 ±15분 안에서는 건너뛰지 않는다(10분 안 · 같은 날이어도)', async () => {
    expect(MIDNIGHT_GUARD_MS).toBe(15 * 60 * 1000);
    const utc = text => new Date(`${text}.000Z`);
    await recordActivity('u4', undefined, { now: utc('2026-10-17T23:40:00') });
    await recordActivity('u4', undefined, { now: utc('2026-10-17T23:44:59') }); // 자정 15분 1초 전 — 건너뜀
    expect(rpc).toHaveBeenCalledTimes(1);
    await recordActivity('u4', undefined, { now: utc('2026-10-17T23:45:00') }); // 15분 전부터 보낸다
    await recordActivity('u4', undefined, { now: utc('2026-10-17T23:50:00') });
    expect(rpc).toHaveBeenCalledTimes(3);
    await recordActivity('u5', undefined, { now: utc('2026-10-18T00:05:00') });
    await recordActivity('u5', undefined, { now: utc('2026-10-18T00:14:59') }); // 자정 뒤 15분 안
    expect(rpc).toHaveBeenCalledTimes(5);
    await recordActivity('u5', undefined, { now: utc('2026-10-18T00:15:00') }); // 마지막 성공(00:14:59) 1초 뒤 · 구간 밖 — 건너뜀
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
