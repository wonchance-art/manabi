import { Noto_Serif_JP, Noto_Serif_KR } from 'next/font/google';

const japaneseSerif = Noto_Serif_JP({
  subsets: ['latin'], weight: '400', display: 'swap',
  variable: '--font-textbook-ja-serif', preload: false,
});
const koreanSerif = Noto_Serif_KR({
  subsets: ['latin'], weight: '400', display: 'swap',
  variable: '--font-textbook-kr-serif', preload: false,
});

export default function JapaneseGrammarLayout({ children }) {
  return <div className={`${japaneseSerif.variable} ${koreanSerif.variable}`}>{children}</div>;
}
