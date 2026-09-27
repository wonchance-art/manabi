import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { finishQa } from '../e2e/qa-runtime.mjs';
import { validateEvidence } from './qa-profiles.mjs';
import { stageQaArtifacts } from './qa-artifacts.mjs';

const directories = [];
function fixture() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-cleanup-'));directories.push(out);
  const order = [];let connected = true, contexts;
  const forbidden = vi.fn(() => { throw Error('private data must not be inspected'); });
  const page = { url: forbidden, title: forbidden, content: forbidden };
  const context = {
    pages: () => [page], cookies: forbidden, storageState: forbidden,
    tracing: { stop: vi.fn(async ({ path: file }) => { order.push('trace');fs.writeFileSync(file, 'synthetic trace'); }) },
    close: vi.fn(async () => { order.push('context');contexts = []; }),
  };
  contexts = [context];
  const browser = {
    isConnected: () => connected, contexts: () => contexts,
    close: vi.fn(async () => { order.push('browser');connected = false; }),
  };
  const db = { close: vi.fn(async () => { order.push('database'); }) };
  const server = { close: vi.fn(async () => { order.push('server'); }) };
  const report = { engine: 'webkit', groups: ['fixture'], checks: ['screen passed'], errors: [] };
  return { browser, context, db, server, report, out, order, forbidden,
    saved: () => JSON.parse(fs.readFileSync(path.join(out, 'report.json'))),
    trace: () => fs.existsSync(path.join(out, 'failure-trace.zip')) };
}
afterEach(() => {
  vi.useRealTimers();vi.unstubAllEnvs();vi.restoreAllMocks();
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('QA teardown evidence survives failures without hiding them', () => {
  it('exports before teardown, records local counters and discards only on complete success', async () => {
    vi.stubEnv('QA_TRACE', '1');const f = fixture();
    await finishQa(f);
    expect(f.order).toEqual(['trace', 'context', 'browser', 'database', 'server']);
    expect(f.saved().cleanup).toMatchObject({ status: 'completed', trace: { status: 'discarded' } });
    expect(f.saved().cleanup.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'before', connected: true, contexts: 1, pages: [1] }),
      expect.objectContaining({ stage: 'after-context', connected: true, contexts: 0, pages: [] }),
      expect.objectContaining({ stage: 'after-browser', connected: false }),
    ]));
    expect(f.trace()).toBe(false);expect(f.forbidden).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(f.out, 'report.json.tmp'))).toBe(false);
  });

  it('retains the original assertion failure trace after successful cleanup', async () => {
    vi.stubEnv('QA_TRACE', '1');const f = fixture();f.report.failure = 'original assertion';
    await finishQa(f);
    expect(f.saved().failure).toBe('original assertion');
    expect(f.saved().cleanup).toMatchObject({ status: 'completed', trace: { status: 'saved', file: 'failure-trace.zip' } });
    expect(f.trace()).toBe(true);
    expect(() => validateEvidence({ groups: ['fixture'] }, f.saved(), 0)).toThrow('invalid_report');
  });

  it('keeps trace and attempts other resources when only browser teardown rejects', async () => {
    vi.stubEnv('QA_TRACE', '1');const f = fixture();
    f.browser.close.mockImplementation(async () => { throw Error('browser close rejected'); });
    await expect(finishQa(f)).rejects.toThrow('browser close rejected');
    expect(f.db.close).toHaveBeenCalledOnce();expect(f.server.close).toHaveBeenCalledOnce();
    expect(f.saved().cleanup).toMatchObject({ status: 'failed', errors: ['browser close rejected'], trace: { status: 'saved' } });
    expect(f.trace()).toBe(true);
    expect(() => validateEvidence({ groups: ['fixture'] }, f.saved(), 0)).toThrow('cleanup');
    const staged = path.join(f.out, 'staged');
    // The existing artifact collector already knows this trace/report format.
    const separate = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-cleanup-stage-'));directories.push(separate);
    stageQaArtifacts(f.out, separate);
    expect(fs.existsSync(path.join(separate, 'failure-trace.zip'))).toBe(true);
    expect(fs.existsSync(staged)).toBe(false);
  });

  it('persists the hanging stage, times out at the existing limit, and continues cleanup', async () => {
    vi.stubEnv('QA_TRACE', '1');vi.useFakeTimers();const f = fixture();
    f.browser.close.mockImplementation(() => new Promise(() => {}));
    const result = finishQa(f).catch(error => error);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.saved().cleanup).toMatchObject({ status: 'running', active: 'browser', trace: { status: 'saved' } });
    await vi.advanceTimersByTimeAsync(29_999);
    expect(f.db.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect((await result).message).toBe('browser_cleanup_timeout');
    expect(f.saved().cleanup.resources).toContainEqual({ name: 'browser', status: 'failed', durationMs: 30_000 });
    expect(f.db.close).toHaveBeenCalledOnce();expect(f.trace()).toBe(true);
  });

  it('continues after a context timeout, records unavailable counters without private error text', async () => {
    vi.stubEnv('QA_TRACE', '0');vi.useFakeTimers();const f = fixture();
    f.context.close.mockImplementation(() => new Promise(() => {}));
    f.browser.contexts = () => { throw Error('sensitive-context-details'); };
    const result = finishQa(f).catch(error => error);
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await result).message).toBe('context_cleanup_timeout');
    expect(f.browser.close).toHaveBeenCalledOnce();expect(f.db.close).toHaveBeenCalledOnce();
    expect(f.saved().cleanup.diagnostics[0].unavailable).toEqual(['contextsAndPages']);
    expect(JSON.stringify(f.saved())).not.toContain('sensitive-context-details');
    expect(f.context.tracing.stop).not.toHaveBeenCalled();
  });

  it('does not claim a trace exists if export failed or produced no file', async () => {
    vi.stubEnv('QA_TRACE', '1');const f = fixture();f.context.tracing.stop.mockResolvedValue(undefined);
    await expect(finishQa(f)).rejects.toThrow('trace_export_missing');
    expect(f.saved().cleanup.trace).toEqual({ status: 'failed' });
    expect(f.browser.close).toHaveBeenCalledOnce();expect(f.db.close).toHaveBeenCalledOnce();
  });

  it('still closes all resources when writing the evidence is impossible', async () => {
    vi.stubEnv('QA_TRACE', '0');const f = fixture();
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw Error('disk failure'); });
    await expect(finishQa(f)).rejects.toThrow('cleanup_report_write_failed');
    expect(f.context.close).toHaveBeenCalledOnce();expect(f.browser.close).toHaveBeenCalledOnce();
    expect(f.db.close).toHaveBeenCalledOnce();expect(f.server.close).toHaveBeenCalledOnce();
    expect(f.report.cleanup.status).toBe('failed');
  });

  it('retains trace if only the final report commit fails', async () => {
    vi.stubEnv('QA_TRACE', '1');const f = fixture(), rename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      const state = JSON.parse(fs.readFileSync(from));
      if (state.cleanup.trace.status === 'discarded') throw Error('final report disk failure');
      return rename(from, to);
    });
    await expect(finishQa(f)).rejects.toThrow('cleanup_report_write_failed');
    expect(f.trace()).toBe(true);
    expect(f.saved().cleanup).toMatchObject({ status: 'failed', trace: { status: 'saved' } });
    expect(f.browser.close).toHaveBeenCalledOnce();expect(f.db.close).toHaveBeenCalledOnce();
  });
});
