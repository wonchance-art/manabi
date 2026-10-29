import { useEffect, useState } from 'react';

// 출처별 대조 — 青空文庫 · Standard Ebooks(LIT-SRC-EN-1) · Wikisource(LIT-SRC-WS-1). 모두 원문 해시가 정본과 같을 때만 크레딧을 준다.
// 대조표(정본 manifest 넷 — 최소화 뒤 약 410 KB)는 그 출처의 자료를 열 때만 받는다(VIEWER-LIT-LAZY-001 — 전에는 모든 뷰어 첫 JS에 실려
// 문학책이 아닌 자료까지 851 KB를 받았다). 받지 못하면 대조하지 않은 것과 같다(크레딧 없음 — fail-closed).
const VERIFY = {
  aozora: () => import('./literatureCanonical').then((m) => m.verifiedCanonicalLiterature),
  standardebooks: () => import('./standardEbooksCanonical').then((m) => m.verifiedStandardEbooksLiterature),
  wikisource: () => import('./wikisourceCanonical').then((m) => m.verifiedWikisourceLiterature),
  pdsite: () => import('./pdSiteCanonical').then((m) => m.verifiedPdSiteLiterature),
};

/** 그 출처의 대조 함수를 받는 약속(모르는 출처면 null — 받지 않는다). */
export const loadLiteratureVerifier = (provider) => (Object.hasOwn(VERIFY, provider) ? VERIFY[provider]() : null);

/** 뷰어 출처 줄용 — 정본과 대조된 정본 책 크레딧(青空文庫·Standard Ebooks, 없거나 다르면 null). 원문·책 위치가 바뀌면 다시 대조한다. */
export function useCanonicalLiterature(material) {
  const rawText = material?.raw_text;
  const metadata = material?.processed_json?.metadata;
  const provider = metadata?.literature?.provider;
  const key = metadata?.book?.key;
  const order = metadata?.book?.order;
  const [literature, setLiterature] = useState(null);
  useEffect(() => {
    let live = true;
    setLiterature(null);
    const load = loadLiteratureVerifier(provider);
    if (!load) return undefined;
    load.then((verify) => verify({ raw_text: rawText, processed_json: { metadata: { literature: { provider }, book: { key, order } } } }))
      .then((value) => { if (live) setLiterature(value); }, () => {});
    return () => { live = false; };
  }, [rawText, provider, key, order]);
  return literature;
}

/** 번체로 읽기(LIT-SRC-WS-1) — 정본 대조를 통과한 번체 사본(없거나 다르면 null). 원문·책 위치·사본이 바뀌면 다시 대조한다. */
export function useScriptVariant(material) {
  const rawText = material?.raw_text;
  const metadata = material?.processed_json?.metadata;
  const provider = metadata?.literature?.provider;
  const key = metadata?.book?.key;
  const order = metadata?.book?.order;
  const variants = metadata?.scriptVariants;
  const [text, setText] = useState(null);
  useEffect(() => {
    let live = true;
    setText(null);
    if (provider !== 'wikisource' || !variants) return undefined;
    import('./wikisourceCanonical').then(({ verifiedScriptVariant }) =>
      verifiedScriptVariant({ raw_text: rawText, processed_json: { metadata: { literature: { provider }, book: { key, order }, scriptVariants: variants } } }))
      .then((value) => { if (live) setText(value); }, () => {});
    return () => { live = false; };
  }, [rawText, provider, key, order, variants]);
  return text;
}

/** 정본 문학책의 표시용 대조표 항목(제목 · 장 이름) — 대조를 통과한 뒤에만 받는다(literatureWorks의 표도 문학책 아닌 자료 첫 JS에 싣지 않게). */
export function useLiteratureWork(key, enabled) {
  const [work, setWork] = useState(null);
  useEffect(() => {
    let live = true;
    setWork(null);
    if (!enabled || !key) return undefined;
    import('./literatureWorks').then((m) => { if (live) setWork(m.literatureWork(key)); }, () => {});
    return () => { live = false; };
  }, [key, enabled]);
  return work;
}
