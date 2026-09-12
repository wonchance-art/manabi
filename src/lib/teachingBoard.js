import {validClassAnchor} from './classSource';

export const BOARD_VERSION = 1;
export const BOARD_LIMIT = 6 * 1024 * 1024;
export const BOARD_PAGE_LIMIT = 20;
export const BOARD_ELEMENT_LIMIT = 5000;
export const BOARD_LANGUAGES = ['Japanese', 'Chinese', 'English', 'French'];

export function boardScope(owner, team, day) {
  if (!owner || !team || !/^\d{4}-\d{2}-\d{2}$/.test(day || '')) throw new Error('수업 정보를 확인해 주세요.');
  return JSON.stringify(['teaching-board', owner, team, day]);
}

export function boardExpression(input, language) {
  if (!input || !BOARD_LANGUAGES.includes(language)) throw new Error('표현의 언어를 확인해 주세요.');
  const text = String(input.text || '').trim();
  if (!text || text.length > 500) throw new Error('표현을 500자 이내로 입력해 주세요.');
  let source = {kind: 'manual'};
  const origin = input.source;
  if (origin && origin.kind !== 'manual' && origin.materialId && origin.quote === text &&
      (!origin.anchor || (validClassAnchor(origin.anchor) && origin.anchor.exact === text))) {
    source = {materialId: String(origin.materialId), quote: text,
      ...(origin.tokenId ? {tokenId: String(origin.tokenId)} : {}), ...(origin.anchor ? {anchor: origin.anchor} : {})};
  }
  return {text, reading: String(input.reading || '').slice(0, 500), meaning: String(input.meaning || '').slice(0, 500),
    language, source, showReading: input.showReading !== false, showMeaning: input.showMeaning !== false};
}

export function expressionOf(element) {
  const value = element?.customData?.manabiExpression;
  if (element?.type !== 'rectangle' || !value) return null;
  try { return boardExpression(value, value.language); } catch { return null; }
}

export function emptyBoard(pageId) {
  return {version: BOARD_VERSION, activePage: pageId, pages: [{id: pageId, elements: [], camera: {scrollX: 0, scrollY: 0, zoom: {value: 1}}}]};
}

export function boardCamera(state) {
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  return {scrollX: finite(state?.scrollX, 0), scrollY: finite(state?.scrollY, 0),
    zoom: {value: Math.max(.1, Math.min(4, finite(state?.zoom?.value, 1)))}};
}

export function validateBoard(value) {
  if (!value || value.version !== BOARD_VERSION || !Array.isArray(value.pages) || !value.pages.length || value.pages.length > BOARD_PAGE_LIMIT) {
    throw new Error('설명판 형식을 확인하지 못했어요. 저장된 내용은 그대로 보존합니다.');
  }
  const ids = new Set();
  for (const page of value.pages) {
    if (typeof page.id !== 'string' || !page.id || ids.has(page.id) || !Array.isArray(page.elements) || page.elements.length > BOARD_ELEMENT_LIMIT) throw new Error('설명판을 확인하지 못했어요.');
    ids.add(page.id);
    const elementIds = new Set();
    for (const element of page.elements) {
      if (!element || typeof element.id !== 'string' || elementIds.has(element.id) || !['freedraw','text','rectangle','ellipse','diamond','line','arrow','frame'].includes(element.type) ||
          !['x','y','width','height'].every(key => Number.isFinite(element[key]))) throw new Error('저장할 수 없는 요소가 있어요.');
      if (element.type === 'text' && (typeof element.text !== 'string' || !Number.isFinite(element.fontSize) || element.fontSize <= 0)) throw new Error('글자 요소를 확인하지 못했어요.');
      if (['freedraw','line','arrow'].includes(element.type) && (!Array.isArray(element.points) || !element.points.length || !element.points.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)))) throw new Error('필기 좌표를 확인하지 못했어요.');
      if (element.groupIds != null && (!Array.isArray(element.groupIds) || element.groupIds.some(id => typeof id !== 'string'))) throw new Error('묶음 정보를 확인하지 못했어요.');
      if (element.customData?.manabiExpression && !expressionOf(element)) throw new Error('표현을 확인하지 못했어요.');
      elementIds.add(element.id);
    }
  }
  if (!ids.has(value.activePage)) throw new Error('설명판 페이지를 확인하지 못했어요.');
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).length > BOARD_LIMIT) throw new Error('이 설명판이 커졌어요. 백업을 내려받고 새 수업에서 이어 주세요.');
  const copy=JSON.parse(serialized);
  copy.pages=copy.pages.map(page=>({...page,camera:boardCamera(page.camera)}));
  return copy;
}

export function replaceBoardPage(document, id, elements, camera) {
  return {...document, pages: document.pages.map(page => page.id === id ? {...page, elements: [...elements], camera: boardCamera(camera)} : page)};
}

// Find free space without moving any existing ink. The caller may reveal an
// offscreen insertion, but does not rearrange the teacher's explanation.
export function boardInsertion(elements, state, width = 300, height = 190) {
  const zoom = state?.zoom?.value || 1;
  const left = -(state?.scrollX || 0) + 28 / zoom;
  const top = -(state?.scrollY || 0) + 108 / zoom;
  const columns = Math.max(1, Math.floor(((state?.width || 720) / zoom - 56) / (width + 24)));
  const visible = elements.filter(el => !el.isDeleted);
  for (let i = 0; i <= visible.length * 4 + 12; i++) {
    const x = left + (i % columns) * (width + 24), y = top + Math.floor(i / columns) * (height + 28);
    if (!visible.some(el => x < el.x + el.width + 12 && x + width + 12 > el.x && y < el.y + el.height + 12 && y + height + 12 > el.y)) return {x, y};
  }
  return {x: left, y: Math.max(top, ...visible.map(el => el.y + el.height)) + 28};
}

export function kanaCandidates(index, query, limit = 8) {
  const reading = String(query || '').trim().normalize('NFKC').replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
  if (!/^[ぁ-ゖー]+$/.test(reading) || reading.length > 80) return [];
  return (index[reading] || []).slice(0, limit).map(([text, level]) => ({text, reading, level}));
}
