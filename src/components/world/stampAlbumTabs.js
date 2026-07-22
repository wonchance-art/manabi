import { STAMP_ALBUM_NODES } from '../../lib/world/stampUniverse.js';
import { REGIONAL_WORLD_NODES, WORLD_NODES } from './worldNodes.js';
import { stampIcon } from './stampIcons.js';

const regionalNodes = STAMP_ALBUM_NODES.slice(WORLD_NODES.length);

function freezeTab(id, label, nodes) {
  return Object.freeze({ id, label, nodes: Object.freeze(nodes) });
}

export const STAMP_ALBUM_TABS = Object.freeze([
  freezeTab('national', '전국맵', STAMP_ALBUM_NODES.slice(0, WORLD_NODES.length)),
  freezeTab(
    'asia-pacific',
    '아시아·태평양',
    regionalNodes.filter((node) => node.regionId === 'asia-pacific'),
  ),
  freezeTab(
    'emea',
    '유럽·지중해·중동',
    regionalNodes.filter((node) => node.regionId === 'emea'),
  ),
]);

const TAB_BY_ID = new Map(STAMP_ALBUM_TABS.map((tab) => [tab.id, tab]));

export function stampAlbumTabById(tabId) {
  return TAB_BY_ID.get(tabId) || STAMP_ALBUM_TABS[0];
}

export function stampAlbumTabProgress(tab, stamps) {
  const owned = stamps instanceof Set ? stamps : new Set();
  const nodes = tab?.nodes || [];
  return Object.freeze({
    got: nodes.reduce((count, node) => count + (owned.has(node.id) ? 1 : 0), 0),
    total: nodes.length,
  });
}

export function stampAlbumBadge(node, stamps) {
  const owned = stamps instanceof Set ? stamps : new Set();
  const has = owned.has(node.id);
  return Object.freeze({
    has,
    title: has ? node.name : '아직 안 가 본 곳',
    icon: has ? stampIcon(node) : '❔',
    name: has ? node.name : '？',
  });
}

// 지역 suffix가 누락되거나 중복 배치되면 탭 UI에서 조용히 사라지지 않게 모듈 로드에서 닫는다.
if (regionalNodes.length !== REGIONAL_WORLD_NODES.length
  || STAMP_ALBUM_TABS.reduce((count, tab) => count + tab.nodes.length, 0) !== STAMP_ALBUM_NODES.length) {
  throw new Error('stamp album tab partition does not cover the canonical universe');
}
