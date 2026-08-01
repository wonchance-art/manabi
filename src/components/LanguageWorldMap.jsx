/**
 * 언어 사용권 미니 세계지도 — 교재 소개 카드용.
 * 국경선 없는 스타일화 대륙 실루엣(IP 정책: 국기·국경 무재현, 지리 참조만) 위에
 * 언어권 마커(진함=공용어·주 사용, 옅음=널리 통용)와 화자 스탯을 보여준다.
 */

const CONTINENTS = [
  // 북아메리카
  'M60,55 C100,33 160,38 188,58 C212,74 206,96 190,106 C200,112 196,126 181,131 C168,152 150,166 140,160 C124,170 110,150 116,136 C90,126 70,106 66,90 C56,76 52,66 60,55 Z',
  // 남아메리카
  'M185,180 C205,168 226,178 229,199 C233,224 222,260 208,286 C200,301 189,301 185,286 C175,256 171,220 176,199 C178,189 180,185 185,180 Z',
  // 유럽
  'M330,75 C345,58 372,56 386,67 C396,75 393,88 382,96 C370,106 349,109 339,101 C330,95 325,85 330,75 Z',
  // 아프리카
  'M330,120 C350,106 382,109 396,124 C406,140 403,166 396,186 C389,211 375,241 360,256 C348,266 337,259 334,241 C327,216 319,180 322,150 C323,134 325,127 330,120 Z',
  // 아시아 본토
  'M395,60 C430,38 492,33 542,44 C592,52 626,70 631,90 C636,110 616,126 596,121 C586,136 566,146 551,139 C541,151 521,161 506,151 C481,156 456,146 446,131 C426,126 406,116 400,96 C393,80 390,70 395,60 Z',
  // 인도 아대륙
  'M496,138 C506,132 518,136 520,148 C521,160 514,172 505,175 C497,172 492,160 493,150 Z',
  // 일본 열도
  'M634,92 C640,88 646,92 646,100 C646,112 642,126 637,133 C632,136 628,130 629,120 C630,108 630,98 634,92 Z',
  // 오세아니아
  'M588,232 C608,222 632,226 646,239 C653,251 646,267 630,272 C610,278 592,270 586,257 C581,247 582,239 588,232 Z',
];
const ISLETS = [
  [700, 260, 3.5], // 뉴질랜드
  [560, 185, 2.5], [575, 192, 2], [590, 198, 2], // 동남아 군도
  [206, 148, 2.5], // 카리브
];

const TRACKS = {
  English: {
    color: '#3b6fb5',
    stats: [
      { n: '약 15억', label: '전체 화자' },
      { n: '약 3.8억', label: '모어 화자' },
      { n: '60+개국', label: '공식 사용' },
    ],
    caption: '사실상 전 대륙에서 통하는 유일한 언어예요.',
    regions: [
      { x: 140, y: 100, r: 34, label: '북미' },
      { x: 356, y: 74, r: 13, label: '영국·아일랜드' },
      { x: 622, y: 250, r: 20, label: '호주·뉴질랜드' },
      { x: 508, y: 152, r: 14, dim: true, label: '인도' },
      { x: 372, y: 226, r: 16, dim: true, label: '아프리카 동남부' },
      { x: 575, y: 185, r: 9, dim: true },
    ],
  },
  French: {
    color: '#a02840',
    stats: [
      { n: '약 3.2억', label: '전체 화자' },
      { n: '29개국', label: '공용어' },
      { n: '아프리카', label: '최대 화자 대륙' },
    ],
    caption: '진한 원이 공용어권 — 최대 화자 대륙은 아프리카예요.',
    regions: [
      { x: 364, y: 90, r: 12, label: '프랑스·벨기에·스위스' },
      { x: 340, y: 172, r: 30, label: '서·중앙아프리카' },
      { x: 346, y: 122, r: 14, label: '마그레브' },
      { x: 196, y: 82, r: 12, label: '퀘벡' },
      { x: 206, y: 148, r: 7, dim: true, label: '카리브' },
    ],
  },
  Japanese: {
    color: '#b0483f',
    stats: [
      { n: '약 1.2억', label: '모어 화자' },
      { n: '연 100만+', label: 'JLPT 응시' },
      { n: '세계 상위권', label: '콘텐츠 수출' },
    ],
    caption: '화자는 한 곳에 모여 있고, 콘텐츠는 전 세계로 나가요.',
    regions: [
      { x: 638, y: 112, r: 16, label: '일본' },
    ],
  },
  Chinese: {
    color: '#b0722f',
    stats: [
      { n: '약 9억+', label: '모어 화자' },
      { n: '약 11억', label: '전체 화자' },
      { n: '유엔 공용어', label: '6개 언어 중 하나' },
    ],
    caption: '표준중국어(보통화)가 통하는 지역 — 화교권까지 이어져요.',
    regions: [
      { x: 545, y: 115, r: 32, label: '중국' },
      { x: 600, y: 132, r: 8, label: '대만' },
      { x: 568, y: 178, r: 7, label: '싱가포르' },
      { x: 585, y: 195, r: 9, dim: true, label: '동남아 화교권' },
    ],
  },
};

export default function LanguageWorldMap({ langKey }) {
  const t = TRACKS[langKey];
  if (!t) return null;
  return (
    <div style={{ margin: '10px 0 12px' }}>
      <svg viewBox="0 0 720 320" role="img" aria-label="언어 사용 지역 지도"
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {CONTINENTS.map((d, i) => (
          <path key={i} d={d} fill="var(--border)" opacity="0.55" />
        ))}
        {ISLETS.map(([x, y, r], i) => (
          <circle key={`i${i}`} cx={x} cy={y} r={r} fill="var(--border)" opacity="0.55" />
        ))}
        {t.regions.map((rg, i) => (
          <g key={`r${i}`}>
            <circle cx={rg.x} cy={rg.y} r={rg.r} fill={t.color} opacity={rg.dim ? 0.22 : 0.42} />
            <circle cx={rg.x} cy={rg.y} r={Math.max(3, rg.r * 0.22)} fill={t.color} opacity={rg.dim ? 0.55 : 0.95} />
            {rg.label && (
              <text x={rg.x} y={rg.y - rg.r - 5} textAnchor="middle"
                style={{ fontSize: 11.5, fill: 'var(--text-secondary)', fontWeight: 600 }}>
                {rg.label}
              </text>
            )}
          </g>
        ))}
        <g style={{ fontSize: 10.5 }}>
          <circle cx={22} cy={300} r={5} fill={t.color} opacity="0.42" />
          <text x={32} y={304} style={{ fill: 'var(--text-muted)' }}>주 사용·공용어권</text>
          <circle cx={132} cy={300} r={5} fill={t.color} opacity="0.22" />
          <text x={142} y={304} style={{ fill: 'var(--text-muted)' }}>널리 통용</text>
        </g>
      </svg>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {t.stats.map((st) => (
          <div key={st.label} style={{ flex: '1 1 100px', minWidth: 100, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.02rem', fontWeight: 700, color: t.color }}>{st.n}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{st.label}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>{t.caption}</p>
    </div>
  );
}
