import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

// 학습 쪽 화면 직렬 대기 걷어내기(LEARN-PAGES, 2026-10-17 KST — 빌드 실측).
// ① 노트: 판서 캔버스 묶음(약 360KB)이 노트 응답 뒤에야 받기 시작했다(1440: 노트 0.73초 → 캔버스 시작 → 그림 2.25초).
//    편집기가 마운트되는 즉시 같은 import로 미리 받는다(노트 조회와 나란히). 손님(게이트)은 받지 않는다.
// ② 노트 화면의 링크는 화면 진입 prefetch를 하지 않는다(서재 RSC가 노트 · 캔버스와 같은 시각에 받아졌다) — 저장소 관례.
// ③ 책장: 교재 두 권과 레벨 타일(일본어 · 중국어)을 한꺼번에 시작한다(교재 → 일본어 타일 → 중국어 타일 직렬이었다).
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('노트 — 캔버스 묶음을 노트 조회와 나란히', () => {
  const src = read('src/components/notes/StudyNotePage.jsx');
  it('dynamic Canvas와 미리 받기가 같은 import 함수 하나를 쓴다', () => {
    expect(src).toContain("const loadCanvas=()=>import('@/components/classroom/TeachingBoardCanvas');");
    expect(src).toContain('const Canvas = dynamic(()=>loadCanvas().then(module=>module.SharedBoardCanvas),');
    expect(src.match(/import\('@\/components\/classroom\/TeachingBoardCanvas'\)/g)).toHaveLength(1);
  });
  it('편집기 마운트 첫 효과에서 받기 시작한다 — 노트 응답(store.ready)을 기다리지 않고, 손님 게이트에서는 받지 않는다', () => {
    const editor = sliceBetween(src, 'function NoteEditor({owner,id}) {', 'if(!store.ready)return');
    expect(editor.indexOf('useEffect(()=>{void loadCanvas().catch(noop);},[]);')).toBeGreaterThan(-1);
    expect(editor.indexOf('useEffect(()=>{void loadCanvas().catch(noop);},[]);')).toBeLessThan(editor.indexOf('useStudyNote(owner,id)'));
    const gate = sliceBetween(src, 'export default function StudyNotePage({id}) {', '\n}');
    expect(gate).not.toContain('loadCanvas');
  });
  it('노트 화면 링크는 진입 prefetch를 끈다', () => {
    const links = src.match(/<Link\b[^>]*>/g) || [];
    expect(links.length).toBeGreaterThanOrEqual(4);
    expect(links.filter(l => !l.includes('prefetch={false}'))).toEqual([]);
  });
});

describe('책장 — 교재와 레벨 타일을 한꺼번에', () => {
  // 책장 서버 판은 LessonsShelf(기본 · 언어 판이 함께 쓴다, GUEST-STATIC-001 3단계)다.
  const src = read('src/components/books/LessonsShelf.jsx');
  it('교재 · 타일을 Promise.all 하나로 시작하고, 타일 실패는 빈 타일(책장은 그대로)', () => {
    const page = sliceBetween(src, 'export default async function LessonsShelf', '\n}');
    expect(page).toContain('await Promise.all([');
    expect(page).toContain("Promise.all([levelTileCounts('japanese'), levelTileCounts('chinese')]).then(([Japanese, Chinese]) => ({ Japanese, Chinese }), () => ({})),");
    expect(page).not.toMatch(/await levelTileCounts\(/);
  });
});
