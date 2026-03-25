export default function GuidePage() {
  const curriculums = [
    {
      lang: 'Japanese',
      icon: '🇯🇵',
      title: '일본어 (JLPT) 로드맵',
      levels: [
        { name: 'N5 기초', focus: '기초 입문', desc: '히라가나/가타카나, 기본 조사(은/는, 이/가), 입니다/합니까 등 필수 표현. (약 60개 문법)' },
        { name: 'N4 기본', focus: '일상 회화', desc: '비교(~보다), 이유(~때문에), 가능형, 수동형 등 기초 문법 완성. (약 120개 문법)' },
        { name: 'N3 중급', focus: '가교 단계', desc: '일상 화제 이해, 경어(존경/겸양), 사역/수동형의 복합 활용. (약 200개 문법)' },
        { name: 'N2 상급', focus: '사회적 주제', desc: '신문 기사, 잡지 해설문 이해 및 논리적 추론. 비즈니스 수준의 회화 및 독해. (약 400개 문법)' },
        { name: 'N1 심화', focus: '원어민 수준', desc: '추상적/논리적 복잡한 글 이해. 학술 용어 및 고난도 관용구 마스터. (약 600개 문법)' }
      ]
    },
    {
      lang: 'English',
      icon: '🇬🇧',
      title: '영어 (CEFR) 로드맵',
      levels: [
        { name: 'A1-A2 Basic', focus: 'Survival', desc: 'Familiar expressions, simple personal info, direct exchange in routine tasks.' },
        { name: 'B1-B2 Independent', focus: 'Fluency', desc: 'Clear standard input, spontaneous interaction, technical discussions in expertise.' },
        { name: 'C1-C2 Proficient', focus: 'Mastery', desc: 'Implicit meaning, academic/professional flexibility, finer shades of meaning.' }
      ]
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">🗺️ 학습 로드맵 & 가이드</h1>
        <p className="page-header__subtitle">Anatomy Studio만의 체계적인 언어 정복 가이드입니다</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
        {curriculums.map((curr) => (
          <div key={curr.lang} className="card" style={{ padding: '30px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '6rem', opacity: 0.05, pointerEvents: 'none' }}>{curr.icon}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
              <span style={{ fontSize: '2rem' }}>{curr.icon}</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{curr.title}</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {curr.levels.map((level, idx) => (
                <div key={level.name} style={{ display: 'flex', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'var(--primary)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.9rem', fontWeight: 700, flexShrink: 0
                    }}>
                      {level.name.split(' ')[0]}
                    </div>
                    {idx !== curr.levels.length - 1 && <div style={{ width: '2px', flex: 1, background: 'var(--border)', margin: '4px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: idx !== curr.levels.length - 1 ? '10px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{level.name}</h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, background: 'var(--accent-glow)', padding: '2px 8px', borderRadius: '4px' }}>{level.focus}</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{level.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{
        marginTop: '30px', padding: '40px',
        background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.1), rgba(6, 214, 160, 0.1))',
        border: '1px solid var(--primary-glow)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
          <span style={{ fontSize: '2rem' }}>💡</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>AI 기반 맞춤형 학습법</h2>
        </div>
        <p style={{ color: 'var(--text-primary)', fontSize: '1.05rem', lineHeight: 1.8, maxWidth: '800px' }}>
          Anatomy Studio는 단순한 암기를 넘어, **문장 해부(Anatomy)**를 통해 언어의 구조를 직관적으로 이해하도록 돕습니다.
          내가 읽고 싶은 자료를 업로드하면 AI가 실시간으로 분석하여, 나의 현재 레벨에 맞는 핵심 문법과 어휘를 추출해줍니다.
        </p>
      </div>
    </div>
  );
}
