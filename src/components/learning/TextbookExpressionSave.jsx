'use client';
import { useState } from 'react';
import SaveContextButton from './SaveContextButton';

export default function TextbookExpressionSave({ lang, slug, sectionIndex, exampleIndex }) {
  const [word,setWord]=useState(''),[meaning,setMeaning]=useState('');
  return <details className="learning-links" style={{padding:'8px 12px',margin:'8px 0'}}>
    <summary>이 예문의 표현을 복습에 담기</summary>
    <label>단어·표현<input aria-label="복습할 표현" value={word} onChange={e=>setWord(e.target.value)} maxLength={300} placeholder="예문 속 표현을 입력해 주세요" /></label>
    <label>이 문맥에서의 뜻<input aria-label="표현 뜻" value={meaning} onChange={e=>setMeaning(e.target.value)} maxLength={2000} /></label>
    {word.trim() && meaning.trim() && <SaveContextButton key={`${word}:${meaning}`} word={{word_text:word,meaning,language:lang}}
      source={{kind:'textbook',chapterSlug:slug,sectionIndex,exampleIndex}} />}
  </details>;
}
