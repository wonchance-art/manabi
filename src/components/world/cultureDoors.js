// 🚪 도시 파사드 → 문화 문법 챕터 연결 계약.
// Phaser 노드를 React 근접 상태로 넘길 때 chapter 를 빠뜨리지 않고,
// 라우터에는 고정된 ot-XX-slug 형식만 전달한다.

const CULTURE_CHAPTER_RE = /^ot-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function toInteractiveNode(node) {
  if (!node) return null;
  return {
    id: node.id,
    name: node.name,
    desc: node.desc,
    gate: node.gate,
    npc: node.npc,
    noStamp: node.noStamp,
    chapter: node.chapter,
  };
}

export function cultureChapterHref(chapter) {
  if (typeof chapter !== 'string' || !CULTURE_CHAPTER_RE.test(chapter)) return null;
  return `/japanese/grammar/${encodeURIComponent(chapter)}`;
}
