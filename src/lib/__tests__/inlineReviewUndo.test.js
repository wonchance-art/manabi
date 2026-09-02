import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { SAVE_GRADES } from '../vocabIO';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');
const hook = read('src/lib/useInlineReview.js');

/**
 * 계약: W R3㉮ 인라인 복습 — 4등급 정렬 + 키 + undo (오너 지시 2026-09-02, #1077 5504387198).
 * 인라인 `모름/애매/알아`=1/2/3은 Easy(4)가 없어 D 2.12 경로만 열려 있었다(복습 화면 「쉬움」은 1.00).
 * 정본 척도로 정렬 → R2 undo 모델(SRS 5필드 복원 + source:'ui' 보상 이벤트). 세션이 없으니 되감을
 * 것은 카드 상태뿐 — vocab-words 무효화로 「복습 시점이에요」가 저절로 돌아온다.
 */
describe('인라인 복습 R3㉮ — 척도 정렬·스냅샷 재료·undo (ViewerPage·useInlineReview)', () => {
  const card = sliceBetween(viewer, 'const wordDetailCard = !selectedToken || !isSheetOpen ? null : (', 'const rightPanelContent =');
  const inline = sliceBetween(card, '복습 시점이에요</div>', '</div>\n      )}');

  it('인라인 채점 버튼의 라벨·순서·값이 복습 화면과 동일(1/2/3/4) — 옛 3버튼 척도 부활 금지', () => {
    expect(inline).toContain('{SAVE_GRADES.map((g) => (');
    expect(inline).toContain('onClick={() => gradeInline(g.grade)}');
    expect(inline).toContain('className={`review-score-btn review-score-btn--${g.cls}`}');
    expect(viewer).not.toMatch(/label: '모름'|label: '애매'|label: '알아'/);
    expect(SAVE_GRADES.map((g) => g.grade)).toEqual([1, 2, 3, 4]);
  });

  it('useInlineReview 결과에 prev(5필드)·reviewedAt이 실리고, fetchUserVocabWords select에 last_reviewed_at이 있다', () => {
    expect(hook).toContain("export const INLINE_SRS_FIELDS = ['interval', 'ease_factor', 'repetitions', 'next_review_at', 'last_reviewed_at'];");
    expect(hook).toContain('return { vocab, rating, nextStats, prev, reviewedAt };');
    expect(hook).toContain('await persistVocabGrade(supabase, vocab.id, nextStats, reviewedAt);');
    expect(hook).toContain('created_at: reviewedAt,');
    expect(viewer).toMatch(/\.select\('id, word_text, base_form, meaning, pos, furigana, interval, ease_factor, repetitions, next_review_at, last_reviewed_at, language'\)/);
  });

  it('undo 뒤 user_vocabulary 5필드가 스냅샷과 동일(last_reviewed_at 원값) + vocab-words 무효화로 「복습 시점이에요」가 다시 보인다', () => {
    const undo = sliceBetween(viewer, 'const undoInlineGrade = async () => {', '\n  };');
    expect(undo).toContain("const { last_reviewed_at: prevReviewedAt = null, ...prevStats } = last.prev || {};");
    expect(undo).toContain('await persistVocabGrade(supabase, last.wordId, prevStats, prevReviewedAt);');
    expect(undo).toContain("queryClient.invalidateQueries({ queryKey: ['vocab-words', user?.id] });");
    // 보상 이벤트 정확히 1건 — source ui · undo_of.reviewed_at = 원 채점 시각
    expect(undo.match(/logReviewEvents\(/g)).toHaveLength(1);
    expect(undo).toContain("lang: last.lang, source: 'ui', item_key: last.itemKey, correct: true,");
    expect(undo).toContain("detail: { qtype: 'undo', undo_of: { item_key: last.itemKey, rating: last.rating, reviewed_at: last.reviewedAt } },");
    // 스냅샷은 훅이 준 재료로 호출부가 만든다 — 성공 뒤에만
    const g = sliceBetween(viewer, 'const gradeInline = (rating) => {', '\n  };');
    expect(g).toContain('prev: res.prev, reviewedAt: res.reviewedAt,');
    expect(g).toContain('onSuccess: (res) => {');
  });

  it('키 1~4 — 저장 그리드와 인라인 그리드가 동시에 반응하지 않는다(상태상 배타), ⌘Z는 인라인 → 저장 순', () => {
    const keys = sliceBetween(viewer, 'const lastSaveRef = useRef(null);', '}, [selectedToken, isSheetOpen]);');
    expect(keys).toContain('if (h.inlineDue) { e.preventDefault(); h.gradeInline?.(Number(e.key)); return; }');
    expect(keys).toContain('if (h.saveLocked) return;');
    expect(keys).toContain('if (inField || (!lastSaveRef.current && !lastInlineGradeRef.current)) return;');
    expect(viewer).toContain('inlineDue: !!user && isWordSaved && isTokenDue(savedWords, selectedToken) && !inlineReviewMutation.isPending,');
    expect(viewer).toContain('const undoAny = () => (lastInlineGradeRef.current ? undoInlineGrade() : undoLastSave());');
    // 단어가 바뀌면 둘 다 소멸
    expect(viewer).toContain('useEffect(() => { lastSaveRef.current = null; lastInlineGradeRef.current = null; }, [selectedToken?.id, selectedToken?.text]);');
  });
});

describe('useInlineReview — 훅 단위: prev·reviewedAt 반환', () => {
  it('mutationFn이 채점 직전 5필드(있는 것만)와 같은 시각을 돌려준다', async () => {
    vi.doMock('../supabase', () => ({ supabase: {} }));
    vi.doMock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }), useMutation: (c) => c }));
    vi.doMock('../streak', () => ({ recordActivity: vi.fn() }));
    vi.doMock('../reviewEvents', () => ({ logReviewEvents: vi.fn() }));
    const persist = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../fsrs', () => ({ calculateFSRS: () => ({ interval: 1, ease_factor: 5, repetitions: 0, next_review_at: 'N' }), persistVocabGrade: persist }));
    const { useInlineReview } = await import('../useInlineReview');
    const config = useInlineReview({ user: { id: 'u' }, fetchProfile: vi.fn(), toast: vi.fn() });
    const vocab = { id: 'v', word_text: 'x', interval: 2, ease_factor: 3, repetitions: 1, next_review_at: 'A', last_reviewed_at: null };
    const res = await config.mutationFn({ vocab, rating: 4 });
    expect(res.prev).toEqual({ interval: 2, ease_factor: 3, repetitions: 1, next_review_at: 'A', last_reviewed_at: null });
    expect(typeof res.reviewedAt).toBe('string');
    expect(persist).toHaveBeenCalledWith({}, 'v', expect.objectContaining({ next_review_at: 'N' }), res.reviewedAt);
    vi.doUnmock('../supabase'); vi.doUnmock('@tanstack/react-query'); vi.doUnmock('../streak'); vi.doUnmock('../reviewEvents'); vi.doUnmock('../fsrs');
  });
});
