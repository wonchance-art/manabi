import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';
import { BULK_FAILURE_STOP, BULK_PENDING_STATUSES, bulkAnalysisTargets } from '../bulkAnalysis';

// 분석 전 공개 자료 일괄 분석(BULK-ANALYZE-001, 오너 「권장대로」 2026-10-17 KST).
const row = (over = {}) => ({ id: 1, title: '[B1 grammar #2] past perfect', owner_id: 'me', visibility: 'public', status: 'idle',
  raw_length: 308, book_key: null, processed_json: { metadata: {} }, ...over });
const panel = fs.readFileSync('src/components/admin/BulkAnalysisPanel.jsx', 'utf8');

describe('일괄 분석 대상', () => {
  it('내 소유 · 공개 · 미분석(뷰어 isPending과 같은 표지) · 원문 있음만', () => {
    expect(BULK_PENDING_STATUSES).toEqual(['idle', 'pending', 'saved']);
    const rows = [row({ id: 1 }), row({ id: 2, status: 'pending' }), row({ id: 3, status: 'completed' }), row({ id: 4, owner_id: 'other' }),
      row({ id: 5, visibility: 'private' }), row({ id: 6, raw_length: 0 }), row({ id: 7, status: 'analyzing' })];
    expect(bulkAnalysisTargets(rows, 'me').map((r) => r.id)).toEqual([1, 2]);
    expect(bulkAnalysisTargets(rows, null)).toEqual([]);
  });
  it('수업 팀 설정 행과 정본 책은 뺀다', () => {
    const team = row({ id: 8, processed_json: { metadata: { team: { key: 'a', root: true } } } });
    const canonical = row({ id: 9, book_key: 'aozora-000035-000275' });
    expect(bulkAnalysisTargets([team, canonical, row({ id: 10, book_key: 'bk_x_y' })], 'me').map((r) => r.id)).toEqual([10]);
  });
});

describe('패널 배선 — 뷰어와 같은 정본 경로', () => {
  it('한 편씩 runPreservedReanalysis(… analyzeText, { fullReset: true }) · 소유자 · 공개 · 미분석만 조회', () => {
    expect(panel).toContain('await runPreservedReanalysis(supabase, row, controller.signal, analyzeText, { fullReset: true });');
    expect(panel).toContain(".eq('owner_id', ownerId).eq('visibility', 'public').in('processed_json->>status', BULK_PENDING_STATUSES)");
    expect(panel).not.toMatch(/\.update\(|\.upsert\(/); // 저장은 정본 RPC(viewer_replace_analysis)만
  });
  it('실패는 건너뛰고 연달아 실패하면 멈춘다 · 멈추기 · 확인창', () => {
    expect(BULK_FAILURE_STOP).toBe(3);
    expect(panel).toContain('if (streak >= BULK_FAILURE_STOP)');
    expect(panel).toContain('abortRef.current?.abort()');
    expect(panel).toContain('<ConfirmModal open={confirming}');
    expect(fs.readFileSync('src/views/AdminPage.jsx', 'utf8')).toContain('<BulkAnalysisPanel ownerId={user?.id} toast={toast} />');
  });
  it('진행 알림 영역은 늘 그려 두고 내용만 바꾼다 · 「멈추기」는 영역 밖', () => {
    // 낭독 영역은 약 10%마다만 바뀌고(LOADING-ANNOUNCE-001 ③ — announcedProgress), 한 편마다 바뀌는 보이는 사본은 숨긴다.
    const live = "<span className=\"sr-only\" role=\"status\">{running ? `${announcedProgress(running.done, running.total)}/${running.total}편 분석하고 있어요…` : ''}</span>";
    const visible = "<span className=\"bulk-analysis__progress\" aria-hidden=\"true\">{running ? `${running.done}/${running.total}편 분석하고 있어요…` : ''}</span>";
    expect(panel).toContain(`${live}\n            ${visible}`);
    // 영역이 running 조건 안에서 생기면(내용과 함께 생기는 status) 화면 낭독기가 놓친다.
    expect(panel).not.toMatch(/running\s*\?\s*<p role="status"/);
    // 영역 · 보이는 사본 바로 뒤가 버튼 분기 — 「멈추기」는 영역(span) 안이 아니라 그 뒤 형제다.
    expect(sliceBetween(panel, visible).slice(visible.length).trimStart().startsWith('{running')).toBe(true);
    expect(sliceBetween(panel, '<span className="sr-only" role="status"', '</span>')).not.toContain('멈추기');
  });
});
