// REVIEW-SHELF-CLS-001 (2026-10-18 KST, 목업 A안 scratchpad/mockups/cls-vocab-materials.md) — 서버 미리 받기를 놓친 서재는 읽던 곳 · 대화 ·
// 목록 첫 쪽이 정해진 뒤 세 칸을 한 번에. 칸마다 풀리며 읽던 곳 골격(157px)이 사라지고 대화 골격이 줄어 목록을 끌어올리던 것(390 CLS 0.14–0.15 → 0).
// 흔들림 · 실패 칸 경로는 e2e library-management가 본다. 여기서는 미리 받은 서재 무변화 · 실패=정해짐 · 상한 · 같은 골격 한 벌을 지킨다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const shelf = read('src/components/library/LibraryShelf.jsx');
const skeleton = read('src/components/library/LibrarySkeleton.jsx');

describe('서재 몸 첫 그림(REVIEW-SHELF-CLS-001)', () => {
  it('미리 받은 서재(ssr)는 처음부터 드러나 있다 — 기다림은 미리 받기를 놓친 경로뿐', () => {
    expect(shelf).toContain('const [bodyRevealed,setBodyRevealed]=useState(ssr);');
  });
  it('한 칸의 첫 실패도 정해진 것 — 다시 받기(retry)를 기다리며 다른 칸을 막지 않는다', () => {
    expect(shelf).toContain('const settling=query=>query.isPending&&query.failureCount===0;');
    expect(shelf).toContain('const bodyLoading=shelfBody&&(settling(recent)||settling(conversations)||settling(list));');
  });
  it('읽던 곳은 RecentReads와 같은 쿼리 정본(같은 키 — 요청 하나)', () => {
    expect(shelf).toContain('const recent=useQuery({...libraryRecentQuery(supabase,user.id),enabled:shelfBody});');
  });
  it('한 번 드러나면 다시 골격으로 돌아가지 않고, 상한이 지나면 기다리지 않는다', () => {
    expect(shelf).toContain('useEffect(()=>{if(!bodyLoading)setBodyRevealed(true);},[bodyLoading]);');
    expect(shelf).toMatch(/setTimeout\(\(\)=>setBodyRevealed\(true\),SHELF_REVEAL_CAP_MS\)/);
    expect(shelf).toMatch(/const SHELF_REVEAL_CAP_MS=\d+;/);
  });
  it('기다리는 동안은 로그인 확인 골격과 같은 몸 골격 한 벌 — 새 골격을 만들지 않는다', () => {
    expect(shelf).toContain('{bodyWaiting?<LibraryShelfBodySkeleton/>:<>');
    expect(skeleton).toContain('<div className="shelf-content"><LibraryShelfBodySkeleton live={false} /></div>');
    expect(skeleton.match(/<RecentReadsSkeleton \/>/g)).toHaveLength(1);
  });
});
