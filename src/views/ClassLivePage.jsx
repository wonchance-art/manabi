'use client';

/**
 * 폰 입력판 `/class/[team]/live` (v2-AB R1 §5, #1077 5603827169) — 오너 전용.
 *
 * 수업 중 폰으로 단어·표현을 치면 ⑴ 그날 정리본(자료 행 하나)의 **새 문단**으로 붙고
 * ⑵ 파이프라인이 **그 줄만** 분석하며(runPreservedReanalysis · selected = 새 줄) ⑶ Broadcast로
 * 태블릿 판에 「다시 읽어라」 신호를 보낸다. 정리본이 없으면 첫 항목과 함께 태어난다.
 * 분석이 막히면(429·오프라인) 항목은 뜻 없이 들어가고 다음 추가가 재시도한다.
 * 정리본 복사 = 카톡용 평문 `단어 — 읽기 — 뜻`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Button from '../components/Button';
import { analyzeText } from '../lib/analyzeText';
import { runPreservedReanalysis, replaceViewerAnalysis } from '../lib/reanalysisPreservation';
import {
  getTeam, todayKey, dayLabel, buildDayNoteRow, patchTeamRoot, appendEntryPlan, appendEntryFallbackJson,
  noteEntries, toPlainText,
} from '../lib/classBoard';
import { fetchTeamRoot, fetchDayNote, fetchBookChapters, chapterLabel } from '../lib/classTeamQueries';
import { openClassChannel } from '../lib/classRealtime';

/** 분석 실패 시 대체 저장 — 항목은 남기고(뜻 없음) 다음 추가가 재시도한다. */
async function saveEntryWithoutAnalysis(client, note, plan) {
  const attempt = crypto.randomUUID();
  const fallback = appendEntryFallbackJson(plan);
  const json = { ...fallback, metadata: { ...(fallback.metadata || {}), viewerRevision: attempt, updated_at: new Date().toISOString() } };
  return replaceViewerAnalysis(client, note, plan.newText, json, attempt);
}

