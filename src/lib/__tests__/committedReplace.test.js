import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween.js';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {} }) }));
const { createCommittedReplace, COMMIT_CHECK_MS, COMMIT_RETRIES } = await import('../useCommittedReplace.js');

// 계약: 같은 경로 · 검색어만 바꾸는 router.replace의 반영 확인(서재 즐겨찾기 e2e flake, 2026-10-17 KST).
// Next 15.5에서 navigate · server-patch가 끝나도 전환이 commit되지 않는 경우가 있었다(약 8–10%) — 다시 보내면 반영된다.
const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
let url, replace, box;
const make = () => createCommittedReplace({ replace, current: () => url });
beforeEach(() => { vi.useFakeTimers(); url = '/materials'; replace = vi.fn(); box = make(); });
afterEach(() => vi.useRealTimers());

describe('createCommittedReplace', () => {
  it('반영되면 다시 보내지 않는다', () => {
    box.replace('/materials?scope=favorites', { scroll: false });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith('/materials?scope=favorites', { scroll: false });
    url = '/materials?scope=favorites';
    vi.advanceTimersByTime(COMMIT_CHECK_MS * 5);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it(`정해진 시간(${COMMIT_CHECK_MS}ms) 안에 주소가 닿지 않으면 같은 replace를 다시 — 최대 ${COMMIT_RETRIES}번`, () => {
    box.replace('/materials?scope=favorites', { scroll: false });
    vi.advanceTimersByTime(COMMIT_CHECK_MS - 1);
    expect(replace).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(replace).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenLastCalledWith('/materials?scope=favorites', { scroll: false });
    vi.advanceTimersByTime(COMMIT_CHECK_MS * 10);
    expect(replace).toHaveBeenCalledTimes(1 + COMMIT_RETRIES);
  });

  it('다시 보낸 뒤 반영되면 거기서 멈춘다', () => {
    box.replace('/materials?scope=trash');
    vi.advanceTimersByTime(COMMIT_CHECK_MS);
    url = '/materials?scope=trash';
    vi.advanceTimersByTime(COMMIT_CHECK_MS * 5);
    expect(replace).toHaveBeenCalledTimes(2);
  });

  it('더 새 목표가 오면 앞의 확인은 멈추고 새 목표만 다시 보낸다', () => {
    box.replace('/materials?scope=favorites');
    vi.advanceTimersByTime(COMMIT_CHECK_MS / 2);
    box.replace('/materials');
    url = '/materials'; // 새 목표(전체)는 이미 그 주소 — 다시 보낼 것이 없다
    vi.advanceTimersByTime(COMMIT_CHECK_MS * 5);
    expect(replace.mock.calls.map(([t]) => t)).toEqual(['/materials?scope=favorites', '/materials']);
    // 새 목표가 아직 반영되지 않았어도 앞 목표의 타이머가 새 목표를 일찍 다시 보내지 않는다(시간은 새 목표 기준).
    const fresh = make(); replace.mockClear(); url = '/materials';
    fresh.replace('/materials?scope=favorites');
    vi.advanceTimersByTime(COMMIT_CHECK_MS / 2);
    fresh.replace('/materials?scope=trash');
    vi.advanceTimersByTime(COMMIT_CHECK_MS / 2 + 100);
    expect(replace.mock.calls.map(([t]) => t)).toEqual(['/materials?scope=favorites', '/materials?scope=trash']);
    vi.advanceTimersByTime(COMMIT_CHECK_MS / 2);
    expect(replace.mock.calls.map(([t]) => t)).toEqual(['/materials?scope=favorites', '/materials?scope=trash', '/materials?scope=trash']);
  });

  it('사용자가 다른 곳으로 옮기면(보낼 때와도 목표와도 다른 주소) 덮어쓰지 않는다 · 멈추기(cancel)도 지킨다', () => {
    box.replace('/materials?scope=favorites');
    url = '/viewer/4';
    vi.advanceTimersByTime(COMMIT_CHECK_MS * 5);
    expect(replace).toHaveBeenCalledTimes(1);
    url = '/materials';
    const other = make();
    other.replace('/materials?scope=trash');
    other.cancel();
    vi.advanceTimersByTime(COMMIT_CHECK_MS * 5);
    expect(replace).toHaveBeenCalledTimes(2);
  });

  it('주소 비교는 정규화한다 — 같은 검색어면 반영으로 본다', () => {
    box.replace('/materials?q=%EA%B0%80+%EB%82%98');
    url = 'http://127.0.0.1:8881/materials?q=%EA%B0%80+%EB%82%98'.replace('http://127.0.0.1:8881', '');
    vi.advanceTimersByTime(COMMIT_CHECK_MS * 3);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe('배선', () => {
  it('서재의 검색어만 바꾸는 이동(change)은 반영 확인 replace로 — router.replace를 직접 부르지 않는다', () => {
    const shelf = read('src/components/library/LibraryShelf.jsx');
    expect(shelf).toContain('const params=useSearchParams(),replace=useCommittedReplace(),cache=useQueryClient();');
    expect(sliceBetween(shelf, ' function change(patch){', '}\n')).toContain("replace(`/materials${next.size?`?${next}`:''}`,{scroll:false});");
    expect(shelf).not.toMatch(/router\.replace\(|useRouter\(/);
  });
  it('화면이 사라지면 멈춘다 · 최신 router로 보낸다', () => {
    const hook = sliceBetween(read('src/lib/useCommittedReplace.js'), 'export function useCommittedReplace()', '\n}\n');
    expect(hook).toContain('useEffect(() => () => box.current.cancel(), []);');
    expect(hook).toContain('replace: (target, options) => routerRef.current.replace(target, options),');
    expect(hook).toContain('current: () => window.location.pathname + window.location.search,');
  });
});
