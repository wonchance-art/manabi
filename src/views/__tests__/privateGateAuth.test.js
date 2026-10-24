// PRIVATE-GATE-AUTH-001 · READER-MOUNT-001 — 계정 확인 전에는 비공개 판정을 하지 않고, 본문이 늦게 붙어도 본문을 읽는 효과가 다시 걸린다.
// 실측(2026-10-24 KST, e2e viewer-paged-reader 390): 비공개 자료가 계정 확인(AuthContext — 문서 파싱 뒤 세션 복원)보다 먼저 오면
// 주인이 「비공개 자료예요」를 약 0.3초 보고 본문은 그 뒤에 붙었다. 본문을 한 번만 읽는 효과는 그 판에서 아무 일도 하지 않았다.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const viewer = read('src/views/ViewerPage.jsx');

describe('비공개 판정은 계정 확인 뒤에(PRIVATE-GATE-AUTH-001)', () => {
  const gate = "if (material?.visibility === 'private' && material?.owner_id !== user?.id && !material?.__local) {";
  const block = sliceBetween(viewer, gate, '\n  }\n');
  it('계정 확인 중(authLoading)에는 불러오기 골격 — 판정 문구보다 먼저', () => {
    const loading = block.indexOf('if (authLoading) return <div className="page-container"><Spinner message="자료 불러오는 중…" /></div>;');
    expect(loading).toBeGreaterThan(0);
    expect(loading).toBeLessThan(block.indexOf('비공개 자료예요'));
  });
  it('골격에는 자료 제목 · 본문을 싣지 않는다(account-boundary — 비공개 제목 노출 금지)', () => {
    const line = block.split('\n').find(l => l.includes('if (authLoading)'));
    expect(line).not.toMatch(/material|title|raw_text/);
  });
  it('계정이 정해진 뒤의 손님 · 비소유자 판정은 그대로(「비공개 자료예요」)', () => {
    expect(block).toContain('{vt("비공개 자료예요")}');
    expect(block).toContain('{vt("이 자료는 작성자만 볼 수 있어요.")}');
    // authLoading은 뷰어가 쓰는 정본 그대로(useAuth) — 세션 쿠키가 없으면 AuthContext가 손님으로 확정해 loading을 내린다.
    expect(viewer).toContain('const { user, profile, fetchProfile, isAdmin, loading: authLoading } = useAuth();');
  });
});

describe('본문이 늦게 붙어도 본문을 읽는 효과가 다시 걸린다(READER-MOUNT-001)', () => {
  it('본문은 콜백 ref로 붙고 그 요소(readerEl)를 상태로 둔다', () => {
    expect(viewer).toContain('const attachReader = useCallback(node => { readerRef.current = node; setReaderEl(node); }, [readerRef]);');
    expect(viewer).toContain('ref={attachReader}');
    expect(viewer).not.toContain('ref={readerRef}');
  });
  it('본문을 한 번 읽는 효과는 readerEl을 함께 본다', () => {
    expect(viewer).toContain('useReadProgress(material, readerEl)');
    expect(viewer).toContain('useReaderLayout(readerRef, material?.processed_json, readerEl)');
    expect(viewer).toMatch(/useSelectedTokenVisibility\(readerRef, tokenRefs, selectionToReveal, [^\n]*, material\?\.processed_json, readerEl\);/);
    expect(viewer).toContain('},[materialLang,fontSize,pinyinSize,material?.id,readerRef,readerEl]);');
    expect(read('src/lib/useReadProgress.js')).toContain('}, [material, mounted]);');
    const layout = read('src/lib/useReaderLayout.js');
    expect(layout).toContain('},[readerRef,revision,mounted]);');
    expect(layout).toContain('}, [readerRef, revision, mounted]);');
  });
});
