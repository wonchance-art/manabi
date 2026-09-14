// Canvas tools occupy real screen space. Camera fitting must use the remaining
// paper, not the editor's full size, especially with the mobile bottom toolbar.
export function boardCameraForBounds(bounds, camera, viewport, insets = {}, fit = false, maxZoom = 1) {
  const [x1, y1, x2, y2] = bounds;
  const left = (insets.left || 0) + 16, top = (insets.top || 0) + 16;
  const right = viewport.width - (insets.right || 0) - 16;
  const bottom = viewport.height - (insets.bottom || 0) - 16;
  if (![...bounds, left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) return null;
  const currentZoom = camera.zoom?.value || 1;
  const zoom = Math.max(.1, Math.min(fit ? maxZoom : currentZoom, (right-left)/Math.max(1,x2-x1), (bottom-top)/Math.max(1,y2-y1)));
  const scrollX = camera.scrollX || 0, scrollY = camera.scrollY || 0;
  if (!fit && zoom === currentZoom && (x1+scrollX)*zoom >= left && (x2+scrollX)*zoom <= right && (y1+scrollY)*zoom >= top && (y2+scrollY)*zoom <= bottom) return null;
  return {zoom:{value:zoom}, scrollX:(left+right)/(2*zoom)-(x1+x2)/2, scrollY:(top+bottom)/(2*zoom)-(y1+y2)/2};
}
