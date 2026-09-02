import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SAVE_GRADES, buildVocabRow, gradeToInitialStats } from '../vocabIO';
import { sliceBetween } from './helpers/sliceBetween.js';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const review = read('src/views/VocabReview.jsx');
const vocabIO = read('src/lib/vocabIO.js');
const css = read('src/index.css');
const DAY = 24 * 3600 * 1000;

/**
 * 계약: W 저장 등급 R1 (오너 확정 2026-09-02, #1077 5504298889).
 * 「저장/이미 안다」 이분법 → Anki식 4등급 저장. 전부 SRS 안 — 「쉬움」도 8일 뒤 확인.
 * last_reviewed_at 불세팅으로 하루 한도 보호. 키 1~4 · Ctrl/⌘+Z undo(새로 넣은 행만).
 * 「이미 알아요」 쓰기 일몰(읽기 경로 불변).
 */
describe('저장 등급 — 정본(vocabIO)', () => {
  it('저장 4버튼의 라벨·순서·CSS 접미사가 복습 화면(ScoreSection)과 동일하다', () => {
    const section = sliceBetween(review, 'function ScoreSection(', '\n}\n');
    const btns = [...section.matchAll(/onScore\((\d)\)\} className="review-score-btn review-score-btn--(\w+)"[^>]*>([^<]+)</g)]
      .map((m) => ({ grade: Number(m[1]), cls: m[2], label: m[3] }));
    expect(btns).toHaveLength(4);
    expect(SAVE_GRADES.map(({ grade, cls, label }) => ({ grade, cls, label }))).toEqual(btns);
    expect(SAVE_GRADES.map((g) => g.key)).toEqual(['1', '2', '3', '4']);
  });

  it('등급 → 초기 상태는 calculateFSRS 재사용 — 손계산 금지, last_reviewed_at 불세팅', () => {
    expect(vocabIO).toContain("import { calculateFSRS } from './fsrs';");
    expect(vocabIO).not.toMatch(/24 \* 3600|setDate\(/);
    for (const g of [1, 2, 3, 4]) {
      const st = gradeToInitialStats(g, () => 'NOW');
      expect(st).not.toHaveProperty('last_reviewed_at');
      expect(typeof st.interval).toBe('number');
      expect(typeof st.ease_factor).toBe('number');
    }
  });

  it('「다시」는 오늘 due(특례), 「쉬움」은 오늘 due가 아니다(≥ 7일 뒤) · 첫 등급이 D를 가른다', () => {
    const again = gradeToInitialStats(1, () => 'NOW');
    expect(again.next_review_at).toBe('NOW');
    const easy = gradeToInitialStats(4);
    expect(new Date(easy.next_review_at).getTime() - Date.now()).toBeGreaterThan(7 * DAY);
    const good = gradeToInitialStats(3);
    expect(new Date(good.next_review_at).getTime() - Date.now()).toBeGreaterThan(1 * DAY);
    expect(easy.ease_factor).toBeLessThan(good.ease_factor);
    expect(good.ease_factor).toBeLessThan(again.ease_factor);
  });

  it('등급 없이 저장하면 현행과 한 바이트도 다르지 않다 — 11개 저장 경로 무회귀', () => {
    const row = buildVocabRow({ userId: 'u', surface: '咖啡', base: '咖啡', meaning: '커피', pos: '명사', reading: 'kāfēi', language: 'Chinese', now: () => 'T' });
    expect(JSON.stringify(row)).toBe(JSON.stringify({
      user_id: 'u', word_text: '咖啡', base_form: '咖啡', meaning: '커피', pos: '명사', furigana: 'kāfēi', language: 'Chinese', next_review_at: 'T',
    }));
  });

  it('등급 저장 행은 SRS 3필드 + next_review_at을 싣고 last_reviewed_at은 없다 → 직후 isNewWord 참', () => {
    const row = buildVocabRow({ userId: 'u', surface: '咖啡', language: 'Chinese', grade: 4, now: () => 'T' });
    for (const k of ['interval', 'ease_factor', 'repetitions', 'next_review_at']) expect(row).toHaveProperty(k);
    expect(row).not.toHaveProperty('last_reviewed_at');
    expect(row.next_review_at).not.toBe('T');
    expect(buildVocabRow({ userId: 'u', surface: '咖啡', language: 'Chinese', grade: 1, now: () => 'T' }).next_review_at).toBe('T');
  });
});

