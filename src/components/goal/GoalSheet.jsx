'use client';
/**
 * 목표 창(GOAL-SHEET-001 — 오너 승인 목업 2026-10-26 KST 「목표 지정하는 부분도 디자인 더 깔끔하게. 언어 지정하고 시험 종류 고르고
 * 날짜 고르도록. 일정 내용은 지금보다 더 깔끔하게. 접수 일정은 굳이 안 넣어도 될 듯」 → 「권장대로」).
 *
 *   목표                                           ✕
 *   ┌ JLPT N3                               D-41 ┐   ← 날짜 목표가 있을 때만(장미 바탕)
 *   └ 12월 6일 일요일                            ┘
 *   시험 · 날짜 목표
 *   1 언어   (일본어) 중국어 영어 프랑스어
 *   2 시험   N5 N4 (N3) N2 N1 ┆시험 없이┆        ← 시험 일정이 없는 언어는 「목표 수준」(입문 A1 … C2)
 *   3 날짜   ◉ 12월 6일 일요일 / JLPT 2026년 2회   D-41
 *            공식 일정 · 10월 19일 확인 · 출처 ↗
 *   ───────
 *   하루 목표   복습 ━●━━ 5개 · 단어 담기 ━●━━ 5개
 *   [ 취소 ] [■ 저장 ■]
 *          시험 목표 지우기
 *
 * 휴대폰은 아래 시트, 넓은 화면(600 이상)은 가운데 창 — 내 정보 편집 시트(ProfileSheet)와 같은 모양이다. 그 시트의 겉모양은
 * 내 정보 화면 컨테이너(.pf)에 묶여 있어 이 창은 같은 값을 자기 파일(goal-sheet.css)에 둔다.
 * 접수 기간은 보이지 않는다(오너). 저장 길은 예전 목표 창(현황 GoalEditor)을 그대로 옮겼다 — persist · persistDaily ·
 * 열 부재 폴백 · 이 기기(as_dday) 폴백과 서버로 한 번 끌어올림. 무엇을 저장할지는 lib/goalSheet.goalSaveArgs가 정한다.
 *
 * 쓰는 법: <GoalSheet open={open} onClose={() => setOpen(false)} /> — 닫혀 있어도 붙여 둔다(이 기기 목표를 서버로 끌어올리는 일을 한다).
 * 프로필은 스스로 읽고 쓴다(useAuth) — 여는 화면이 넘길 것은 열림과 닫기뿐이다.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import { failureMessage } from '@/lib/errorMessage';
import { useDialogReturn } from '@/lib/useDialogReturn';
import { dailyGoals } from '@/lib/profileSummary';
import { LANG_NAME_KO } from '@/lib/constants';
import { examCheckedLine } from '@/lib/examSchedules';
import {
  CLEAR_GOAL_ARGS, CUSTOM_DATE, GOAL_LABEL_MAX, NO_EXAM, courseLevelChips, examKindOf, examLevelChips, goalDateCards,
  goalLanguages, goalNowView, goalSaveArgs, initialGoalState, isExamLabel, needsManualDate,
} from '@/lib/goalSheet';
import { useGoalCatalog } from '@/components/learn/GoalTrackTile';
import ActionIcon from '@/components/ActionIcon';
import './goal-sheet.css';

export default function GoalSheet({ open = false, onClose }) {
  const { user, profile, fetchProfile } = useAuth();
  const [local, setLocal] = useState(null);
  const [mounted, setMounted] = useState(false);
  // 과정 목록은 열었을 때만 받는다(현황은 미리 받아 둔다 — 같은 쿼리 키라 한 번).
  const catalog = useGoalCatalog(!!user?.id && open);

  useEffect(() => {
    setMounted(true);
    try { setLocal(JSON.parse(localStorage.getItem('as_dday') || 'null')); } catch {}
  }, []);

  // 서버 값 우선, 없으면 로컬 폴백. 매 렌더 새 객체면 아래 diff 메모가 매번 다시 계산되므로 메모한다.
  const ddayDate = profile?.dday_date;
  const ddayLabel = profile?.dday_label;
  const dday = useMemo(
    () => (ddayDate ? { date: ddayDate, label: ddayLabel || '' } : local),
    [ddayDate, ddayLabel, local],
  );

  // 서버가 비어 있고 로컬에 있으면 1회 끌어올림 (기기 마이그레이션)
  useEffect(() => {
    if (!user?.id || !profile || profile.dday_date || !local?.date) return;
    supabase.from('profiles')
      .update({ dday_date: local.date, dday_label: local.label || null })
      .eq('id', user.id)
      .then(({ error }) => { if (!error) fetchProfile(user.id, user.user_metadata); }, () => {});
    // 최초 1회
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.dday_date, local?.date]);

  if (!mounted || !open) return null;
  // 열 때마다 지금 값으로 채운다 — 창 안 상태는 열릴 때 새로 만든다.
  return <GoalSheetDialog dday={dday} catalog={catalog} onClose={onClose} onLocal={setLocal} />;
}

function GoalSheetDialog({ dday, catalog, onClose, onLocal }) {
  const { user, profile, fetchProfile } = useAuth();
  const toast = useToast();
  const [nowMs] = useState(() => Date.now());
  const [state, setState] = useState(() => initialGoalState({ profile, dday, catalog: catalog.data, nowMs }));
  const [busy, setBusy] = useState(false);
  const savedDaily = dailyGoals(profile);
  const [goalReview, setGoalReview] = useState(savedDaily.review);
  const [goalWords, setGoalWords] = useState(savedDaily.words);
  const titleId = useId();
  const sectionId = useId();
  const reviewId = useId();
  const wordsId = useId();
  const radioName = useId();

  const close = () => { if (!busy) onClose(); };
  const dialogRef = useDialogReturn(close);

  const langs = goalLanguages(catalog.data);
  const exam = examKindOf(state.lang);
  const levelChips = exam ? examLevelChips(exam) : courseLevelChips(catalog.data, state.lang);
  const cards = exam ? goalDateCards(exam, state.pick, nowMs) : [];
  const manual = needsManualDate(state, nowMs);
  const now = goalNowView(dday, nowMs);
  const picked = cards.find(c => c.key === state.card);
  const source = (picked || cards[0])?.rows[0]?.source;

  const edit = patch => setState(s => ({ ...s, ...patch, touched: true }));
  // 언어 · 급수를 바꾸면 시험 고르기가 지은 이름(「HSK 4급」)은 비운다 — 직접 적은 이름은 그대로.
  const relabel = () => (isExamLabel(state.label) ? { label: '' } : {});
  const chooseLang = lang => { if (lang !== state.lang) edit({ lang, pick: '', card: '', ...relabel() }); };
  const choosePick = key => {
    if (key === state.pick) { edit({ pick: '', card: '' }); return; }
    // 시험 날이 하나뿐이면 바로 고른다 — 고를 것이 하나면 누를 것도 없다.
    const next = exam && key !== NO_EXAM ? goalDateCards(exam, key, nowMs) : [];
    edit({ pick: key, card: next.length === 1 ? next[0].key : '', ...relabel() });
  };

  // 하루 목표 — 1 이상(배움 오늘 목표 산식이 나눗셈에 쓴다). 날짜 목표 저장과 같은 갱신에 싣는다.
  const daily = { goal_review: Math.max(1, goalReview), goal_words: Math.max(1, goalWords) };
  const dailyChanged = daily.goal_review !== savedDaily.review || daily.goal_words !== savedDaily.words;
  const plan = goalSaveArgs({ state, dday, profile, dailyChanged, nowMs });

  async function persistDaily() {
    if (busy || !user?.id) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update(daily).eq('id', user.id);
    if (error) toast(failureMessage('하루 목표를 저장하지 못했어요.', error), 'error');
    else fetchProfile(user.id, user.user_metadata);
    setBusy(false);
    if (!error) onClose();
  }

  async function persist(nextDate, nextLabel, nextLang, nextLevel) {
    if (busy) return;
    setBusy(true);
    // 로컬은 항상 기록 (오프라인 폴백)
    try {
      if (nextDate) localStorage.setItem('as_dday', JSON.stringify({ date: nextDate, label: nextLabel }));
      else localStorage.removeItem('as_dday');
    } catch {}
    onLocal(nextDate ? { date: nextDate, label: nextLabel } : null);
    if (user?.id) {
      const base = { dday_date: nextDate || null, dday_label: nextLabel || null, ...daily };
      // 목표 2컬럼은 마이그레이션(20260831010000_profile_goal.sql) 적용 후 생긴다.
      // 미적용 환경에서 미지 컬럼이 payload에 있으면 PostgREST가 요청 전체를 거부하므로,
      // 컬럼 오류일 때만 목표를 빼고 재시도한다(profile_levels_fr_zh 폴백과 같은 패턴).
      let { error } = await supabase.from('profiles')
        .update({ ...base, goal_lang: nextLang || null, goal_level: nextLevel || null })
        .eq('id', user.id);
      if (error && /column|schema/i.test(error.message || '')) {
        ({ error } = await supabase.from('profiles').update(base).eq('id', user.id));
        // 조용히 삼키면 "과정을 골랐는데 궤도가 안 뜬다"가 된다 — 무엇이 저장됐는지 말한다.
        if (!error && (nextLang || nextLevel)) toast('날짜는 저장했어요 — 목표 과정은 아직 준비 중이에요', 'info');
      }
      if (error) toast('동기화하지 못했어요. 이 기기에는 저장됐어요.', 'error');
      else fetchProfile(user.id, user.user_metadata);
    }
    setBusy(false);
    onClose();
  }

  // 날짜가 정해졌으면 날짜 목표째로, 아니면 하루 목표만(날짜 목표는 그대로) — goalSaveArgs.
  const save = () => {
    if (!plan) return;
    if (plan.kind === 'persist') persist(...plan.args);
    else persistDaily();
  };

  return (
    <div className="scrim gs-scrim" role="presentation" onClick={close}>
      <div className="gs-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef} tabIndex={-1}
        onClick={e => e.stopPropagation()}>
        <div className="gs-grip" aria-hidden="true" />
        <div className="gs-head">
          <h2 id={titleId}>목표</h2>
          <button type="button" className="gs-x" onClick={close} aria-label="닫기" disabled={busy}><ActionIcon name="close" /></button>
        </div>

        {now && (
          <div className="gs-now" role="group" aria-label={`지금 목표, ${now.name}, ${now.day}, ${now.dLabel}`}>
            <span className="gs-now__text" aria-hidden="true"><b>{now.name}</b><span>{now.day}</span></span>
            <span className="gs-now__d" aria-hidden="true">{now.dLabel}</span>
          </div>
        )}

        <section aria-labelledby={sectionId}>
          <h3 className="gs-sec" id={sectionId}>시험 · 날짜 목표</h3>

          <fieldset className="gs-step">
            <legend><span className="gs-step__n">1</span>언어</legend>
            <div className="gs-chips">
              {langs.map(lang => (
                <button key={lang} type="button" className="gs-chip" aria-pressed={lang === state.lang} disabled={busy}
                  onClick={() => chooseLang(lang)}>{LANG_NAME_KO[lang]}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="gs-step">
            <legend><span className="gs-step__n">2</span>{exam ? '시험' : '목표 수준'}</legend>
            <div className="gs-chips">
              {levelChips.map(lv => (
                <button key={lv.key} type="button" className="gs-chip" aria-pressed={lv.key === state.pick} disabled={busy}
                  aria-label={exam ? `${exam} ${lv.text}` : undefined} onClick={() => choosePick(lv.key)}>{lv.text}</button>
              ))}
              {exam && (
                <button type="button" className="gs-chip gs-chip--ghost" aria-pressed={state.pick === NO_EXAM} disabled={busy}
                  onClick={() => choosePick(NO_EXAM)}>시험 없이</button>
              )}
            </div>
            {!exam && !levelChips.length && (catalog.isError
              ? <p className="gs-note" role="alert">목표 수준을 불러오지 못했어요. <button type="button" className="gs-link" onClick={() => catalog.refetch()}>다시 시도</button></p>
              : <p className="gs-note" aria-busy={catalog.isFetching || undefined}>{catalog.isFetching ? '목표 수준 불러오는 중…' : '고를 수 있는 수준이 아직 없어요'}</p>)}
          </fieldset>

          <fieldset className="gs-step">
            <legend><span className="gs-step__n">3</span>날짜</legend>
            {exam && !state.pick && <p className="gs-note">시험을 고르면 날짜가 나와요</p>}
            {exam && state.pick && state.pick !== NO_EXAM && (cards.length ? <>
              <div className="gs-dates">
                {cards.map(c => (
                  <label key={c.key} className="gs-date">
                    <input type="radio" name={radioName} value={c.key} checked={state.card === c.key} disabled={busy}
                      onChange={() => edit({ card: c.key })} />
                    <span className="gs-date__body">
                      <span className="gs-date__day">{c.day}</span>
                      <span className="gs-date__sub">{c.name}{c.formats.map(f => <span key={f} className="gs-tag">{f}</span>)}</span>
                    </span>
                    <span className="gs-date__d">{c.dLabel}</span>
                  </label>
                ))}
                <label className="gs-date gs-date--other">
                  <input type="radio" name={radioName} value={CUSTOM_DATE} checked={state.card === CUSTOM_DATE} disabled={busy}
                    onChange={() => edit({ card: CUSTOM_DATE })} />
                  <span className="gs-date__body"><span className="gs-date__other">다른 날짜</span></span>
                </label>
              </div>
              <p className="gs-note">
                {examCheckedLine(cards.flatMap(c => c.rows))}
                {source && <> · <a href={source} target="_blank" rel="noopener noreferrer">출처 ↗</a></>}
              </p>
            </> : <p className="gs-note">이 급수는 아직 확인한 일정이 없어요 — 날짜를 직접 정해요</p>)}
            {manual && (
              <div className="gs-fields">
                <input type="date" className="gs-input" aria-label="목표 날짜" value={state.date} disabled={busy}
                  onChange={e => edit({ date: e.target.value })} />
                <input className="gs-input" aria-label="이름 (선택)" maxLength={GOAL_LABEL_MAX} placeholder="이름 (선택) · 예: 여행 전까지"
                  value={state.label} disabled={busy} onChange={e => edit({ label: e.target.value })} />
              </div>
            )}
          </fieldset>
        </section>

        {user?.id && (
          <fieldset className="gs-daily">
            <legend className="gs-sec">하루 목표</legend>
            {[
              { id: reviewId, label: '복습', value: goalReview, set: setGoalReview, max: 50 },
              { id: wordsId, label: '단어 담기', value: goalWords, set: setGoalWords, max: 30 },
            ].map(({ id, label, value, set, max }) => (
              <div key={id} className="gs-slider">
                <label htmlFor={id}>{label}</label>
                <input id={id} type="range" min={1} max={max} value={value} disabled={busy} onChange={e => set(Number(e.target.value))} />
                <output htmlFor={id}>{value}개</output>
              </div>
            ))}
          </fieldset>
        )}

        <div className="gs-actions">
          <button type="button" className="gs-pill" onClick={close} disabled={busy}>취소</button>
          <button type="button" className="gs-pill gs-pill--fill" onClick={save} disabled={!plan || busy} aria-busy={busy || undefined}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
        {dday && <button type="button" className="gs-clear" onClick={() => persist(...CLEAR_GOAL_ARGS)} disabled={busy}>시험 목표 지우기</button>}
      </div>
    </div>
  );
}
