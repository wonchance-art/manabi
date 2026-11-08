import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { answerTextForItem, settleAnnouncement } from '../studySession';
import { trapTab } from '../useDialogReturn';
import { sliceBetween } from './helpers/sliceBetween';

// A11Y-AUTH-001 로그인 화면 접근성 훑기(2026-11-08 KST, 합성 무거운 계정 · 폰 390 · PC 1280 · axe WCAG 2.1 A/AA 위반 0) — 화면 무변화 고침 셋:
// ① useDialogReturn 창(현황 · 내 정보 10곳)에서 Tab이 뒤 화면으로 빠져나가 닫은 뒤 포커스가 푸터 · 머리 메뉴에 남았다 → 창 안에서 돈다.
// ② /study 채점이 색으로만 보여 화면 읽기가 맞고 틀림을 듣지 못했다 → 늘 있는 알림 영역에 「정답이에요.」 · 「틀렸어요. 정답: …」.
// ③ /study 진행 화면 · 복습 세션에 제목(h1)이 없었다(best-practice) → 화면 읽기용 h1.
const ROOT = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

// 아주 작은 문서 대역 — trapTab이 쓰는 것만(activeElement · contains · querySelectorAll · getClientRects · closest · focus).
function fakeDialog(names, { outsideModal = false } = {}) {
  const doc = { activeElement: null };
  const node = (name, extra = {}) => ({ name, getClientRects: () => [1], closest: () => null, focus() { doc.activeElement = this; }, ...extra });
  const items = names.map((n) => node(n));
  const box = { name: 'box', ownerDocument: doc, contains: (x) => x === box || items.includes(x), querySelectorAll: () => items, focus() { doc.activeElement = box; } };
  const pageLink = node('page-link');
  const otherModal = node('other-modal-button', { closest: (sel) => (sel === '[aria-modal="true"]' && outsideModal ? {} : null) });
  return { doc, box, items, pageLink, otherModal };
}
const key = (shiftKey = false) => ({ key: 'Tab', shiftKey, preventDefault: vi.fn() });

describe('① 창 안 Tab 가둠(useDialogReturn · trapTab)', () => {
  it('끝에서 Tab → 처음 · 처음에서 Shift+Tab → 끝, 가운데는 브라우저 순서 그대로', () => {
    const { doc, box, items } = fakeDialog(['close', 'a', 'save']);
    doc.activeElement = items[2]; let e = key(); trapTab(e, box);
    expect(doc.activeElement).toBe(items[0]); expect(e.preventDefault).toHaveBeenCalled();
    doc.activeElement = items[0]; e = key(true); trapTab(e, box);
    expect(doc.activeElement).toBe(items[2]); expect(e.preventDefault).toHaveBeenCalled();
    doc.activeElement = items[1]; e = key(); trapTab(e, box);
    expect(doc.activeElement).toBe(items[1]); expect(e.preventDefault).not.toHaveBeenCalled();
  });
  it('포커스가 이미 뒤 화면에 있으면 창 첫 칸(Shift면 끝 칸)으로 되돌린다 · 상자 자체에 있어도 같다', () => {
    const { doc, box, items, pageLink } = fakeDialog(['close', 'save']);
    doc.activeElement = pageLink; let e = key(); trapTab(e, box);
    expect(doc.activeElement).toBe(items[0]); expect(e.preventDefault).toHaveBeenCalled();
    doc.activeElement = box; e = key(true); trapTab(e, box);
    expect(doc.activeElement).toBe(items[1]);
  });
  it('위에 열린 다른 창(aria-modal) 안의 포커스는 건드리지 않는다 · 조작 요소가 없으면 상자에', () => {
    const nested = fakeDialog(['close'], { outsideModal: true });
    nested.doc.activeElement = nested.otherModal; const e = key(); trapTab(e, nested.box);
    expect(nested.doc.activeElement).toBe(nested.otherModal); expect(e.preventDefault).not.toHaveBeenCalled();
    const empty = fakeDialog([]);
    empty.doc.activeElement = empty.pageLink; trapTab(key(), empty.box);
    expect(empty.doc.activeElement).toBe(empty.box);
  });
  it('이 훅을 쓰는 창 — 목표 · 내 정보 시트 · 현황 타일 · 문형 카드', () => {
    for (const f of ['src/components/goal/GoalSheet.jsx', 'src/components/profile/ProfileParts.jsx', 'src/views/ProfileStats.jsx', 'src/views/ReadingTextView.jsx']) {
      expect(read(f), f).toMatch(/useDialogReturn\(/);
    }
  });
});

describe('② /study 채점 알림(화면 읽기 전용)', () => {
  it('맞음 · 틀림(정답 글 포함) · 정답 글을 모르는 유형', () => {
    expect(settleAnnouncement(true, { type: 'vocab-choice', word: { meaning: '전철' } })).toBe('정답이에요.');
    expect(settleAnnouncement(false, { type: 'vocab-choice', word: { meaning: '전철' } })).toBe('틀렸어요. 정답: 전철');
    expect(settleAnnouncement(false, { type: 'read-meaning', correct: '역' })).toBe('틀렸어요. 정답: 역');
    expect(settleAnnouncement(false, { type: 'grammar-cloze', quiz: { correct: 'で' } })).toBe('틀렸어요. 정답: で');
    expect(settleAnnouncement(false, { type: 'vocab-match' })).toBe('틀렸어요.');
    expect(answerTextForItem({ type: 'grammar-order', quiz: { answer: '今日は 駅で' } })).toBe('今日は 駅で');
    expect(answerTextForItem({ type: 'vocab-typing', word: { word_text: '駅' } })).toBe('駅');
    expect(answerTextForItem({ type: 'example-order', sentence: { main: '駅へ行く。' } })).toBe('駅へ行く。');
    expect(answerTextForItem({ type: 'vocab-choice', word: {} })).toBeNull();
  });
  it('알림 영역은 문항마다 먼저 그려 두고(빈 글) 채점 때 내용만 넣는다 · 화면에는 그리지 않는다', () => {
    const page = read('src/views/StudySessionPage.jsx');
    const item = sliceBetween(page, '<div key={item.uid} ref={itemRef} className="study-item">', '{/* 계속 버튼');
    expect(item).toContain('<span className="sr-only" role="status" data-settle-announce="">');
    expect(item).toContain("{phase === 'feedback' && item.type !== 'produce-writing' && settledOk !== null ? settleAnnouncement(settledOk, item) : ''}");
    expect(page).toContain('setSettledOk(!!ok);');
  });
});

describe('③ 화면 읽기용 제목(h1)', () => {
  it('/study 진행 화면 · 복습 세션(머리를 걷은 상태)', () => {
    const progress = sliceBetween(read('src/views/StudySessionPage.jsx'), '// ── 진행 화면 ──', '{/* 헤더 — 나가기 · 진행바 · 언어 */}');
    expect(progress).toContain('<h1 className="sr-only">오늘 학습</h1>');
    expect(read('src/views/VocabPage.jsx')).toContain("{sessionChrome && <h1 className=\"sr-only\">{tab === 'practice' ? '집중 연습' : '복습'}</h1>}");
  });
});
