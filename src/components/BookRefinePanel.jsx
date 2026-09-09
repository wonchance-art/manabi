'use client';

/**
 * 책 단위 정제(v2-AB R0 ④, #1077 설계 5603827169 — 오너 「착수해」 2026-09-09).
 *
 * 이미 올린 이중 언어 교재(일본어 문장 / 한국어 뜻 교대 줄)를 **원어만 남기고 뜻은
 * metadata.translations로** 옮긴다. 저장은 뷰어 원문 수정과 같은 문(viewer_replace_analysis RPC)을
 * 탄다 — 분석된 과는 `runPreservedReanalysis`의 「삭제/줄 이동만 = 리맵 검증, AI 호출 0」 분기,
 * 미분석 과는 `replaceViewerAnalysis`로 원문·메타만 바꾼다. 어느 쪽도 **원어 줄을 재분석하지 않는다**.
 *
 * 실행 전 「N과 · 원어 X줄 · 뜻 Y줄 · 미배정 Z줄」을 보여 주고 사람이 확인한다. 미배정 줄(장 제목·
 * 주석)은 담기지 않으므로 목록으로 드러낸다 — 조용히 버리지 않는다(계약).
 *
 * 소유자만 실행할 수 있다(RPC가 owner_id = auth.uid()를 요구). 관리자 화면에 두는 이유:
 * 오너 교재(41과)가 비공개라 관리자 페이지에서만 목록으로 보이기 때문이다.
 */
import { useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { groupByBook } from '../lib/bookMeta';
import { planRefine, summarizeSplit } from '../lib/bilingualSplit';
import { analyzeText } from '../lib/analyzeText';
import { runPreservedReanalysis, replaceViewerAnalysis } from '../lib/reanalysisPreservation';
import Button from './Button';
import ConfirmModal from './ConfirmModal';

const STATUS_LABEL = {
  wait: '대기', running: '정제 중…', done: '완료', skip: '뜻 줄 없음', fail: '실패',
};

/** 과 하나 정제 — 분석 유무로 저장 문을 고른다. 반환: 'done' | 'skip'. 실패는 throw. */
export async function refineChapter(client, chapter, plan, signal) {
  if (plan.noop) return 'skip';
  const analyzed = chapter.processed_json?.status === 'completed' && (chapter.processed_json?.sequence?.length || 0) > 0;
  if (analyzed) {
    await runPreservedReanalysis(client, chapter, signal, analyzeText, {
      rawTextOverride: plan.newText, baseJsonOverride: plan.remapped, selectedLineIndices: [],
    });
    return 'done';
  }
  const attempt = crypto.randomUUID();
  const json = {
    ...plan.remapped,
    metadata: { ...(plan.remapped?.metadata || {}), viewerRevision: attempt, updated_at: new Date().toISOString() },
  };
  await replaceViewerAnalysis(client, chapter, plan.newText, json, attempt);
  return 'done';
}

export default function BookRefinePanel({ materials, userId, toast, onRefined }) {
  const books = useMemo(() => {
    const { books: grouped } = groupByBook(materials || []);
    // 내 책만 — RPC가 소유자만 받는다. 남의 책은 정제 후보로 보이지 않게 한다.
    return grouped.filter((b) => b.chapters.every((c) => c.owner_id === userId));
  }, [materials, userId]);
  const [inspect, setInspect] = useState(null); // { book, rows:[{chapter, plan}], stats, unassigned }
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({}); // chapterId → status
  const [confirming, setConfirming] = useState(false);
  const abortRef = useRef(null);

  async function handleInspect(book) {
    setBusy(true);
    setInspect(null);
    setProgress({});
    try {
      const { data, error } = await supabase
        .from('reading_materials')
        .select('id, title, raw_text, processed_json, owner_id, visibility')
        .filter('processed_json->metadata->book->>key', 'eq', book.key)
        .order('id');
      if (error) throw error;
      const rows = (data || [])
        .map((chapter) => ({ chapter, plan: planRefine(chapter) }))
        .sort((a, b) => (Number(a.chapter.processed_json?.metadata?.book?.order) || 0) - (Number(b.chapter.processed_json?.metadata?.book?.order) || 0));
      const stats = rows.reduce((acc, { plan }) => {
        if (!plan.ok) { acc.blocked += 1; return acc; }
        if (plan.noop) return acc;
        acc.chapters += 1;
        acc.source += plan.stats.source;
        acc.paired += plan.stats.paired;
        acc.unassigned += plan.stats.unassigned;
        return acc;
      }, { chapters: 0, source: 0, paired: 0, unassigned: 0, blocked: 0 });
      const unassigned = rows.flatMap(({ chapter, plan }) => (plan.ok ? plan.unassigned.map((u) => ({ ...u, title: chapter.title })) : []));
      setInspect({ book, rows, stats, unassigned });
    } catch (err) {
      toast?.('정제 검사 실패: ' + (err?.message || '알 수 없는 오류'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRun() {
    if (!inspect) return;
    setConfirming(false);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let done = 0;
    let failed = 0;
    for (const { chapter, plan } of inspect.rows) {
      if (controller.signal.aborted) break;
      if (!plan.ok || plan.noop) { setProgress((p) => ({ ...p, [chapter.id]: 'skip' })); continue; }
      setProgress((p) => ({ ...p, [chapter.id]: 'running' }));
      try {
        await refineChapter(supabase, chapter, plan, controller.signal);
        done += 1;
        setProgress((p) => ({ ...p, [chapter.id]: 'done' }));
      } catch (err) {
        if (err?.name === 'AbortError') break;
        failed += 1;
        setProgress((p) => ({ ...p, [chapter.id]: 'fail', [`${chapter.id}:reason`]: err?.message || '실패' }));
      }
    }
    setBusy(false);
    abortRef.current = null;
    toast?.(`《${inspect.book.title || '제목 없는 책'}》 정제 — ${done}과 완료${failed ? ` · ${failed}과 실패` : ''}`, failed ? 'warning' : 'success');
    onRefined?.();
  }

  if (books.length === 0) return null;

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.9rem' }}>📘 책 단위 정제</strong>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          원어·뜻 교대 줄 교재를 원어만 남기고 뜻은 드래그 번역에 붙여요 — 재분석 없이 리맵만
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {books.map((b) => (
          <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.84rem' }}>
            <span style={{ flex: 1, minWidth: 160 }}>《{b.title || '제목 없는 책'}》 · {b.chapters.length}과</span>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleInspect(b)}>정제 검사</Button>
          </div>
        ))}
      </div>

      {inspect && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', fontSize: '0.82rem', lineHeight: 1.7 }}>
          <div>
            《{inspect.book.title || '제목 없는 책'}》 — {inspect.stats.chapters}과에 뜻 줄 · {summarizeSplit(inspect.stats)}
            {inspect.stats.blocked > 0 && ` · 계획 불가 ${inspect.stats.blocked}과`}
          </div>
          {inspect.stats.chapters === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>걷어낼 뜻 줄이 없어요 — 이 책은 이미 원어만 담겨 있어요.</div>
          ) : (
            <>
              {inspect.unassigned.length > 0 && (
                <details style={{ marginTop: 4 }}>
                  <summary style={{ cursor: 'pointer' }}>미배정 {inspect.unassigned.length}줄 — 담기지 않아요(장 제목·주석)</summary>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--text-muted)' }}>
                    {inspect.unassigned.slice(0, 20).map((u, i) => (
                      <li key={i}>{u.title} · {u.line}</li>
                    ))}
                    {inspect.unassigned.length > 20 && <li>… 외 {inspect.unassigned.length - 20}줄</li>}
                  </ul>
                </details>
              )}
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {inspect.rows.map(({ chapter, plan }) => (
                  <li key={chapter.id}>
                    {chapter.title} — {plan.ok ? (plan.noop ? '뜻 줄 없음' : summarizeSplit(plan.stats)) : plan.reason}
                    {progress[chapter.id] && (
                      <strong style={{ marginLeft: 6, color: progress[chapter.id] === 'fail' ? 'var(--danger)' : 'var(--text-primary)' }}>
                        · {STATUS_LABEL[progress[chapter.id]]}{progress[`${chapter.id}:reason`] ? ` — ${progress[`${chapter.id}:reason`]}` : ''}
                      </strong>
                    )}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {busy && abortRef.current
                  ? <Button size="sm" variant="danger" onClick={() => abortRef.current?.abort()}>중단</Button>
                  : <Button size="sm" disabled={busy} onClick={() => setConfirming(true)}>정제 실행 ({inspect.stats.chapters}과)</Button>}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setInspect(null)}>닫기</Button>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={confirming}
        title="책 단위 정제"
        message={inspect ? `《${inspect.book.title || '제목 없는 책'}》 ${inspect.stats.chapters}과 · ${summarizeSplit(inspect.stats)} — 원어만 남기고 뜻은 드래그 번역에 붙여요. 원어 줄은 재분석하지 않아요.` : ''}
        confirmLabel="정제 실행"
        variant="primary"
        onConfirm={handleRun}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
