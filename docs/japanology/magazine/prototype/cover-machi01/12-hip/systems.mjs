// 12-hip 서체 체계 5종 (2026-10-15 KST). build.mjs·fit.cjs가 함께 읽는다.
// 모든 서체 = Google Fonts, SIL OFL 1.1(라이선스 확인 표는 NOTES.md). 한 표지 안 서체 계열 ≤ 3.
// 역할: mast(TONARI) · kana(となり) · title(富士吉田) = 큰 글자(장식 서체 허용) / line·story·kick·no·credit = 읽는 글자.
// kit: Google Fonts CSS2 `text=` 부분집합(TONARIとなり富士吉田 + 공백 U+0020) woff2 — 2026-10-15 20:41:21 KST 조회.
//      큰 글자 역할에 ascent/descent-override를 걸어 글자 상자를 잉크 높이에 맞춘다(check-cover 겹침·정렬용, 글리프는 그대로).
const KIT = {
  dela: 'https://fonts.gstatic.com/l/font?kit=hESp6XxvMDRA-2eD0lXpDa6QkBAGQFMRaEkKH0TjSNditgV7mU9sk7MHcB_MI_svLaGyTg&skey=ca3882216dbc2d90&v=v19',
  instrumentItalic: 'https://fonts.gstatic.com/l/font?kit=jizHRFtNs2ka5fXjeivQ4LroWlx-6zATjmzOqJroqMnmUw&skey=1319132b16075d60&v=v5',
  tokumin800: 'https://fonts.gstatic.com/l/font?kit=Gg8vN5wdZg7xCwuMsylww2ZiQnr_-nkkvNAbmhcGCypBZgGH84Ix4v7VqtbtJqdX&skey=6dc04d704ebee13c&v=v12',
  dot: 'https://fonts.gstatic.com/l/font?kit=v6-QGYjBJFKgyw5nSoDAGE7O-2ZwfAucH_xTyUIy_OwnYozKtHTqDvCFfGzk9osV&skey=eecae415a788803c&v=v22',
  yuji: 'https://fonts.gstatic.com/l/font?kit=BngNUXdTV3vO6Lw5ApOPqPL42oDAqFbNKawLxW9V6e6F_1pDRV9G1vDbUxftV2o&skey=9ffd14150d67040a&v=v9',
  shoulders900: 'https://fonts.gstatic.com/l/font?kit=fC1MPZJEZG-e9gHhdI4-NBbfd2ys3SjJCx12wPgf9g-_3F0YdSY8JFsiSju4mNvXgWI&skey=90f4a48b17c6f69&v=v24',
  murecho900: 'https://fonts.gstatic.com/l/font?kit=q5uYsoq3NOBn_I-ggCJg98TBOoNFCMrC4nWcNDh82zqTv1UaKwnPs0LCm2X71LNMl369&skey=927ed14a90eb1ab0&v=v18',
};
const ZK = "'Zen Kaku Gothic New',sans-serif";
// big: { family(측정·대체용 Google 이름), weight, style, kit, ls(자간 em) }
export const SYSTEMS = {
  H1: {
    label: 'H1 レトロ・ディスプレイ', note: '굵은 고딕 디스플레이 한 벌(제호·제목) + 읽는 고딕',
    css: 'Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@400;500;700',
    mast: { family: 'Dela Gothic One', weight: 400, style: 'normal', kit: KIT.dela, ls: 0.04 },
    kana: { family: 'Dela Gothic One', weight: 400, style: 'normal', kit: KIT.dela, ls: 0.08 },
    title: { family: 'Dela Gothic One', weight: 400, style: 'normal', kit: KIT.dela, ls: 0.06 },
    line: `${ZK};font-weight:500`, story: `${ZK};font-weight:700`, kick: `${ZK};font-weight:500`, no: `${ZK};font-weight:500`, credit: `${ZK};font-weight:400`,
    families: ['Dela Gothic One', 'Zen Kaku Gothic New'],
  },
  H2: {
    label: 'H2 エディトリアル', note: '이탤릭 콘트라스트 세리프 제호 + 장식 명조 제목 + 읽는 고딕',
    css: 'Instrument+Serif:ital@0;1&family=Kaisei+Tokumin:wght@500;800&family=Zen+Kaku+Gothic+New:wght@400;500',
    mast: { family: 'Instrument Serif', weight: 400, style: 'italic', kit: KIT.instrumentItalic, ls: 0.02 },
    kana: { family: 'Kaisei Tokumin', weight: 800, style: 'normal', kit: KIT.tokumin800, ls: 0.08 },
    title: { family: 'Kaisei Tokumin', weight: 800, style: 'normal', kit: KIT.tokumin800, ls: 0.06 },
    line: `${ZK};font-weight:500`, story: "'Kaisei Tokumin',serif;font-weight:500", kick: `${ZK};font-weight:500`, no: "'Instrument Serif',serif;font-style:italic;font-weight:400", credit: `${ZK};font-weight:400`,
    families: ['Instrument Serif', 'Kaisei Tokumin', 'Zen Kaku Gothic New'],
  },
  H3: {
    label: 'H3 ドット', note: '픽셀 고딕 한 벌(제호·제목) + 읽는 고딕 + 기하 그로테스크 숫자',
    css: 'DotGothic16&family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Space+Grotesk:wght@500',
    mast: { family: 'DotGothic16', weight: 400, style: 'normal', kit: KIT.dot, ls: 0 },
    kana: { family: 'DotGothic16', weight: 400, style: 'normal', kit: KIT.dot, ls: 0.1 },
    title: { family: 'DotGothic16', weight: 400, style: 'normal', kit: KIT.dot, ls: 0.06 },
    line: `${ZK};font-weight:500`, story: `${ZK};font-weight:700`, kick: `${ZK};font-weight:500`, no: "'Space Grotesk',sans-serif;font-weight:500", credit: `${ZK};font-weight:400`,
    families: ['DotGothic16', 'Zen Kaku Gothic New', 'Space Grotesk'],
  },
  H4: {
    label: 'H4 筆', note: '붓글씨 한 벌(제호·제목) + 둥근 고딕 + 교과서체',
    css: 'Yuji+Syuku&family=Zen+Maru+Gothic:wght@400;500&family=Klee+One:wght@600',
    mast: { family: 'Yuji Syuku', weight: 400, style: 'normal', kit: KIT.yuji, ls: 0.04 },
    kana: { family: 'Yuji Syuku', weight: 400, style: 'normal', kit: KIT.yuji, ls: 0.08 },
    title: { family: 'Yuji Syuku', weight: 400, style: 'normal', kit: KIT.yuji, ls: 0.06 },
    line: "'Zen Maru Gothic',sans-serif;font-weight:500", story: "'Klee One',cursive;font-weight:600", kick: "'Zen Maru Gothic',sans-serif;font-weight:500", no: "'Zen Maru Gothic',sans-serif;font-weight:500", credit: "'Zen Maru Gothic',sans-serif;font-weight:400",
    families: ['Yuji Syuku', 'Zen Maru Gothic', 'Klee One'],
  },
  H5: {
    label: 'H5 コンデンス・グロテスク', note: '압축 그로테스크 제호 + 굵은 고딕 한 벌',
    css: 'Big+Shoulders+Display:wght@900&family=Murecho:wght@400;500;700;900',
    mast: { family: 'Big Shoulders Display', weight: 900, style: 'normal', kit: KIT.shoulders900, ls: 0.06 },
    kana: { family: 'Murecho', weight: 900, style: 'normal', kit: KIT.murecho900, ls: 0.1 },
    title: { family: 'Murecho', weight: 900, style: 'normal', kit: KIT.murecho900, ls: 0.06 },
    line: "'Murecho',sans-serif;font-weight:500", story: "'Murecho',sans-serif;font-weight:700", kick: "'Murecho',sans-serif;font-weight:500", no: "'Murecho',sans-serif;font-weight:500", credit: "'Murecho',sans-serif;font-weight:400",
    families: ['Big Shoulders Display', 'Murecho'],
  },
};
export const BIG_TEXT = { mast: 'TONARI', kana: 'となり', title: '富士吉田' };
