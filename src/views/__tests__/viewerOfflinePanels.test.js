import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// OFFLINE-SWEEP-001 — 끊긴 채 처음 여는 읽기 설정이 뷰어를 오류 화면으로 바꾸지 않게, 유휴 시간에 그 조각을 받아 둔다.
// 390 실측(2026-10-23 KST, 워커 있음 · 없음 둘 다): 뷰어를 읽다 끊긴 뒤 「Aa 읽기 설정」 → 조각 실패 → 오류 경계 「자료를 불러오지 못했어요」,
// 본문 토큰 0(읽던 화면이 사라짐). 한자 창 유휴 미리 받기(VIEWER-LAZY-PANELS-001)와 같은 길(onIdle + preload)을 쓴다.
const viewer = fs.readFileSync('src/views/ViewerPage.jsx', 'utf8');

describe('뷰어 — 읽기 설정 부품 유휴 미리 받기', () => {
  it('마운트 뒤 유휴 시간에 ViewerSettings.preload()를 부르고, 떠나면 취소한다(onIdle 반환값이 정리)', () => {
    expect(viewer).toMatch(/useEffect\(\(\) => onIdle\(\(\) => \{ ViewerSettings\.preload\(\)\.catch\(\(\) => \{\}\); \}\), \[\]\);/);
  });
  it('여전히 지연 부품이다(정적 import 0 · 열 때 조건 그대로) — 첫 그림 무게는 늘지 않는다', () => {
    expect(viewer).not.toMatch(/^import ViewerSettings /m);
    expect(viewer).toContain("const ViewerSettings = lazyPanel(() => import('../components/viewer/ViewerSettings'));");
    expect(viewer).toContain('{settingsOpen&&<ViewerSettings ');
  });
});
