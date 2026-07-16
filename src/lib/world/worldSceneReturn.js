import { overworldRegionByScene } from './overworldRegions.js';

export function worldSceneReturnTarget(spawn) {
  const scene = typeof spawn?.scene === 'string' ? spawn.scene : '';
  return overworldRegionByScene(scene) ? scene : 'world';
}