export default function ClassLivePage() {
  const { team: key } = useParams();
  const { user, loading } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const day = todayKey();

  const { data: root, isLoading: rootLoading } = useQuery({
    queryKey: ['class-root', user?.id, key],
    queryFn: () => fetchTeamRoot(user.id, key),
    enabled: !!user?.id && !!key,
  });
  const team = getTeam(root?.processed_json?.metadata);
  const owned = !!user && !!root && root.owner_id === user.id;

  const { data: loadedNote } = useQuery({
    queryKey: ['class-note', user?.id, key, day],
    queryFn: () => fetchDayNote(user.id, key, day),
    enabled: owned,
  });
  const { data: chapters = [] } = useQuery({
    queryKey: ['book-chapters', team?.bookKey],
    queryFn: () => fetchBookChapters(team.bookKey),
    enabled: !!team?.bookKey,
    staleTime: 1000 * 60,
  });

  // 정리본은 저장 응답을 정본으로 들고 있는다(RPC가 기대값으로 raw_text·processed_json 전체를 대조한다).
  const [note, setNote] = useState(null);
  const noteRef = useRef(null);
  useEffect(() => {
    if (loadedNote !== undefined && noteRef.current === null) { noteRef.current = loadedNote; setNote(loadedNote); }
  }, [loadedNote]);

  const [text, setText] = useState('');
  const [pending, setPending] = useState([]); // 저장 대기 중 항목(입력 순)
  const queueRef = useRef(Promise.resolve());
  const channelRef = useRef(null);
  useEffect(() => {
    if (!owned) return undefined;
    channelRef.current = openClassChannel(key);
    return () => { channelRef.current?.close(); channelRef.current = null; };
  }, [owned, key]);

  const chapterId = team?.chapterId || '';
  const currentChapter = chapters.find((c) => String(c.id) === chapterId) || null;

  async function saveEntry(line) {
    const controller = new AbortController();
    const current = noteRef.current;
    let record;
    if (!current) {
      const row = buildDayNoteRow({ team, day, ownerId: user.id, firstLine: line, chapterId: chapterId || null });
      const { data: inserted, error } = await supabase.from('reading_materials').insert(row).select('*').single();
      if (error) throw error;
      noteRef.current = inserted;
      try {
        record = await runPreservedReanalysis(supabase, inserted, controller.signal, analyzeText, { selectedLineIndices: [0] });
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        const plan = { newText: inserted.raw_text, newIdx: 0, baseJson: { ...inserted.processed_json, sequence: [], dictionary: {}, failed_indices: [] } };
        record = await saveEntryWithoutAnalysis(supabase, inserted, plan);
      }
    } else {
      const plan = appendEntryPlan(current, line);
      if (!plan.ok) throw new Error(plan.reason);
      try {
        record = await runPreservedReanalysis(supabase, current, controller.signal, analyzeText, {
          rawTextOverride: plan.newText, baseJsonOverride: plan.baseJson, selectedLineIndices: plan.selected,
        });
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        record = await saveEntryWithoutAnalysis(supabase, current, plan);
      }
    }
    noteRef.current = record;
    setNote(record);
    queryClient.setQueryData(['class-note', user?.id, key, day], record);
    queryClient.invalidateQueries({ queryKey: ['materials'] });
    channelRef.current?.send({ noteId: record.id });
    return record;
  }

  function handleAdd(e) {
    e?.preventDefault();
    const line = text.trim();
    if (!line || !owned) return;
    setText('');
    setPending((p) => [...p, line]);
    // 직렬 큐 — 앞 항목의 저장 응답이 다음 항목의 기대값이 된다(동시 저장은 RPC가 거부한다).
    queueRef.current = queueRef.current
      .then(() => saveEntry(line))
      .catch((err) => { toast(`「${line}」 저장 실패 — ${err?.message || '다시 시도해 주세요'}`, 'error', 6000); })
      .finally(() => setPending((p) => p.filter((l, i) => !(l === line && i === p.indexOf(line)))));
  }

  async function handleChapterChange(e) {
    const next = e.target.value;
    if (!root) return;
    try {
      const json = patchTeamRoot(root.processed_json, { chapterId: next || null });
      const { error } = await supabase.from('reading_materials').update({ processed_json: json }).eq('id', root.id);
      if (error) throw error;
      queryClient.setQueryData(['class-root', user?.id, key], { ...root, processed_json: json });
      queryClient.invalidateQueries({ queryKey: ['class-root', user?.id, key] });
    } catch (err) {
      toast('과 선택 저장 실패 — ' + (err?.message || ''), 'error');
    }
  }

  async function handleCopy() {
    if (!note) { toast('아직 정리할 항목이 없어요.', 'info'); return; }
    const plain = toPlainText(note);
    try {
      await navigator.clipboard.writeText(plain);
      toast('정리본을 복사했어요 — 카톡에 붙여 넣으세요.', 'success');
    } catch {
      toast('복사하지 못했어요. 정리본을 열어 직접 복사해 주세요.', 'warning');
    }
  }

  const entries = useMemo(() => (note ? noteEntries(note) : []).slice().reverse(), [note]);

  if (loading || rootLoading) return null;
  if (!user) {
    return (
      <div className="page-container" style={{ maxWidth: 560, textAlign: 'center', paddingTop: 60 }}>
        <p style={{ marginBottom: 16 }}>입력판은 선생님 계정으로 열어요.</p>
        <Link href={`/auth?from=${encodeURIComponent(`/class/${key}/live`)}`} className="btn btn--primary btn--md">로그인 →</Link>
      </div>
    );
  }
  if (!owned) {
    return (
      <div className="page-container" style={{ maxWidth: 560, textAlign: 'center', paddingTop: 60 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>이 팀의 선생님만 열 수 있어요</h1>
        <Link href={`/class/${key}`} className="btn btn--secondary btn--md">팀 페이지로 →</Link>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <div className="page-header page-header--row">
        <div>
          <h1 className="page-header__title">{team.name} · {dayLabel(day)}</h1>
          <p className="page-header__subtitle">입력하면 태블릿 판에 바로 떠요 · 정리본은 자료 한 편으로 남아요</p>
        </div>
        <Link href="/class" className="viewer-back-link">← 팀</Link>
      </div>

      {chapters.length > 0 && (
        <div className="card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label htmlFor="class-chapter" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>오늘 과</label>
          <select id="class-chapter" className="form-input" style={{ flex: '1 1 200px' }} value={chapterId} onChange={handleChapterChange}>
            <option value="">선택 안 함</option>
            {chapters.map((c) => <option key={c.id} value={String(c.id)}>{c.order}. {chapterLabel(c.title)}</option>)}
          </select>
          {currentChapter && <Link href={`/viewer/${currentChapter.id}`} className="btn btn--ghost btn--sm">본문 열기</Link>}
        </div>
      )}

      <form onSubmit={handleAdd} className="card" style={{ padding: '12px 14px', marginBottom: 12, display: 'flex', gap: 8 }}>
        <input
          className="form-input"
          style={{ flex: 1, fontSize: '1.1rem' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="단어·표현 입력 후 Enter"
          autoComplete="off"
          autoFocus
          enterKeyHint="done"
          aria-label="단어 입력"
        />
        <Button type="submit" size="md" disabled={!text.trim()}>추가</Button>
      </form>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <Button size="sm" variant="secondary" onClick={handleCopy} disabled={!note}>📋 정리본 복사</Button>
        <Link href={`/class/${key}/board`} className="btn btn--secondary btn--sm">🖥 태블릿 판</Link>
        {note && <Link href={`/viewer/${note.id}`} className="btn btn--ghost btn--sm">정리본 열기</Link>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pending.slice().reverse().map((line, i) => (
          <div key={`p-${i}-${line}`} className="class-live__entry" aria-busy="true">
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{line}</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>뜻 찾는 중…</span>
          </div>
        ))}
        {entries.map((e) => (
          <div key={e.idx} className="class-live__entry">
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{e.text}</span>
            {e.reading && <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{e.reading}</span>}
            <span style={{ fontSize: '0.95rem', flex: 1 }}>{e.analyzed ? e.meaning || '뜻 없음' : '뜻 없음 — 다음 추가 때 다시 찾아요'}</span>
          </div>
        ))}
        {entries.length === 0 && pending.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '24px 0' }}>
            첫 단어를 입력하면 오늘 정리본이 생겨요.
          </p>
        )}
      </div>
    </div>
  );
}
