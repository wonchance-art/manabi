import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { lazyPanel } from '../lazyPanel';

// VIEWER-LAZY-PANELS-001 ⑹ — lazyPanel 동작: 받기 전 fallback, 받은 뒤(preload) 첫 렌더부터 동기, 한 번만 받기, 실패 뒤 재시도.
const Panel = ({ label, ref }) => <p data-ref={ref ? 'yes' : 'no'}>{label}</p>;

describe('lazyPanel', () => {
  it('받기 전에는 fallback(값·props 함수), 렌더만으로는 서버에서 모듈을 받지 않는다', () => {
    const load = vi.fn(() => Promise.resolve({ default: Panel }));
    const Plain = lazyPanel(load);
    expect(renderToStaticMarkup(<Plain label="설정" />)).toBe('');
    const WithFallback = lazyPanel(load, { fallback: (props) => <span>{props.label} 준비 중</span> });
    expect(renderToStaticMarkup(<WithFallback label="수업" />)).toBe('<span>수업 준비 중</span>');
    expect(load).not.toHaveBeenCalled();
  });

  it('preload 뒤에는 첫 렌더부터 부품을 동기로 그리고 props·ref를 그대로 넘긴다 — 모듈은 한 번만 받는다', async () => {
    const load = vi.fn(() => Promise.resolve({ default: Panel }));
    const Lazy = lazyPanel(load, { fallback: <span>준비 중</span> });
    await Promise.all([Lazy.preload(), Lazy.preload()]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(renderToStaticMarkup(<Lazy label="한자 창" ref={{ current: null }} />)).toBe('<p data-ref="yes">한자 창</p>');
  });

  it('받기에 실패하면 다음 preload에서 다시 받는다', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('chunk')).mockResolvedValue({ default: Panel });
    const Lazy = lazyPanel(load);
    await expect(Lazy.preload()).rejects.toThrow('chunk');
    await Lazy.preload();
    expect(load).toHaveBeenCalledTimes(2);
    expect(renderToStaticMarkup(<Lazy label="다시" />)).toBe('<p data-ref="no">다시</p>');
  });
});
