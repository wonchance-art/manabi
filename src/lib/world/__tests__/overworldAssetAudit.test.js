import { describe, expect, it } from 'vitest';
import { checkOverworldAssets } from '../../../../scripts/world/check-overworld-assets.mjs';
import { OVERWORLD_REGION_LIST } from '../overworldRegions.js';

describe('오버월드 정적 자산 출고 검사', () => {
  it('레지스트리에서 도달하는 두 지역의 manifest·파일·맵 미리보기를 모두 검증한다', async () => {
    await expect(checkOverworldAssets()).resolves.toMatchObject({
      regions: 2,
      manifests: 11,
      artifacts: 561,
      bytes: 35_048_838,
    });
  });

  it('런타임 레지스트리 해시가 체크인 manifest와 다르면 즉시 거부한다', async () => {
    const [apac] = OVERWORLD_REGION_LIST;
    const drifted = {
      ...apac,
      manifest: { ...apac.manifest, regionHash: '0'.repeat(64) },
    };
    await expect(checkOverworldAssets([drifted])).rejects.toThrow('regionHash drifted');
  });

  it('한 지역 자산 참조의 공개 상태가 섞이면 의존 체인을 읽기 전에 거부한다', async () => {
    const [, emea] = OVERWORLD_REGION_LIST;
    const drifted = {
      ...emea,
      overlaySources: [
        { ...emea.overlaySources[0], releaseEligible: false },
        ...emea.overlaySources.slice(1),
      ],
    };
    await expect(checkOverworldAssets([drifted])).rejects.toThrow(
      'runtime asset sources must share one release eligibility state',
    );
  });
});
