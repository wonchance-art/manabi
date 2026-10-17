// PASSAGE-OPENER-FOCUS-001 (2026-10-17 KST) — 구간에서 온 원본(/viewer/{원본}?passage={구간})은 출처를 받는 동안 위치 동기화를
// 꺼 둔 채(ready=true) 본문을 먼저 그리고, 출처가 오면 동기화가 처음부터(ready=false → true) 다시 돈다. 그때 본문이 내려갔다 올라와
// 구간 목록이 비고 「일부만 고르기」가 disabled로 깜박였다 — 그 단추에 있던 초점은 제목으로 가고, 그 사이 Enter · Esc가 헛돌았다
// (source-passage e2e 「lost response」 4/5 실패, 실측: 단추 enabled 77ms → disabled 130ms → enabled 163ms).
// 계약: 한 번 그린 본문(과 그 구간 출처 · 쪽 넘김)은 ready가 다시 false가 돼도 내리지 않는다. 위치 기록은 지금 ready를 따른다.
// 실제 깜박임 0은 빌드 e2e(source-passage)가 본다.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween';

const source = fs.readFileSync(path.join(process.cwd(), 'src/components/materials/OriginalMaterialReader.jsx'), 'utf8');

describe('원본 본문은 한 번 그리면 동기화 재시작에 내려가지 않는다', () => {
  it('ready가 한 번이라도 true였으면 bodyShown — 렌더 중 ref로 고정(다음 커밋까지 기다리지 않는다)', () => {
    const sticky = sliceBetween(source, 'const bodyShownRef=useRef(false);', 'const bodyShown=bodyShownRef.current;');
    expect(sticky).toContain('if(sync.state.ready)bodyShownRef.current=true;');
    expect(sticky).not.toMatch(/bodyShownRef\.current=false/);
  });

  it('본문 마운트 · 구간 출처(bodySource) · 쪽 넘김은 bodyShown을 따른다', () => {
    expect(source).toContain('{bodyShown&&composer.body?.trim() && <>');
    expect(source).not.toContain('{sync.state.ready&&composer.body?.trim() && <>');
    const body = sliceBetween(source, 'useEffect(()=>{setBodySource(', ');},[');
    expect(body).toContain('bodyElement.current?');
    expect(sliceBetween(source, "textVersion:'plain-v1'}}:null);},[", ']);')).toBe("textVersion:'plain-v1'}}:null);},[composer.body,composer.revision,bodyShown");
    expect(source).toContain('const pager=usePagedReader({enabled:bodyPaged&&bodyShown,');
  });

  it('위치 기록 · 첫 위치 적용은 지금 ready 그대로(동기화가 끝나기 전에는 기록하지 않는다)', () => {
    expect(source).toContain('useOriginalTextPosition({element:bodyElement,source:bodyPositionSource,base:{},enabled:sync.state.ready,');
    expect(source).toContain('if(!sync.state.ready||booted.current||origin.isPending&&passageId)return;');
  });
});
