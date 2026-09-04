import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

// 🧹 자료실 「내 자료」 정돈(미니멀) R1 — #1077 5547520918 (오너 「미니멀리즘적으로 깔끔하게」 2026-09-03).
// 제목이 첫 줄, 메타 한 줄, 상태 하나(예외만), 액션은 ⋯ 메뉴 하나. 정보는 안 잃고 상시 노출만 줄인다.
// 기존 핀(안 읽은 것만·받아두기·묶음 카드·언어명 정본·쿼리 다이어트)은 각자 파일이 그대로 지킨다.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const page = () => read('src/views/MaterialsPage.jsx');
const cardBlock = () => sliceBetween(page(), 'return [...bookCards, ...pdfCards, ...singles', '\n            })];');

describe('자료실 정돈 R1 — 카드 위계', () => {
  it('헤더는 제목만 — 설명 문장 없음, 페이지 스코프 클래스로 여백을 조인다', () => {
    expect(page()).not.toContain('page-header__subtitle');
    expect(page()).toContain('className="page-container materials-page"');
  });

  it('제목이 첫 줄 — 언어명 큰 글자(card__flag) 폐지, 메타 한 줄은 langNameKo 정본', () => {
    expect(page()).not.toContain('className="card__flag"');
    const card = cardBlock();
    expect(card.indexOf('className="card__title"')).toBeLessThan(card.indexOf('className="mat-card__meta"'));
    expect(card).toContain('langNameKo(language)');
  });

  it('상태는 오른쪽 하나 — 완독 / 진행 % / 예외(분석 중·실패·일부·분석 전). 정상 완료·노트는 무표기, 「대기 중」 없음', () => {
    const state = sliceBetween(cardBlock(), 'const stateBadge = (() => {', '})();');
    expect(state).toContain('if (isNote) return null;');
    expect(state).toContain('if (isCompleted) return <span className="mat-state mat-state--done">✓ 완독</span>;');
    expect(state).toContain('if (!isDone) return <span className="mat-state">분석 전</span>;');
    expect(state.trimEnd().endsWith('return null;')).toBe(true);
    expect(state).not.toMatch(/'완료'|>완료</);
    expect(page()).not.toMatch(/'대기 중'|>대기 중</); // 렌더 문자열로만 본다(주석 「복습 대기 중인 단어」는 무관)
  });

  it('액션 3종은 ⋯ 메뉴 안에만 — 상시 버튼 부활 금지', () => {
    const card = cardBlock();
    expect(card.split('<details').length - 1).toBe(1);
    const menu = sliceBetween(card, '<details', '</details>');
    expect(menu).toContain('className="mat-menu"');
    expect(menu).toContain('togglePin(m.id)');
    expect(menu).toContain("{m.visibility === 'public' ? '비공개로' : '공개로'}");
    expect(menu).toContain('삭제');
    expect(card.split('togglePin(m.id)').length - 1).toBe(1);
    expect(card).not.toContain('btn btn--ghost btn--sm');
    // 메뉴 안 클릭은 카드(뷰어 이동)로 새지 않는다
    expect(menu).toContain('onClick={(e) => e.stopPropagation()}');
  });

  it('묶음 카드 — 「분석 N/N」 없이 읽음만, 분석 전은 있을 때만 · 과별 「완료」 태그 없음', () => {
    expect(page()).not.toMatch(/분석 \$\{analyzed\}\//);
    expect(page()).toContain("${pendingCount > 0 ? ` · 분석 전 ${pendingCount}` : ''}");
    const tags = sliceBetween(page(), 'const chapterTags = (c) => {', '\n  };');
    expect(tags).toContain('STATUS_LABEL[st] && (');
    expect(tags).not.toContain("|| '완료'");
  });

  it('빈 상태 — 아이콘 자리 없음(자료실)', () => {
    expect(page()).not.toContain('empty-state__icon');
  });
});

describe('자료실 정돈 R1 — CSS(규약 §1 토큰·§3 44px)', () => {
  const css = () => read('src/index.css');
  const block = () => sliceBetween(css(), '/* ========= 자료실 정돈(미니멀', '/* ========= /자료실 정돈 ========= */');

  it('여백·빈 상태 조정은 .materials-page 스코프 — 같은 클래스를 쓰는 단어장·교재는 그대로', () => {
    expect(block()).toContain('.materials-page .filter-row');
    expect(block()).toContain('.materials-page .empty-state');
    expect(sliceBetween(css(), '.filter-row {', '}')).toContain('margin-bottom: 32px');
  });

  it('⋯ 버튼은 44px 터치 타깃 + focus-visible, 블록 안 색은 토큰만', () => {
    const b = block();
    expect(sliceBetween(b, '.mat-menu__btn {', '}')).toMatch(/min-width: 44px;[\s\S]*min-height: 44px;/);
    expect(b).toContain('.mat-menu__btn:focus-visible');
    // 주석(#1077 같은 이슈 번호)은 색이 아니다 — 선언부만 본다
    expect(b.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(b).toContain('var(--');
  });
});
