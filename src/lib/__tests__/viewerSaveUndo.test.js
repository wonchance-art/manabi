import { describe, expect, it, vi } from 'vitest';
import { prepareViewerSaveUndo, undoViewerSave } from '../viewerSaveUndo';

const inserted = { id: 'new-word', user_id: 'owner', word_text: '盛', meaning: '담다', last_reviewed_at: null };
const source = { materialId: 4, tokenId: 'id_0_1' };
const context = { id: 'context', material_id: 4, locator: { tokenId: 'id_0_1' } };
function client(contexts) {
  const q = { select: () => q, eq: () => q, then: resolve => resolve({ data: contexts }) };
  return { from: () => q, rpc: vi.fn(async () => ({ data: true })) };
}

describe('new vocabulary save undo', () => {
  it('captures the insertion response, never a potentially reviewed row fetched later', async () => {
    const c = client([context]);
    const snapshot = await prepareViewerSaveUndo(c, inserted, source, true);
    expect(snapshot.expected).toEqual(inserted);
    expect(snapshot.contextIds).toEqual(['context']);
    await undoViewerSave(c, snapshot, 'owner');
    expect(c.rpc).toHaveBeenCalledWith('viewer_undo_vocabulary_save', {
      p_id: 'new-word', p_expected: inserted, p_context_ids: ['context'],
    });
  });
  it('never offers deletion for an existing word, another occurrence or additional contexts', async () => {
    expect(await prepareViewerSaveUndo(client([]), null, source, false)).toBeNull();
    expect(await prepareViewerSaveUndo(client([{ ...context, material_id: 9 }]), inserted, source, true)).toBeNull();
    expect(await prepareViewerSaveUndo(client([{ ...context, locator: { tokenId: 'other' } }]), inserted, source, true)).toBeNull();
    expect(await prepareViewerSaveUndo(client([context, { ...context, id: 'extra' }]), inserted, source, true)).toBeNull();
    expect(await prepareViewerSaveUndo(client([context]), inserted, source, false)).toBeNull();
  });
  it('blocks expired/account-switched snapshots without requesting deletion', async () => {
    const c = client([]), snapshot = await prepareViewerSaveUndo(c, inserted, source, false);
    await expect(undoViewerSave(c, snapshot, 'other')).rejects.toThrow();
    await expect(undoViewerSave(c, { ...snapshot, expiresAt: Date.now() - 1 }, 'owner')).rejects.toThrow();
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it('missing capability or changed server record never falls back to unconditional deletion', async () => {
    const c = client([]), snapshot = await prepareViewerSaveUndo(c, inserted, source, false);
    c.rpc.mockResolvedValue({ error: { code: 'PGRST202' } });
    await expect(undoViewerSave(c, snapshot, 'owner')).rejects.toThrow('유지됩니다');
    c.rpc.mockResolvedValue({ error: new Error('subsequent review') });
    await expect(undoViewerSave(c, snapshot, 'owner')).rejects.toThrow('subsequent review');
    c.rpc.mockResolvedValue({ data: false });
    await expect(undoViewerSave(c, snapshot, 'owner')).rejects.toThrow('확인하지 못했어요');
  });
});
