// VOCAB-FLOW-001 (2026-10-17 KST) — /vocab 흐름 점검(합성 회원 픽스처 · 390 · 1440 · CPU 4배 · 응답 지연 150ms)에서 고친 둘.
// ① 복습 시작: 입장 한도 → FSRS 목록을 차례로 읽어 첫 카드까지 왕복이 하나 더 들었다(입장 57–212 → FSRS 235–388 → 첫 질문 424–606ms).
//    둘은 서로의 결과를 쓰지 않는 읽기다 — 함께 보낸다. 실패하면 지금처럼 시작하지 않는다.
// ② 오늘 카드 제목: 준비 중엔 session.total이 0이라 「잠시, 읽기로 돌아가요.」(오늘 끝)가 0.1~1초 보였다가 「오늘 다시 볼 표현」으로
//    바뀌었다(거짓 끝 상태). 준비 중엔 제목도 골격(LOADING-SKELETON-001) — 안내 줄 「복습 준비 중…」과 같은 판정.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const code = fs.readFileSync(path.join(ROOT, 'src/views/VocabPage.jsx'), 'utf8')
  .split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
const between = (from, to) => { const a = code.indexOf(from); expect(a, from).toBeGreaterThanOrEqual(0); const b = code.indexOf(to, a + from.length); return code.slice(a, b < 0 ? undefined : b); };

describe('VOCAB-FLOW-001 ① 복습 시작 — 입장 한도 · FSRS 목록을 함께 읽는다', () => {
  const start = between('const startSession = async', 'const planned =');
  it('두 refresh를 Promise.all로 함께 보내고, 둘 다 성공해야 시작한다', () => {
    expect(start).toContain('await Promise.all([admission.controller.refresh(), fsrsReview.controller.refresh()])');
    expect(start).toContain('if (!admissionOk || !fsrsOk || !workspaceAlive.current) return;');
  });
  it('차례로 기다리는 꼴이 되살아나지 않는다', () => {
    expect(start).not.toMatch(/await admission\.controller\.refresh\(\)\)\s*\|\|\s*!\(await fsrsReview/);
    expect(start.match(/\.refresh\(\)/g)).toHaveLength(2);
  });
});

describe('VOCAB-FLOW-001 ② 오늘 카드 — 준비 중엔 제목도 골격(거짓 「오늘 끝」 없음)', () => {
  it('준비 판정 하나(heroPending)를 제목 · 안내 줄이 같이 쓴다', () => {
    expect(code).toContain("const heroPending = admission.status !== 'ready' || session.status !== 'ready';");
    expect(code).toContain('{heroPending ? <p aria-busy="true" className="review-room-note">복습 준비 중…</p>');
  });
  it('제목은 준비 중 분기(골격 + 화면 읽기 이름)가 먼저이고, 끝 · 첫 표현 문구는 그 뒤에만 온다', () => {
    const heading = between('<h2 id="review-today-title">', '</h2>');
    const pending = heading.indexOf('heroPending'), skeleton = heading.indexOf('<SkeletonLine'), done = heading.indexOf('잠시, 읽기로 돌아가요.');
    expect(pending).toBeGreaterThanOrEqual(0);
    expect(skeleton).toBeGreaterThan(pending);
    expect(done).toBeGreaterThan(skeleton);
    expect(heading).toContain('<span className="sr-only">오늘 복습</span>');
    expect(heading).toContain("session.total ? '오늘 다시 볼 표현' : hasAnyWords ? '잠시, 읽기로 돌아가요.' : '첫 표현을 담아 보세요.'");
  });
});