describe('저장 등급 — 뷰어 배선(ViewerPage)', () => {
  const card = sliceBetween(viewer, 'const wordDetailCard = !selectedToken || !isSheetOpen ? null : (', 'const rightPanelContent =');
  const keys = sliceBetween(viewer, 'const lastSaveRef = useRef(null);', '}, [selectedToken, isSheetOpen]);');

  it('카드 4버튼은 SAVE_GRADES를 돌며 복습 화면 클래스를 재사용한다 — 손으로 적은 라벨 0', () => {
    expect(card).toContain('SAVE_GRADES.map((g) => (');
    expect(card).toContain('className={`review-score-btn review-score-btn--${g.cls}`}');
    expect(card).toContain('onClick={() => addToVocab(g.grade)}');
    expect(card).not.toContain("'단어장에 저장'");
    expect(css).toContain('.save-grade .review-score-btn');
  });

  it('키 1~4 — 입력 요소 포커스·조합키·카드 닫힘·이미 저장 상태에서 발동하지 않는다', () => {
    expect(keys).toContain('if (!selectedToken || !isSheetOpen) return undefined;');
    expect(keys).toContain("t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable");
    expect(keys).toContain('if (inField || e.metaKey || e.ctrlKey || e.altKey) return;');
    expect(keys).toContain('if (!/^[1-4]$/.test(e.key)) return;');
    expect(keys).toContain('if (h.saveLocked) return;');
    expect(viewer).toContain('keyHandlersRef.current = { addToVocab, undoLastSave, saveLocked: isWordSaved || saveAnim };');
    expect(keys).toContain("document.addEventListener('keydown', onKeyDown);");
    expect(keys).toContain("return () => document.removeEventListener('keydown', onKeyDown);");
  });

  it('undo는 이번에 새로 넣은 행만 — upsert .select(id) 반환이 판정, 이미 있던 단어는 undo 대상 아님', () => {
    expect(viewer).toContain(".upsert(row, options).select('id');");
    expect(viewer).toContain("lastSaveRef.current = inserted[0]?.id ? { id: inserted[0].id, text: selectedToken.text } : null;");
    const undo = sliceBetween(viewer, 'const undoLastSave = async () => {', '\n  };');
    expect(undo).toContain("from('user_vocabulary').delete().eq('id', last.id)");
    expect(undo).toContain('lastSaveRef.current = null;');
    expect(undo).toContain("queryKey: ['vocab-words', user?.id]");
  });

  it('⌘Z는 입력 요소 안에서 기본 동작을 가로채지 않고, 되돌릴 게 없으면 아무 일도 하지 않는다', () => {
    expect(keys).toContain("if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.altKey) {");
    expect(keys).toContain('if (inField || !lastSaveRef.current) return;');
    // 단어가 바뀌면 소멸 — 다른 단어의 행을 지우면 안 된다
    expect(viewer).toContain('useEffect(() => { lastSaveRef.current = null; }, [selectedToken?.id, selectedToken?.text]);');
    // 토스트 문구에 단축키(맥/그 외 라벨은 표기용, 동작은 양쪽)
    expect(viewer).toContain('저장됨 · ${UNDO_KEY_LABEL} 취소');
    expect(viewer).toMatch(/UNDO_KEY_LABEL = [\s\S]{0,200}\? '⌘Z' : 'Ctrl\+Z'/);
  });

  it('「이미 알아요」 쓰기 일몰 — 뷰어에 markKnown 호출 0, unmarkKnown(취소)만 남고 읽기 경로는 불변', () => {
    expect(viewer).not.toMatch(/\bmarkKnown\(/);
    expect(viewer).toContain('unmarkKnown(user.id, knownLangCode, wordText)');
    expect(card).toContain('{knownLangCode && isKnown && (');
    expect(card).not.toContain('👌 이미 알아요');
    // 읽기: 커버리지 병합·known 집합 조회는 그대로
    expect(viewer).toContain('fetchKnownWords');
    expect(viewer).toContain('knownWordSet?.has(selectedToken.text)');
    expect(read('src/lib/knownWords.js')).toContain('export async function markKnown'); // lib는 그대로(다른 화면 읽기·향후 재개)
  });
});
