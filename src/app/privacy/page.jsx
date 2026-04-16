import Link from 'next/link';

export const metadata = {
  title: '개인정보 처리방침 · Anatomy Studio',
  description: 'Anatomy Studio 개인정보 수집 및 이용 안내',
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px', lineHeight: 1.75 }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: 6 }}>개인정보 처리방침</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 28 }}>
        최종 업데이트: 2026년 4월 16일
      </p>

      <h2 style={h2}>1. 수집하는 정보</h2>
      <ul>
        <li><strong>계정 정보</strong>: 이메일, 닉네임, 암호화된 비밀번호(또는 Google OAuth 식별자)</li>
        <li><strong>학습 데이터</strong>: 업로드한 자료, 저장한 단어, 학습 진행도, 문법 노트, 작성한 글</li>
        <li><strong>이용 기록</strong>: 로그인 시각, 간단한 오류 로그</li>
      </ul>

      <h2 style={h2}>2. 이용 목적</h2>
      <ul>
        <li>서비스 제공(자료 분석, 복습 스케줄링, 통계 제공)</li>
        <li>계정 보안 및 부정 이용 방지</li>
        <li>서비스 개선을 위한 통계 분석(개인 식별이 불가능한 형태로)</li>
      </ul>

      <h2 style={h2}>3. 보관 및 파기</h2>
      <p>
        사용자가 계정 삭제를 요청하면 즉시 모든 개인 데이터가 삭제됩니다.
        공용(public)으로 공개된 자료는 소유자 표기가 제거된 형태로 남을 수 있습니다.
      </p>

      <h2 style={h2}>4. 제3자 제공 및 위탁</h2>
      <ul>
        <li><strong>Supabase</strong> — 데이터베이스/인증 호스팅</li>
        <li><strong>Google Gemini, Groq</strong> — 업로드한 텍스트의 분석 처리(저장하지 않는 것을 원칙으로 함)</li>
      </ul>
      <p>
        위 사업자들은 각자의 개인정보 처리방침을 따르며, 필요한 범위 내에서만 정보를 전달합니다.
      </p>

      <h2 style={h2}>5. 사용자 권리</h2>
      <ul>
        <li>언제든지 내 프로필에서 데이터를 JSON으로 내보낼 수 있습니다.</li>
        <li>언제든지 계정을 영구 삭제할 수 있습니다.</li>
        <li>비밀번호 변경·재설정이 가능합니다.</li>
      </ul>

      <h2 style={h2}>6. 쿠키 및 로컬 저장소</h2>
      <p>
        로그인 유지, 테마 설정 등 서비스 동작에 필요한 최소한의 데이터를 브라우저에 저장합니다.
        광고·추적 쿠키는 사용하지 않습니다.
      </p>

      <h2 style={h2}>7. 문의</h2>
      <p>
        개인정보 관련 문의는 가입 이메일로 회신드립니다.
      </p>

      <p style={{ marginTop: 40 }}>
        <Link href="/terms" style={{ color: 'var(--primary)' }}>← 이용약관 보기</Link>
      </p>
    </div>
  );
}

const h2 = { fontSize: '1.05rem', marginTop: 28, marginBottom: 8 };
