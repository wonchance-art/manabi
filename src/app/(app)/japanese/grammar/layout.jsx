import { Noto_Serif_JP, Noto_Serif_KR } from 'next/font/google';
import SegmentSlot from '@/components/SegmentSlot';

const japaneseSerif = Noto_Serif_JP({
  subsets: ['latin'], weight: '400', display: 'swap',
  variable: '--font-textbook-ja-serif', preload: false,
});
const koreanSerif = Noto_Serif_KR({
  subsets: ['latin'], weight: '400', display: 'swap',
  variable: '--font-textbook-kr-serif', preload: false,
});

export default function JapaneseGrammarLayout({ children }) {
  // 세그먼트 자리를 div 바로 안에 두지 않는다 — 하이드레이션 #418 간헐(HYDRATION-SLOT-001, src/components/SegmentSlot.jsx).
  return <div className={`${japaneseSerif.variable} ${koreanSerif.variable}`}><SegmentSlot>{children}</SegmentSlot></div>;
}
