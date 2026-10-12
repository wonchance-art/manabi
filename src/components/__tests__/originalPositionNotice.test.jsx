// ORIGINAL-POSITION-RETRY-001 (2026-10-12) — 읽던 위치 알림 문구 계약.
// 온라인인데 첫 읽기가 실패하면 '연결되면…'(오프라인) 대신 '불러오지 못했어요'와 다시 시도 버튼을 보인다.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import OriginalPositionNotice from '../materials/OriginalPositionNotice';

const render = (phase) => renderToStaticMarkup(<OriginalPositionNotice sync={{ state: { phase, ready: true, localAvailable: true }, retry() {}, keep() {} }} sources={[]} onAccept={() => {}} />);

describe('OriginalPositionNotice', () => {
  it('a failed read while online explains the failure and offers a retry', () => {
    const html = render('failed');
    expect(html).toContain('읽던 위치를 불러오지 못했어요.');
    expect(html).toContain('동기화 다시 시도');
    expect(html).not.toContain('연결되면');
    expect(html).toContain('is-floating');
  });
  it('the offline copy is kept for a browser that reports offline', () => {
    const html = render('offline');
    expect(html).toContain('연결되면 읽던 위치를 다시 동기화할 수 있어요.');
    expect(html).toContain('동기화 다시 시도');
  });
  it('a synced or loading state shows no retry button', () => {
    for (const phase of ['loading', 'synced']) {
      const html = render(phase);
      expect(html).not.toContain('동기화 다시 시도');
      expect(html).not.toContain('불러오지 못했어요');
    }
  });
  it('the hook waits for the client and its auth session before the timed request', () => {
    const hook = readFileSync(new URL('../materials/useOriginalReadingPosition.js', import.meta.url), 'utf8');
    expect(hook).toMatch(/auth\.getSession\(\)/);
    expect(hook).toMatch(/onChange:setState,ready\}/);
  });
});
