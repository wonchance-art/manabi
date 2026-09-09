import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { secretOf, signToken, verifyToken, verifyPassword, TOKEN_TTL_MS, TOKEN_HEADER } from '../server/classAccess.js';
import { indexFromRows, materialBelongsToTeam, toPayload } from '../server/classIndex.js';
import { hashPassword } from '../classPassword.js';

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

/**
 * 계약: v2-AB R2 해제·목록·페이로드 (#1077 5603827169 §7 R2 · 상세 5604199672 §4).
 * - 해제 토큰 없이는 목록·페이로드 라우트가 아무것도 주지 않는다; 틀린 암호와 없는 팀이 같은 응답
 * - 해제 라우트 IP 분당 제한(rateLimit 재사용); 암호 최소 6자
 * - 암호 변경 시 기존 토큰 전부 무효(pwGen)
 * - 팀 API가 내주는 행은 루트 소유자의 행만(학생 복제본은 metadata.team이 있어도 제외)
 * - 비공개 원본은 토큰 없이는 어떤 경로로도 익명에게 읽히지 않는다
 */

const SECRET = 'test-secret-that-is-long-enough-1234';
const SALT = '0123456789abcdef0123456789abcdef';

describe('해제 토큰 — 서명·만료·세대', () => {
  it('서명한 토큰은 검증되고, 팀·세대·만료가 그대로 나온다 · 만료 30일', () => {
    const exp = Date.now() + 1000;
    const t = signToken({ team: 'a', gen: 3, exp }, SECRET);
    expect(verifyToken(t, SECRET)).toEqual({ ok: true, team: 'a', gen: 3, exp });
    expect(TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(TOKEN_HEADER).toBe('x-class-token');
  });

  it('한 글자만 바뀌어도(페이로드·서명) 무효 · 다른 비밀로는 무효 · 비밀 없으면 무효', () => {
    const t = signToken({ team: 'a', gen: 1, exp: Date.now() + 1000 }, SECRET);
    const [payload, sig] = t.split('.');
    expect(verifyToken(`${payload}x.${sig}`, SECRET).ok).toBe(false);
    expect(verifyToken(`${payload}.${sig.slice(0, -1)}${sig.endsWith('a') ? 'b' : 'a'}`, SECRET).ok).toBe(false);
    expect(verifyToken(t, 'another-secret-that-is-long-enough').ok).toBe(false);
    expect(verifyToken(t, null)).toEqual({ ok: false, reason: 'no-secret' });
    for (const bad of [null, '', 'abc', 'a.b', 'x'.repeat(600)]) expect(verifyToken(bad, SECRET).ok).toBe(false);
  });

  it('만료된 토큰은 무효 — 30일 뒤 다시 입력', () => {
    const t = signToken({ team: 'a', gen: 1, exp: 1000 }, SECRET);
    expect(verifyToken(t, SECRET, { now: 1001 })).toEqual({ ok: false, reason: 'expired' });
    expect(verifyToken(t, SECRET, { now: 999 }).ok).toBe(true);
  });

  it('SHARE_LINK_SECRET은 16자 이상일 때만 설정된 것으로 본다(짧은 비밀은 없는 것과 같다)', () => {
    expect(secretOf({})).toBeNull();
    expect(secretOf({ SHARE_LINK_SECRET: 'short' })).toBeNull();
    expect(secretOf({ SHARE_LINK_SECRET: SECRET })).toBe(SECRET);
  });
});

describe('암호 검증', () => {
  it('맞는 암호만 true · 틀린 암호·해시 없는 팀·팀 없음은 false(같은 비용을 치른다)', async () => {
    const pwHash = await hashPassword('수업암호', SALT);
    const team = { pwHash, pwSalt: SALT, pwGen: 1 };
    expect(await verifyPassword('수업암호', team)).toBe(true);
    expect(await verifyPassword('수업암호!', team)).toBe(false);
    expect(await verifyPassword('수업암호', { pwSalt: SALT })).toBe(false);
    expect(await verifyPassword('수업암호', null)).toBe(false);
  });
});

describe('목록·페이로드 — 루트 소유자의 행만', () => {
  const team = { key: 'a', name: 'A팀', lang: 'Japanese', bookKey: 'bk_1', bookTotal: 41, chapterId: null, pwGen: 1, root: true };
  const root = { id: 1, owner_id: 'teacher' };
  const chapter = (id, order, owner = 'teacher', key = 'bk_1') => ({
    id, owner_id: owner, title: `교재 — ${order}과`, created_at: '2026-09-01',
    processed_json: { status: 'completed', metadata: { book: { key, title: '교재', order }, updated_at: `2026-09-0${order}` } },
  });
  const note = (id, day, owner = 'teacher') => ({
    id, owner_id: owner, title: `[A팀] ${day} 수업`, raw_text: '道歉\n\nお邪魔します', created_at: '2026-09-09',
    processed_json: { metadata: { team: { key: 'a', day }, updated_at: '2026-09-09T10:00:00Z' } },
  });

  it('목록은 과(순번 오름차순)·정리본(최근 먼저)이고 다른 책·다른 팀 행은 걸러진다', () => {
    const idx = indexFromRows({
      team,
      chapterRows: [chapter(12, 12), chapter(3, 3), chapter(99, 1, 'teacher', 'bk_other')],
      noteRows: [note(20, '2026-09-02'), note(21, '2026-09-09'), { id: 30, owner_id: 'teacher', title: 'x', processed_json: { metadata: { team: { key: 'b', day: '2026-09-09' } } } }],
    });
    expect(idx.team).toEqual({ key: 'a', name: 'A팀', lang: 'Japanese', bookKey: 'bk_1', bookTitle: '교재', bookTotal: 41, chapterId: null });
    expect(idx.chapters.map((c) => c.id)).toEqual([3, 12]);
    expect(idx.chapters[0]).toEqual({ id: 3, title: '교재 — 3과', order: 3, status: 'completed', updatedAt: '2026-09-03' });
    expect(idx.notes.map((n) => n.id)).toEqual([21, 20]);
    expect(idx.notes[0]).toEqual({ id: 21, title: '[A팀] 2026-09-09 수업', day: '2026-09-09', lines: 2, updatedAt: '2026-09-09T10:00:00Z' });
    // 목록에 raw_text·processed_json 본문이 실리지 않는다(페이로드 라우트가 따로)
    expect(JSON.stringify(idx)).not.toContain('道歉');
  });

  it('페이로드 판정 — 소유자가 다르면(학생 복제본 포함) 팀 메타가 있어도 null', () => {
    expect(materialBelongsToTeam(chapter(3, 3), team, root)).toBe('chapter');
    expect(materialBelongsToTeam(note(21, '2026-09-09'), team, root)).toBe('note');
    expect(materialBelongsToTeam(chapter(3, 3, 'student'), team, root)).toBeNull();
    expect(materialBelongsToTeam(note(21, '2026-09-09', 'student'), team, root)).toBeNull();
    expect(materialBelongsToTeam(chapter(99, 1, 'teacher', 'bk_other'), team, root)).toBeNull();
    expect(materialBelongsToTeam({ id: 5, owner_id: 'teacher', processed_json: { metadata: { team: { key: 'a', root: true } } } }, team, root)).toBeNull(); // 루트 자체는 안 나간다
    expect(materialBelongsToTeam(null, team, root)).toBeNull();
  });

  it('페이로드는 뷰어가 읽는 필드만 — raw_text·processed_json(metadata 포함)·언어·소유자', () => {
    const p = toPayload({ ...chapter(3, 3), raw_text: '私は学生です。', visibility: 'private' }, 'chapter');
    expect(Object.keys(p).sort()).toEqual(['created_at', 'id', 'kind', 'language', 'owner_id', 'processed_json', 'raw_text', 'title', 'updatedAt', 'visibility']);
    expect(p.raw_text).toBe('私は学生です。');
    expect(p.processed_json.metadata.book.key).toBe('bk_1');
  });
});

describe('라우트 배선', () => {
  const unlock = read('src/app/api/class/[team]/unlock/route.js');
  const index = read('src/app/api/class/[team]/route.js');
  const material = read('src/app/api/class/[team]/material/[id]/route.js');
  const classIndex = read('src/lib/server/classIndex.js');

  it('해제: 틀린 암호·없는 팀·6자 미만이 같은 404 — 팀이 없어도 해시 비용을 치른다 · IP 분당 10회 · 비밀 없으면 503', () => {
    expect(unlock).toContain("const notFound = () => Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });");
    expect(unlock).toContain('pw.trim().length < TEAM_PW_MIN) return notFound();');
    expect(unlock).toContain('const ok = await verifyPassword(pw, loaded?.team || null);');
    expect(unlock).toContain('if (!loaded || !ok) return notFound();');
    expect(unlock).toContain("rateLimit(`class-unlock:${getClientKey(request)}`, { limit: 10, windowMs: 60_000 })");
    expect(unlock).toContain("if (!secret) return Response.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });");
    // 해제 응답에도 팀 이름은 목록(index) 안에만 — 잠김 화면은 index를 받지 않는다(LockedView)
    const locked = sliceBetween(read('src/views/ClassTeamPage.jsx'), 'function LockedView(', '\n}\n');
    expect(locked).not.toContain('index');
    expect(locked).not.toContain('team.name');
  });

  it('목록·페이로드: 토큰 검증 → 팀 일치 → pwGen 일치, 하나라도 어긋나면 401 · 팀 밖 id는 404', () => {
    const auth = sliceBetween(index, 'export async function authorizeTeamRequest(', '\n}\n');
    expect(auth).toContain('verifyToken(request.headers.get(TOKEN_HEADER), secret)');
    expect(auth).toContain('if (!v.ok || v.team !== key) return { error: unauthorized() };');
    expect(auth).toContain('if (!loaded || loaded.team.pwGen !== v.gen) return { error: unauthorized() };');
    expect(material).toContain("import { authorizeTeamRequest } from '../../route';");
    expect(material).toContain("if (!payload) return Response.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });");
    expect(index).toContain("import { rateLimit, getClientKey } from '@/lib/server/rateLimit';");
  });

  it('서비스 롤 조회는 전부 루트 소유자(owner_id)로 좁힌다 — 학생 복제본은 절대 나가지 않는다', () => {
    const build = sliceBetween(classIndex, 'export async function buildTeamIndex(', '\n}\n');
    expect(build.match(/\.eq\('owner_id', root\.owner_id\)/g)).toHaveLength(2);
    const load = sliceBetween(classIndex, 'export async function loadTeamMaterial(', '\n}\n');
    expect(load).toContain(".eq('owner_id', root.owner_id)");
    expect(load).toContain('materialBelongsToTeam(data, team, root)');
  });
});
