import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const quest = read('src/components/world/QuestReview.jsx');
const board = read('docs/ai-tasks.md');

/**
 * 계약: W R3㉯ 퀘스트 복습 — 🧊 동결 예외(오너 승인 2026-09-02, #1077 5504406191).
 * 예외 범위는 QuestReview.jsx 한 파일: 4버튼 정본 정렬(GBC 문법 유지) · 채점 스냅샷 · undo ·
 * 다이얼로그 내 키 리스너. 씬·연출·펫·버스는 읽기만(재방출·취소 없음).
 */
describe('퀘스트 복습 R3㉯ — 4등급 정렬·undo·키 (QuestReview)', () => {
  it('4버튼의 값·순서는 SAVE_GRADES(복습 화면 정본), 모양은 GBC — 옛 틀/맞(1/3) 부활 금지', () => {
    expect(quest).toContain("import { SAVE_GRADES } from '../../lib/vocabIO';");
    expect(quest).toContain('{SAVE_GRADES.map((g) => (');
    expect(quest).toContain('onClick={() => grade(g.grade)}');
    expect(quest).not.toMatch(/grade\((true|false)\)/);
    expect(quest).not.toMatch(/const rating = correct \? 3 : 1/);
    expect(quest).toContain('gbcButtonPrimary');
  });

  it('정렬 뒤에도 correct = rating > 1 · qtype flash 규약 불변(rung 비대칭 신뢰 승계)', () => {
    const g = sliceBetween(quest, 'const grade = async (rating) => {', '\n  };');
    expect(g).toContain('const correct = rating > 1;');
    expect(g).toContain("detail: { word_id: current.id, meaning: current.meaning, rating, mode: 'world', qtype: 'flash' },");
    expect(g).toContain('created_at: reviewedAt,');
    expect(g).toContain('await persistQuestReviewGrade(supabase, current.id, nextStats, reviewedAt);');
    // 스냅샷은 저장 성공 뒤에만 유효
    expect(g).toContain('lastGradeRef.current = { ...snapshot, reviewedAt };');
    expect(g.indexOf('lastGradeRef.current = null;')).toBeLessThan(g.indexOf('await persistQuestReviewGrade'));
  });

  it('undo 뒤 idx·right·phase가 채점 전 값이며, 버스 신호는 재방출되지 않는다', () => {
    const u = sliceBetween(quest, 'const undoLast = async () => {', '\n  };');
    expect(u).toContain("const { last_reviewed_at: prevReviewedAt = null, ...prevStats } = last.prev;");
    expect(u).toContain('await persistQuestReviewGrade(supabase, last.wordId, prevStats, prevReviewedAt);');
    expect(u).toContain('rightRef.current = last.right;');
    expect(u).toContain('setRight(last.right);');
    expect(u).toContain('setIdx(last.idx);');
    expect(u).toContain('setFlipped(true);');
    expect(u).toContain("setPhase('active');");
    expect(u).not.toContain('bus.emit');
    // 보상 이벤트 정확히 1건
    expect(u.match(/logReviewEvents\(/g)).toHaveLength(1);
    expect(u).toContain("detail: { qtype: 'undo', undo_of: { item_key: last.itemKey, rating: last.rating, reviewed_at: last.reviewedAt } },");
  });

  it('키 리스너는 마운트(다이얼로그 열림) 동안만 — 처리한 키는 전파를 끊어 캔버스와 경쟁하지 않는다', () => {
    const k = sliceBetween(quest, 'const keysRef = useRef({});', '}, []);');
    expect(k).toContain("document.addEventListener('keydown', onKeyDown);");
    expect(k).toContain("return () => document.removeEventListener('keydown', onKeyDown);");
    // 채점·undo 두 경로 모두 전파 차단 — 하나만 남으면 캔버스가 숫자 키를 받는다(변이 G 실측: 하나만 보던 계약이 통과했다)
    expect(k.match(/e\.preventDefault\(\); e\.stopPropagation\(\);/g)).toHaveLength(2);
    expect(k).toContain("t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable");
    expect(k).toContain('if (inField || e.metaKey || e.ctrlKey || e.altKey) return;');
    expect(k).toContain('if (!/^[1-4]$/.test(e.key) || !h.row) return;');
    expect(k).toContain('if (inField || !h.canUndo) return;');
    expect(quest).toContain("keysRef.current = { row: phase === 'active' && !!current && flipped, grade, undo: undoLast, canUndo: !!lastGradeRef.current && !gradingRef.current };");
  });

  it('동결 예외는 이 파일뿐 — 씬·연출·펫·버스 소스 무접촉, 보드에 예외 줄 동봉', () => {
    expect(board).toContain('🧊 예외: `QuestReview.jsx` 한정 — W R3㉯ SRS 정합(오너 승인 2026-09-02, #1077 5504387198). 씬·연출·펫은 동결 유지.');
    for (const f of ['src/components/world/GameCanvas.jsx', 'src/components/world/bus.js', 'src/lib/world/pet.js', 'src/views/WorldPage.jsx']) {
      expect(read(f)).not.toMatch(/undo_of|SAVE_GRADES/);
    }
  });
});
