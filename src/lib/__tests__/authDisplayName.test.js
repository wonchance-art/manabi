import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { syncAuthDisplayName } from '../authDisplayName';

const clientWith = (impl) => ({ auth: { updateUser: vi.fn(impl) } });

describe('닉네임 → auth user_metadata.display_name (메일 「OO님,」)', () => {
  it('바뀐 닉네임을 다듬어 auth에 옮긴다', async () => {
    const client = clientWith(async () => ({ error: null }));
    expect(await syncAuthDisplayName(client, { user_metadata: { display_name: '옛이름' } }, '  새이름 ')).toBe(true);
    expect(client.auth.updateUser).toHaveBeenCalledWith({ data: { display_name: '새이름' } });
  });

  it('Google 가입자처럼 display_name이 없던 계정에도 채운다', async () => {
    const client = clientWith(async () => ({ error: null }));
    expect(await syncAuthDisplayName(client, { user_metadata: { full_name: 'Kim' } }, '민지')).toBe(true);
  });

  it('같은 값·빈 값이면 요청하지 않는다', async () => {
    const client = clientWith(async () => ({ error: null }));
    expect(await syncAuthDisplayName(client, { user_metadata: { display_name: '민지' } }, '민지')).toBe(false);
    expect(await syncAuthDisplayName(client, { user_metadata: {} }, '   ')).toBe(false);
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('실패해도 던지지 않는다 — 닉네임 저장은 이미 끝났다', async () => {
    await expect(syncAuthDisplayName(clientWith(async () => ({ error: new Error('x') })), {}, '민지')).resolves.toBe(false);
    await expect(syncAuthDisplayName(clientWith(async () => { throw new Error('network'); }), {}, '민지')).resolves.toBe(false);
    await expect(syncAuthDisplayName(undefined, {}, '민지')).resolves.toBe(false);
  });

  it('온보딩·내 정보의 닉네임 저장이 profiles 저장 성공 뒤에 옮긴다', () => {
    for (const file of ['src/components/OnboardingModal.jsx', 'src/views/MyPage.jsx']) {
      const src = readFileSync(file, 'utf8');
      const sync = src.indexOf('syncAuthDisplayName(supabase, user, base.display_name)');
      expect(sync, file).toBeGreaterThan(0);
      expect(src.lastIndexOf("from('profiles')", sync), file).toBeGreaterThan(0);
    }
  });
});
