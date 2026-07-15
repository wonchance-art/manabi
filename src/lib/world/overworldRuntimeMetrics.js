export const OVERWORLD_RUNTIME_TARGET_BYTES = 32 * 1024 * 1024;

function nonNegativeInteger(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function collectOverworldRuntimeMetrics({
  loader,
  pager,
  heapUsedBytes = null,
  committedUpdates = 0,
  blankFrameCount = 0,
} = {}) {
  if (!loader || !pager) throw new TypeError('loader and pager are required');
  const renderPageBytes = nonNegativeInteger(pager.byteLength);
  const packedChunkBytes = nonNegativeInteger(loader.cacheBytes);
  const visiblePageKeys = Object.freeze([...(pager.visible ?? [])]);
  const measuredHeapBytes = Number.isFinite(heapUsedBytes) && heapUsedBytes >= 0
    ? Math.floor(heapUsedBytes)
    : null;

  return Object.freeze({
    generation: Number.isSafeInteger(loader.generation) ? loader.generation : null,
    renderPages: nonNegativeInteger(pager.size),
    renderPageBytes,
    visiblePages: visiblePageKeys.length,
    visiblePageKeys,
    pendingPages: nonNegativeInteger(pager.pendingCount),
    packedChunks: nonNegativeInteger(loader.cacheSize),
    packedChunkBytes,
    pendingChunks: nonNegativeInteger(loader.pendingCount),
    runtimeBytes: renderPageBytes + packedChunkBytes,
    estimatedGpuTextureBytes: renderPageBytes,
    heapUsedBytes: measuredHeapBytes,
    committedUpdates: nonNegativeInteger(committedUpdates),
    blankFrameCount: nonNegativeInteger(blankFrameCount),
    limits: Object.freeze({
      renderPages: nonNegativeInteger(pager.maxPages),
      renderPageBytes: nonNegativeInteger(pager.maxBytes),
      runtimeBytes: OVERWORLD_RUNTIME_TARGET_BYTES,
    }),
  });
}
