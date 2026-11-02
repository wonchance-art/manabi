// VIEWER-META-TIMEOUT-001 — /viewer/[id] 제목 조회는 환경 변수 서버 클라이언트로, 시간 제한을 둔다.
// 운영 주소 · 키를 박아 두면 e2e가 운영 DB로 나가고, 그쪽이 느려지면 서버 렌더가 멈춘다(2026-10-15 KST CI 실측).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';

const page = fs.readFileSync('src/app/(app)/viewer/[id]/page.jsx', 'utf8');

describe('뷰어 제목 조회', () => {
  it('박아 둔 Supabase 주소 · 키 없이 공용 서버 클라이언트를 쓴다', () => {
    expect(page).not.toMatch(/supabase\.co|sb_publishable_|createServerClient\(/);
    expect(page).toContain("import { createSupabaseServerClient } from '@/lib/supabaseServer';");
  });

  it('조회에 시간 제한(2.5초)을 두고, 실패하면 기본 제목', () => {
    const meta = sliceBetween(page, 'export async function generateMetadata', 'export default function Page');
    expect(page).toContain('const VIEWER_META_TIMEOUT_MS = 2500;');
    expect(meta).toContain('.abortSignal(AbortSignal.timeout(VIEWER_META_TIMEOUT_MS))');
    expect(meta).toContain("return { title: '자료 뷰어' };");
  });

  it('서버 제목이 기본값으로 떨어지면 뷰어가 자료 제목으로 탭 제목을 되살린다', () => {
    const viewer = fs.readFileSync('src/views/ViewerPage.jsx', 'utf8');
    expect(viewer).toContain("const VIEWER_FALLBACK_TITLE = '자료 뷰어 · manabi';");
    expect(viewer).toMatch(/if \(viewerTitle && document\.title === VIEWER_FALLBACK_TITLE\) document\.title = `\$\{viewerTitle\} · manabi`;/);
  });
});
