import { describe, expect, it } from 'vitest';
import { worldSceneReturnTarget } from '../worldSceneReturn.js';

describe('하위 씬 월드 복귀 대상', () => {
  it('알려진 지역 씬은 해당 지역으로 직접 복귀한다', () => {
    expect(worldSceneReturnTarget({ scene: 'overworld:asia-pacific', x: 1, y: 2 }))
      .toBe('overworld:asia-pacific');
    expect(worldSceneReturnTarget({ scene: 'overworld:emea', x: 1, y: 2 }))
      .toBe('overworld:emea');
  });

  it('기존 광장·알 수 없는 씬·빈 값은 world 씬으로 닫힌다', () => {
    expect(worldSceneReturnTarget({ scene: 'plaza', x: 1, y: 2 })).toBe('world');
    expect(worldSceneReturnTarget({ scene: 'overworld:unknown', x: 1, y: 2 })).toBe('world');
    expect(worldSceneReturnTarget(null)).toBe('world');
  });
});
