import { beforeEach, describe, expect, it, vi } from 'vitest';
const { client, admin, release, edition, candidate } = vi.hoisted(() => ({ client: vi.fn(), admin: vi.fn(), release: vi.fn(), edition: vi.fn(), candidate: vi.fn() }));
vi.mock('@/lib/supabaseServer', () => ({ createSupabaseServerClient: client, requireAdmin: admin }));
vi.mock('@/lib/textbook/server', () => ({ readRelease: release, readEdition: edition, candidate, currentCandidate: candidate, verifiedAsset: vi.fn(), textbookError: (status, message) => Object.assign(new Error(message), { status }) }));
import { publishedReading } from '../server/bookReading';
const book = { editionId: '7f572327dc67893e9453246c', contentHash: 'verified-content', artifactManifest: { bundleHash: 'verified-assets' } };
beforeEach(() => {
  vi.clearAllMocks(); client.mockResolvedValue({}); release.mockResolvedValue({ edition_id: book.editionId });
  edition.mockResolvedValue({ content_hash: book.contentHash, artifact_manifest: book.artifactManifest }); candidate.mockResolvedValue(book); admin.mockResolvedValue({ error: '관리자 권한 필요', status: 403 });
});
describe('published native reader boundary', () => {
  it('allows a guest to read only a released edition with matching manuscript and assets', async () => {
    expect(await publishedReading()).toEqual({ book, preview: false }); expect(admin).not.toHaveBeenCalled();
    edition.mockResolvedValue({ content_hash: 'tampered', artifact_manifest: book.artifactManifest });
    await expect(publishedReading()).rejects.toMatchObject({ status: 503 });
    edition.mockResolvedValue({ content_hash: book.contentHash, artifact_manifest: { bundleHash: 'tampered' } });
    await expect(publishedReading()).rejects.toMatchObject({ status: 503 });
  });
  it('does not return a private manuscript to an ordinary account or a public companion page', async () => {
    edition.mockResolvedValue(null);
    await expect(publishedReading(book.editionId, true)).rejects.toMatchObject({ status: 403 });
    expect(candidate).not.toHaveBeenCalled();
    await expect(publishedReading(book.editionId)).rejects.toMatchObject({ status: 404 });
  });
  it('keeps the administrator preview after a server-verified role check', async () => {
    edition.mockResolvedValue(null); admin.mockResolvedValue({ user: { id: 'verified-admin' } });
    expect(await publishedReading(book.editionId, true)).toEqual({ book, preview: true }); expect(admin).toHaveBeenCalledOnce();
  });
});
