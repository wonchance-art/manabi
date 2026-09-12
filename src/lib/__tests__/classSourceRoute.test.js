import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../app/api/class/[team]/route', () => ({ authorizeTeamRequest: vi.fn() }));
vi.mock('../server/classIndex', () => ({ loadTeamMaterial: vi.fn() }));
import { authorizeTeamRequest } from '../../app/api/class/[team]/route';
import { loadTeamMaterial } from '../server/classIndex';
import { GET } from '../../app/api/class/[team]/source/route';

const source = { materialId: '12', quote: '学校', tokenId: 'old' };
const note = { kind: 'note', processed_json: { metadata: { classEntries: [{ id: 'entry:0', text: '学校' }], classSources: { 'entry:0': source }, team: { pwHash: 'must-not-leak' } } } };
const request = (query = 'sourceNote=34&sourceEntry=entry%3A0') => GET(new Request(`https://example.test/api/class/a/source?${query}`), { params: Promise.resolve({ team: 'a' }) });
describe('authorized class source projection', () => {
  beforeEach(() => { vi.resetAllMocks(); authorizeTeamRequest.mockResolvedValue({ admin: {}, root: {}, team: {} }); });
  it('returns only provenance after checking note and source membership', async () => {
    loadTeamMaterial.mockResolvedValueOnce(note).mockResolvedValueOnce({ kind: 'chapter', raw_text: 'private unrelated content' });
    const response = await request();
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ source });
    expect(loadTeamMaterial.mock.calls.map(args => args[3])).toEqual(['34', '12']);
  });
  it('does not read private rows for an invalid or expired class unlock', async () => {
    authorizeTeamRequest.mockResolvedValue({ error: Response.json({ error: 'unauthorized' }, { status: 401 }) });
    expect((await request()).status).toBe(401); expect(loadTeamMaterial).not.toHaveBeenCalled();
  });
  it('rejects a missing/foreign note, forged entry, or removed textbook', async () => {
    loadTeamMaterial.mockResolvedValue(null); expect((await request()).status).toBe(404);
    loadTeamMaterial.mockResolvedValue({ kind: 'chapter' }); expect((await request()).status).toBe(404);
    loadTeamMaterial.mockResolvedValue(note); expect((await request('sourceNote=34&sourceEntry=other%3A0')).status).toBe(404);
    loadTeamMaterial.mockResolvedValueOnce(note).mockResolvedValueOnce(null); expect((await request()).status).toBe(404);
  });
  it('does not use a target or source ID supplied by the caller', async () => {
    loadTeamMaterial.mockResolvedValueOnce(note).mockResolvedValueOnce({ kind: 'chapter' });
    expect((await request('sourceNote=34&sourceEntry=entry%3A0&materialId=999&sourceClass=foreign')).status).toBe(200);
    expect(loadTeamMaterial.mock.calls.at(-1)[3]).toBe('12');
  });
  it('handles malformed IDs and service failures without leaking row contents', async () => {
    expect((await request('sourceNote=..&sourceEntry=entry%3A0')).status).toBe(404);
    loadTeamMaterial.mockRejectedValue(new Error('secret database detail'));
    const response = await request(); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain('secret');
  });
});
