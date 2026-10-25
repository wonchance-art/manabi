'use client';
// 책장 레벨 타일의 「단어」 링크(LEVEL-LIST-RSC-001) — 누르는 순간 그 레벨 단어 묶음(/api/level-words)을 받기 시작해 화면 JS · 그리기와 겹친다.
// 조각(RSC)은 링크 기본 미리 받기 그대로(주소만 실려 3.5 KB) · 묶음은 누르기 전에는 받지 않는다. 마우스는 누를 때(pointerdown — 클릭보다 앞),
// 터치는 클릭 때만 — 손가락이 타일 위에서 화면을 굴리기만 해도 pointerdown이 와서, 굴리는 동안 묶음을 받지 않게.
import Link from 'next/link';
import { levelWordsUrl, warmLevelWords } from '@/lib/levelWordsPayload';

export default function LevelWordsLink({ lang, levelKey, ...props }) {
  const warm = () => warmLevelWords(levelWordsUrl(lang, levelKey));
  return <Link {...props} onPointerDown={(e) => { if (e.pointerType === 'mouse') warm(); }} onClick={warm} />;
}
