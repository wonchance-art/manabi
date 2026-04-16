import Link from 'next/link';

export const metadata = {
  title: '이용약관 · Anatomy Studio',
  description: 'Anatomy Studio 서비스 이용약관',
};

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px', lineHeight: 1.75 }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: 6 }}>이용약관</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 28 }}>
        최종 업데이트: 2026년 4월 16일
      </p>

      <h2 style={h2}>1. 서비스 개요</h2>
      <p>
        Anatomy Studio(이하 "서비스")는 외국어 학습을 돕기 위한 개인용 학습 도구입니다.
        사용자가 업로드한 텍스트·PDF를 분석하고, 단어장과 복습 스케줄을 제공합니다.
      </p>

      <h2 style={h2}>2. 계정 및 책임</h2>
      <ul>
        <li>이메일/비밀번호 또는 소셜 로그인으로 계정을 생성합니다.</li>
        <li>비밀번호 관리와 계정에서 이루어진 모든 활동은 사용자 본인이 책임집니다.</li>
        <li>만 14세 미만은 보호자 동의 하에만 이용할 수 있습니다.</li>
      </ul>

      <h2 style={h2}>3. 금지 행위</h2>
      <ul>
        <li>타인의 저작물을 무단으로 업로드·공개하는 행위</li>
        <li>서비스에 과도한 부하를 일으키거나 자동화된 방법으로 남용하는 행위</li>
        <li>불법·유해 콘텐츠를 학습 자료로 공유하는 행위</li>
      </ul>

      <h2 style={h2}>4. 콘텐츠 권리</h2>
      <p>
        사용자가 업로드한 자료의 저작권은 원저작자에게 있습니다. 공용(public)으로 공개한 자료는
        다른 사용자가 열람·학습에 이용할 수 있도록 서비스 내 제한적 라이선스를 부여한 것으로 간주합니다.
      </p>

      <h2 style={h2}>5. 서비스 변경 및 중단</h2>
      <p>
        운영상 필요에 따라 기능이 추가·변경되거나, 상당한 사유가 있을 때 사전 공지 후 서비스가 중단될 수 있습니다.
      </p>

      <h2 style={h2}>6. 면책</h2>
      <p>
        학습 콘텐츠 분석 결과(의미·문법 설명 등)는 AI가 생성하며 오류가 있을 수 있습니다.
        중요한 의사결정에는 반드시 전문가·공식 사전을 병행 확인해주세요.
      </p>

      <h2 style={h2}>7. 문의</h2>
      <p>
        서비스 관련 문의는 가입 시 사용한 이메일을 통해 회신드립니다.
      </p>

      <p style={{ marginTop: 40 }}>
        <Link href="/privacy" style={{ color: 'var(--primary)' }}>개인정보 처리방침 보기 →</Link>
      </p>
    </div>
  );
}

const h2 = { fontSize: '1.05rem', marginTop: 28, marginBottom: 8 };
