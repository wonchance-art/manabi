import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { dropUndoneEvents, isUndoEvent, undoneKeySet } from '../undoneReviews';

// 계약: 되돌린 채점 제외 (W 후속 ② — W R2 설계 §후속, #1077 5504350927).
// undo는 review_events를 못 지우고(RLS SELECT·INSERT뿐) source:'ui' 보상 이벤트를 남긴다.
// 보상 이벤트는 isGradedReviewEvent가 이미 거르지만 **되돌린 원 이벤트**는 집계에 남았다 —
// 이 필터가 (item_key, 시각)으로 원 이벤트를 찾아 뺀다. 아래는 그 판정과 소비처 배선의 고정.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

// PostgREST가 돌려주는 표기('+00:00')와 클라이언트가 보낸 표기('Z')는 같은 순간의 다른 문자열이다.
const orig = (over = {}) => ({
  source: 'vocab', item_key: '道歉', correct: false,
  created_at: '2026-09-02T12:00:00.123+00:00', detail: { qtype: 'choice', rating: 1 }, ...over,
});
const marker = (over = {}) => ({
  source: 'ui', item_key: '道歉', correct: true, created_at: '2026-09-02T12:00:05+00:00',
  detail: { qtype: 'undo', undo_of: { item_key: '道歉', rating: 1, reviewed_at: '2026-09-02T12:00:00.123Z' } },
  ...over,
});

describe('되돌린 채점 제외 계약 (W 후속 ②)', () => {
  it('마커 판정 — source ui + qtype undo + undo_of 셋 다 있어야 마커다', () => {
    expect(isUndoEvent(marker())).toBe(true);
    expect(isUndoEvent({ ...marker(), source: 'vocab' })).toBe(false);
    expect(isUndoEvent({ ...marker(), detail: { qtype: 'forecast_tap', undo_of: { item_key: 'x' } } })).toBe(false);
    expect(isUndoEvent({ source: 'ui', item_key: '-', correct: true, detail: { qtype: 'undo' } })).toBe(false);
    expect(isUndoEvent(null)).toBe(false);
  });

  it('원 이벤트는 (item_key, 시각 ms)로 잡는다 — Z와 +00:00 표기 차이를 넘어서, 마커도 함께 빠진다', () => {
    const other = orig({ item_key: '喝', created_at: '2026-09-02T11:00:00+00:00' });
    const out = dropUndoneEvents([orig(), marker(), other]);
    expect(out).toEqual([other]);
  });

  it('같은 단어의 다른 시각 채점은 남는다 — item_key만으로 지우지 않는다', () => {
    const later = orig({ created_at: '2026-09-02T12:30:00+00:00', correct: true });
    expect(dropUndoneEvents([orig(), later, marker()])).toEqual([later]);
  });

  it('다른 단어의 같은 시각 채점은 남는다 — 시각만으로 지우지 않는다', () => {
    const twin = orig({ item_key: '喝' });
    expect(dropUndoneEvents([orig(), twin, marker()])).toEqual([twin]);
  });

  it('마커가 가리키는 원 이벤트가 없어도(오프라인 유실) 무해 — 마커만 빠진다', () => {
    const other = orig({ item_key: '喝' });
    expect(dropUndoneEvents([marker(), other])).toEqual([other]);
  });

  it('undo가 하나도 없으면 입력 배열 그대로(복사 없음) · 배열이 아니면 빈 배열', () => {
    const evs = [orig(), orig({ item_key: '喝' })];
    expect(dropUndoneEvents(evs)).toBe(evs);
    expect(dropUndoneEvents(undefined)).toEqual([]);
  });

  it('마커를 따로 넘기는 경로 — detail 없이 긁은 행에서도 원 이벤트를 뺀다(주간 리포트·헷갈림 큐)', () => {
    const thin = { source: 'vocab', item_key: '道歉', correct: false, created_at: '2026-09-02T12:00:00.123+00:00' };
    const thinUi = { source: 'ui', item_key: '道歉', correct: true, created_at: '2026-09-02T12:00:05+00:00' };
    // detail 없는 ui 행은 마커로 보이지 않아 남는다 — 하류의 isGradedReviewEvent(ui 제외)가 거른다.
    expect(dropUndoneEvents([thin, thinUi], [marker()])).toEqual([thinUi]);
  });

  it('undoneKeySet — reviewed_at 없는 마커는 아무것도 가리키지 않는다', () => {
    const m = marker({ detail: { qtype: 'undo', undo_of: { item_key: '道歉', rating: 1 } } });
    expect(undoneKeySet([m]).size).toBe(0);
    expect(dropUndoneEvents([orig(), m])).toEqual([orig()]);
  });

  it('세 undo 지점의 마커 모양이 같다 — 필터가 읽는 필드(item_key·reviewed_at)', () => {
    const shape = "detail: { qtype: 'undo', undo_of: { item_key: last.itemKey, rating: last.rating, reviewed_at: last.reviewedAt } }";
    for (const f of ['src/views/VocabPage.jsx', 'src/views/ViewerPage.jsx', 'src/components/world/QuestReview.jsx']) {
      expect(read(f), f).toContain(shape);
    }
  });

  it('소비처 배선 — 다섯 로더가 필터를 지난다', () => {
    const weekly = read('src/lib/weeklyReportRows.js');
    expect(weekly).toContain("select('source, item_key, correct, created_at')");
    expect(weekly).toContain('fetchUndoMarkers(userId, { sinceIso: prevStartIso })');
    expect(weekly).toContain('events: dropUndoneEvents(ev.data || [], undo)');

    expect(read('src/lib/weaknessRows.js')).toContain('return dropUndoneEvents(data || []);');

    const output = read('src/lib/useOutputWords.js');
    expect(output).toContain("select('source, item_key, correct, created_at, detail')");
    expect(output).toContain('events: dropUndoneEvents(events.data || [])');

    expect(read('src/lib/studyMaterials.js')).toContain('const reviewEventRows = dropUndoneEvents(reviewEventRowsRaw || []);');

    const vocab = read('src/views/VocabPage.jsx');
    expect(vocab).toContain('dropUndoneEvents(data).slice().reverse()');
    expect(vocab).toContain('fetchUndoMarkers(user.id, { sinceIso })');
    expect(vocab).toContain('return dropUndoneEvents(data || [], markers);');
  });

  it('마커 조회 — ui + detail->>qtype=undo만, 쓰기 없음, 실패는 빈 배열', () => {
    const rows = read('src/lib/undoneReviewsRows.js');
    expect(rows).toContain(".eq('source', 'ui')");
    expect(rows).toContain(".eq('detail->>qtype', 'undo')");
    for (const banned of ['insert(', 'upsert(', 'update(', 'delete(']) expect(rows).not.toContain(banned);
    expect(rows).toMatch(/catch \{\s*return \[\];\s*\}/);
  });

  it('주간 회고(StudySessionPage)는 head 카운트 대신 주간 리포트 정본을 쓴다', () => {
    const src = read('src/views/StudySessionPage.jsx');
    expect(src).not.toContain("count: 'exact', head: true");
    expect(src).toContain('buildWeeklyReport(await fetchWeeklyReportRows(user.id))');
  });

  it('월드 펫 count는 동결 — 이 라운드가 손대지 않는다(잔류는 QuestReview 주석이 명시)', () => {
    expect(read('src/lib/world/pet.js')).not.toContain('dropUndoneEvents');
    expect(read('src/components/world/QuestReview.jsx')).toContain('펫 count의 원 이벤트 +1 잔류');
  });
});
