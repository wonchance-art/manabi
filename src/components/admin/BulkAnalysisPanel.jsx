'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../Button';
import ConfirmModal from '../ConfirmModal';
import { supabase } from '../../lib/supabase';
import { analyzeText } from '../../lib/analyzeText';
import { runPreservedReanalysis } from '../../lib/reanalysisPreservation';
import { friendlyToastMessage } from '../../lib/errorMessage';
import { invalidateLibrary } from '../../lib/libraryOperations';
import { BULK_FAILURE_STOP, BULK_PENDING_STATUSES, bulkAnalysisTargets } from '../../lib/bulkAnalysis';

// 분석 전 공개 자료 일괄 분석(BULK-ANALYZE-001) — 뷰어 「이 챕터 분석하기」와 같은 정본 경로(runPreservedReanalysis + analyzeText:
// 서버 형태소 · 사전 · 뜻 생성, 소유자 RPC 저장, metadata 보존)를 한 편씩. 한 편이 실패하면 원본 그대로 두고 다음으로 —
// 연달아 BULK_FAILURE_STOP편 실패하면 멈춘다. 다시 열면 남은 편부터 이어진다(분석된 편은 대상에서 빠진다).
const QUERY_KEY = ['admin-bulk-analysis'];

async function fetchCandidates(ownerId) {
  const { data, error } = await supabase.from('reading_materials')
    .select('id, title, owner_id, visibility, status:processed_json->>status, book_key:processed_json->metadata->book->>key, team:processed_json->metadata->team, raw_length:raw_text')
    .eq('owner_id', ownerId).eq('visibility', 'public').in('processed_json->>status', BULK_PENDING_STATUSES)
    .order('id').range(0, 999);
  if (error) throw error;
  // raw_text 길이만 쓴다 — 행 모양을 판정 함수(isTeamRoot)가 읽는 형태로 맞춘다.
  return (data || []).map((row) => ({ ...row, raw_length: String(row.raw_length || '').trim().length,
    processed_json: { metadata: { team: row.team } } }));
}

export default function BulkAnalysisPanel({ ownerId, toast }) {
  const queryClient = useQueryClient();
  const abortRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(null); // {done, total}
  const [failed, setFailed] = useState([]);
  const candidates = useQuery({ queryKey: [...QUERY_KEY, ownerId], queryFn: () => fetchCandidates(ownerId), enabled: !!ownerId });
  const targets = bulkAnalysisTargets(candidates.data, ownerId);

  async function run() {
    setConfirming(false);
    if (abortRef.current || targets.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const misses = [];
    let streak = 0;
    try {
      for (const [index, target] of targets.entries()) {
        setRunning({ done: index, total: targets.length });
        try {
          const { data: row, error } = await supabase.from('reading_materials').select('*').eq('id', target.id).single();
          if (error) throw error;
          await runPreservedReanalysis(supabase, row, controller.signal, analyzeText, { fullReset: true });
          streak = 0;
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          misses.push({ id: target.id, title: target.title, message: friendlyToastMessage(error, '분석하지 못했어요.') });
          streak += 1;
          if (streak >= BULK_FAILURE_STOP) throw Object.assign(new Error(`연달아 ${streak}편을 분석하지 못해 멈췄어요 — ${misses.at(-1).message}`), { stopped: true });
        }
      }
      toast?.(misses.length ? `${targets.length - misses.length}편을 분석했어요. ${misses.length}편은 건너뛰었어요.` : `${targets.length}편을 모두 분석했어요.`, misses.length ? 'error' : 'success');
    } catch (error) {
      if (error?.name === 'AbortError') toast?.('분석을 멈췄어요. 다시 누르면 남은 편부터 이어요.', 'info');
      else toast?.(friendlyToastMessage(error, '분석을 마치지 못했어요.'), 'error');
    } finally {
      abortRef.current = null;
      setRunning(null);
      setFailed(misses);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      void invalidateLibrary(queryClient, ownerId);
    }
  }

  return (
    <section className="card" aria-labelledby="bulk-analysis-title" style={{ marginBottom: '24px' }}>
      <h3 id="bulk-analysis-title">분석 전 공개 자료</h3>
      {candidates.isPending ? <p role="status">분석 전 자료 불러오는 중…</p>
        : candidates.isError ? <p role="alert">분석 전 자료를 불러오지 못했어요. <Button variant="secondary" size="sm" onClick={() => candidates.refetch()}>다시 시도</Button></p>
        : <>
          <p>내가 공개한 자료 중 아직 분석하지 않은 글 {targets.length}편이에요. 분석하면 뷰어에서 단어를 눌러 뜻을 보고 담을 수 있어요.</p>
          {running
            ? <p role="status" aria-live="polite">{running.done}/{running.total}편 분석 중… <Button variant="secondary" size="sm" onClick={() => abortRef.current?.abort()}>멈추기</Button></p>
            : <Button disabled={targets.length === 0} onClick={() => setConfirming(true)}>{targets.length}편 분석하기</Button>}
          {failed.length > 0 && <details><summary>건너뛴 {failed.length}편</summary><ul>{failed.map((item) => <li key={item.id}>{item.title} — {item.message}</li>)}</ul></details>}
        </>}
      <ConfirmModal open={confirming} title={`${targets.length}편을 분석할까요?`}
        message="한 편씩 차례로 분석해요. 원문 · 제목 · 공개 범위는 그대로이고, 실패한 편은 지금 상태로 남아요."
        confirmLabel="분석하기" onConfirm={run} onCancel={() => setConfirming(false)} />
    </section>
  );
}
