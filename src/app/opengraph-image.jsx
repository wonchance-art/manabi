import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Anatomy Studio — AI 언어 해부 학습';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f1020 0%, #1a1b3a 50%, #2a1f5c 100%)',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          padding: '80px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 130, marginBottom: 20 }}>🧬</div>
        <div
          style={{
            fontSize: 78,
            fontWeight: 800,
            letterSpacing: -2,
            marginBottom: 18,
            background: 'linear-gradient(90deg, #a78bfa, #7c5cfc)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Anatomy Studio
        </div>
        <div style={{ fontSize: 36, color: '#cbd5e1', marginBottom: 40, lineHeight: 1.4 }}>
          AI가 문장을 해부하고 <br />
          FSRS로 과학적으로 기억해요
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 24,
            color: '#94a3b8',
          }}
        >
          <span>🇯🇵 일본어</span>
          <span>·</span>
          <span>🇬🇧 영어</span>
          <span>·</span>
          <span>📊 FSRS v5</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
