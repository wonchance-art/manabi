import { useEffect, useState } from 'react';
import { ART_BOOK_PROVIDER, verifiedArtChapter } from './artBook';

/**
 * 뷰어 작품 정보 카드용 — 카탈로그와 대조된 큐레이션 책 장(없거나 원문이 다르면 null, ART-P0-3).
 * useCanonicalLiterature와 같은 모양: 원문·책 위치·작품이 바뀌면 다시 대조하고, 늦게 끝난 옛 대조는 버린다.
 */
export function useArtBookChapter(material) {
  const rawText = material?.raw_text;
  const metadata = material?.processed_json?.metadata;
  const provider = metadata?.literature?.provider;
  const curation = metadata?.literature?.curation;
  const work = metadata?.literature?.work;
  const key = metadata?.book?.key;
  const order = metadata?.book?.order;
  const [chapter, setChapter] = useState(null);
  useEffect(() => {
    let live = true;
    setChapter(null);
    if (provider !== ART_BOOK_PROVIDER) return undefined;
    verifiedArtChapter({ raw_text: rawText, processed_json: { metadata: { literature: { provider, curation, work }, book: { key, order } } } })
      .then((value) => { if (live) setChapter(value); })
      .catch(() => { if (live) setChapter(null); });
    return () => { live = false; };
  }, [rawText, provider, curation, key, order, work]);
  return chapter;
}
