// Serialize writes: a slower earlier request must not replace a newer position.
export function createPositionWriter(write, onError = () => {}, delay = 2000) {
  let pending = null, timer, closed = false, version = 0, chain = Promise.resolve();
  const flush = () => {
    clearTimeout(timer);
    if (pending === null || closed) return chain;
    const index = pending, requestVersion = version; pending = null;
    chain = chain.then(async () => {
      try { await write(index); onError(null); }
      catch (error) { if (!closed && pending === null && requestVersion === version) pending = index; onError(error); }
    });
    return chain;
  };
  return {
    schedule(index) {
      if (closed || !Number.isInteger(index) || index < 0) return;
      version++; pending = index; clearTimeout(timer); timer = setTimeout(flush, delay);
    },
    flush,
    close(save = true) {
      if (save) flush();
      closed = true; pending = null; clearTimeout(timer);
      return chain;
    },
  };
}
