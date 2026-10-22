// 관리자 발행 API 테스트의 가짜 발행 기록 표(canonical_book_releases — CANON-RELEASE-001).
// bookPublishRoute.recordCanonicalRelease가 쓰는 두 모양만: upsert(on conflict do nothing) · select().eq().maybeSingle().
// state에 releases(줄) · releaseWrites(upsert 기록) · releaseError(쓰기 실패 흉내)를 둔다.
export const releaseState = () => ({ releases: [], releaseWrites: [], releaseError: null });

export function releasesTable(state) {
  const filters = [];
  let upserted = null;
  const query = {
    upsert: (value, options) => { upserted = { value, options }; return query; },
    select: () => query,
    eq: (key, value) => { filters.push([key, value]); return query; },
    maybeSingle: () => Promise.resolve({ data: state.releases.find((row) => filters.every(([key, value]) => row[key] === value)) ?? null, error: null }),
    then: (resolve) => {
      if (state.releaseError) return Promise.resolve({ data: null, error: state.releaseError }).then(resolve);
      state.releaseWrites.push(upserted);
      if (!state.releases.some((row) => row.book_key === upserted.value.book_key)) state.releases.push({ ...upserted.value });
      return Promise.resolve({ data: null, error: null }).then(resolve);
    },
  };
  return query;
}
