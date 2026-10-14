import { useEffect, useState } from 'react';
import { verifiedCanonicalLiterature } from './literatureCanonical';

/** 뷰어 출처 줄용 — 정본과 대조된 아오조라 크레딧(없거나 다르면 null). 원문·책 위치가 바뀌면 다시 대조한다. */
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
    if (provider !== 'aozora') return undefined;
    verifiedCanonicalLiterature({ raw_text: rawText, processed_json: { metadata: { literature: { provider }, book: { key, order } } } })
      .then((value) => { if (live) setLiterature(value); });
    return () => { live = false; };
  }, [rawText, provider, key, order]);
  return literature;
}
