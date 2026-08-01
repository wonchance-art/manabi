import { WORLD_PATHS } from './worldMapPaths';

/**
 * 언어 사용권 세계지도 — 교재 소개 카드용.
 * 실측 소스: world-atlas 110m(Natural Earth 유래, 퍼블릭 도메인) 스냅샷 → 국가 폴리곤.
 * 채색은 '이 언어가 쓰이는 곳' 단일 의미(진함=공용어·주 사용, 옅음=널리 통용) — 지리 참조만.
 * 110m 해상도에서 빠지는 소국(싱가포르)은 점 마커로 보완.
 */

const TRACKS = {
  English: {
    color: '#3b6fb5',
    dark: ['840', '124', '826', '372', '036', '554'],
    dim: ['356', '566', '404', '710', '288', '608'],
    dots: [{ x: 568, y: 177, label: '싱가포르', dim: true }],
    labels: [
      { x: 140, y: 92, t: '북미' },
      { x: 350, y: 62, t: '영국·아일랜드' },
      { x: 624, y: 238, t: '호주·뉴질랜드' },
      { x: 508, y: 134, t: '인도' },
      { x: 434, y: 216, t: '동·남아프리카' },
    ],
    stats: [
      { n: '약 15억', label: '전체 화자' },
      { n: '약 3.8억', label: '모어 화자' },
      { n: '60+개국', label: '공식 사용' },
    ],
    caption: '사실상 전 대륙에서 통하는 유일한 언어예요.',
  },
  French: {
    color: '#a02840',
    dark: ['250', '056', '756', '442', '124', '332', '686', '384', '466', '854', '562', '768', '204', '324', '120', '266', '178', '180', '140', '148', '262', '450', '646', '108', '226'],
    dim: ['504', '012', '788'],
    dots: [],
    labels: [
      { x: 366, y: 78, t: '프랑스·벨기에·스위스' },
      { x: 190, y: 70, t: '캐나다' },
      { x: 350, y: 214, t: '서·중앙아프리카' },
      { x: 340, y: 104, t: '마그레브' },
      { x: 208, y: 138, t: '아이티' },
    ],
    stats: [
      { n: '약 3.2억', label: '전체 화자' },
      { n: '29개국', label: '공용어' },
      { n: '아프리카', label: '최대 화자 대륙' },
    ],
    caption: '진하게 칠한 곳이 공용어권 — 최대 화자 대륙은 아프리카예요. 남미의 프랑스령 기아나까지, 해외 영토도 보여요.',
  },
  Japanese: {
    color: '#b0483f',
    dark: ['392'],
    dim: [],
    dots: [],
    labels: [{ x: 648, y: 84, t: '일본' }],
    stats: [
      { n: '약 1.2억', label: '모어 화자' },
      { n: '연 100만+', label: 'JLPT 응시' },
      { n: '세계 상위권', label: '콘텐츠 수출' },
    ],
    caption: '화자는 한 곳에 모여 있고, 콘텐츠는 전 세계로 나가요.',
  },
  Chinese: {
    color: '#b0722f',
    dark: ['156', '158'],
    dim: ['458'],
    dots: [{ x: 568, y: 177, label: '싱가포르' }],
    labels: [
      { x: 540, y: 92, t: '중국' },
      { x: 616, y: 140, t: '대만' },
      { x: 548, y: 200, t: '말레이시아 화교권' },
    ],
    stats: [
      { n: '약 9억+', label: '모어 화자' },
      { n: '약 11억', label: '전체 화자' },
      { n: '유엔 공용어', label: '6개 언어 중 하나' },
    ],
    caption: '표준중국어(보통화)가 통하는 지역 — 화교권까지 이어져요.',
  },
};

export default function LanguageWorldMap({ langKey }) {
  const t = TRACKS[langKey];
  if (!t) return null;
  const dark = new Set(t.dark);
  const dim = new Set(t.dim);
  return (
    <div style={{ margin: '10px 0 12px' }}>
      <svg viewBox="0 10 720 296" role="img" aria-label="언어 사용 지역 지도"
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {WORLD_PATHS.map((c) => {
          const hl = dark.has(c.id) ? 'dark' : dim.has(c.id) ? 'dim' : null;
          return (
            <path key={c.id || c.name} d={c.d}
              fill={hl ? t.color : 'var(--border)'}
              fillOpacity={hl === 'dark' ? 0.82 : hl === 'dim' ? 0.4 : 0.45}
              stroke="var(--bg-secondary)" strokeWidth="0.4">
              {hl && <title>{c.name}</title>}
            </path>
          );
        })}
        {t.dots.map((d) => (
          <g key={d.label}>
            <circle cx={d.x} cy={d.y} r={4} fill={t.color} opacity={d.dim ? 0.5 : 0.9} />
            <text x={d.x + 7} y={d.y + 4} style={{ fontSize: 10.5, fill: 'var(--text-secondary)', paintOrder: 'stroke', stroke: 'var(--bg-secondary)', strokeWidth: 3 }}>{d.label}</text>
          </g>
        ))}
        {t.labels.map((l) => (
          <text key={l.t} x={l.x} y={l.y} textAnchor="middle"
            style={{ fontSize: 11.5, fontWeight: 700, fill: 'var(--text-secondary)', paintOrder: 'stroke', stroke: 'var(--bg-secondary)', strokeWidth: 3 }}>
            {l.t}
          </text>
        ))}
        <g style={{ fontSize: 10.5 }}>
          <rect x={16} y={288} width={11} height={11} rx={3} fill={t.color} fillOpacity="0.82" />
          <text x={32} y={297} style={{ fill: 'var(--text-muted)' }}>주 사용·공용어권</text>
          <rect x={128} y={288} width={11} height={11} rx={3} fill={t.color} fillOpacity="0.4" />
          <text x={144} y={297} style={{ fill: 'var(--text-muted)' }}>널리 통용</text>
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
