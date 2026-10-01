import React from 'react';

// Keep each original character beside its complete Korean label, outside the ruby grid.
export default function ViewerHanjaReading({items}) {
  if (!items?.length) return null;
  return <dl className="reader-hun" lang="ko" aria-label="한자 훈음">
    {items.map(({ch,label},index)=><div className="reader-hun__pair" key={`${index}:${ch}`}>
      <dt lang="zh-Hans">{ch}</dt><dd>{label}</dd>
    </div>)}
  </dl>;
}
