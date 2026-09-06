'use client';
import { useState } from 'react';
import Image from 'next/image';
import { BOOK_SERIES } from '@/lib/bookNavigation';
export default function SuggestionArtwork({ suggestion }) {
  const [failed, setFailed] = useState(null);
  const source = suggestion.thumbnail_url;
  const series = BOOK_SERIES.find(item => item.language === suggestion.language) || BOOK_SERIES[0];
  const valid = typeof source === 'string' && /^https:\/\//i.test(source);
  return <div className="suggestion-artwork" style={{ '--series-color': series.color }} aria-hidden="true">
    {valid && failed !== source
      ? <Image src={source} alt="" width={640} height={360} unoptimized onError={() => setFailed(source)} />
      : <><span>{series.glyph}</span><small>manabi / {series.native}</small></>}
  </div>;
}
