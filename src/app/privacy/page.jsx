import Link from 'next/link';
// (app) 레이아웃 밖이라 셸 CSS가 따라오지 않는다 — Layout과 같은 순서로 직접 불러온다(not-found 선례).
// 셸로 감싸 기기 밝은/어두운 모드와 상관없이 종이 바탕 · 먹 글자(COLOR-SYS-001 단계 3, 오너 「전부 권장대로」 2026-11-05 KST).
import '@/components/books/reading-shell.css';
import '@/components/web/web-shell.css';

export const metadata = {
  title: '개인정보 처리방침',
  description: 'manabi 개인정보 수집 및 이용 안내',
};

export default function PrivacyPage() {
  return (
    <div className="manabi-app"><div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px', lineHeight: 1.75 }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: 6 }}>개인정보 처리방침</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 28 }}>
        최종 업데이트: 2026년 11월 2일
      </p>

      <h2 style={h2}>1. 수집하는 정보</h2>
      <ul>
        <li><strong>계정 정보</strong>: 이메일, 닉네임, 암호화된 비밀번호(또는 Google OAuth 식별자)</li>
        <li><strong>학습 데이터</strong>: 업로드한 자료, 저장한 단어, 학습 진행도, 복습 · 채점 기록, 문법 노트, 작성한 글, 대화 모드에서 주고받은 문장</li>
        <li><strong>알림 정보</strong>: 복습 알림을 켠 경우 브라우저 푸시 구독 정보(알림을 받을 주소)</li>
        <li><strong>이용 기록</strong>: 로그인 시각, 간단한 오류 로그</li>
      </ul>

      <h2 style={h2}>2. 이용 목적</h2>
      <ul>
        <li>서비스 제공(자료 분석, 대화 · 첨삭, 복습 스케줄링, 복습 알림, 통계 제공)</li>
        <li>계정 보안 및 부정 이용 방지</li>
        <li>서비스 개선을 위한 통계 분석(개인 식별이 불가능한 형태로)</li>
      </ul>

      <h2 style={h2}>3. 보관 및 파기</h2>
      <p>
        사용자가 계정 삭제를 요청하면 즉시 모든 개인 데이터가 삭제됩니다.
        공용(public)으로 공개된 자료는 소유자 표기가 제거된 형태로 남을 수 있습니다.
      </p>

      <h2 style={h2}>4. 처리 위탁 및 국외 이전</h2>
      <p>
        manabi는 개인정보를 판매하거나 제3자에게 제공하지 않습니다. 서비스를 운영하기 위해 아래 사업자에게 처리를 맡기며,
        이 과정에서 정보가 국외(일본 · 미국)에 있는 서버로 전송 · 보관됩니다.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={table}>
          <thead>
            <tr><th style={th}>받는 곳</th><th style={th}>국가</th><th style={th}>맡기는 일</th><th style={th}>전달되는 정보</th></tr>
          </thead>
          <tbody>
            <tr><td style={td}>Supabase</td><td style={td}>일본(도쿄)</td><td style={td}>데이터베이스 · 로그인</td><td style={td}>계정 정보, 학습 데이터</td></tr>
            <tr><td style={td}>Vercel</td><td style={td}>일본(도쿄)</td><td style={td}>웹사이트 · 서버 실행</td><td style={td}>요청 처리 중의 데이터, 접속 기록</td></tr>
            <tr><td style={td}>Anthropic (Claude)</td><td style={td}>미국</td><td style={td}>대화 모드 답장, 첨삭, 자료 분석</td><td style={td}>입력한 문장 · 자료 텍스트</td></tr>
            <tr><td style={td}>Google (Gemini)</td><td style={td}>미국</td><td style={td}>자료 분석</td><td style={td}>분석할 자료 텍스트</td></tr>
            <tr><td style={td}>Google (로그인)</td><td style={td}>미국</td><td style={td}>Google 계정으로 로그인(선택한 경우)</td><td style={td}>Google이 알려 주는 이메일 · 식별자</td></tr>
            <tr><td style={td}>브라우저 푸시 서비스(Google · Apple · Mozilla 등)</td><td style={td}>미국</td><td style={td}>복습 알림 전달(켠 경우)</td><td style={td}>알림 문구, 알림을 받을 주소</td></tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li>전송 시점: 해당 기능을 쓸 때마다 암호화된 연결(HTTPS)로 보냅니다. 보관 기간은 아래 3번(계정 삭제 시 파기)과 각 사업자의 방침을 따릅니다.</li>
        <li>국외 이전을 원하지 않으면 계정을 삭제할 수 있습니다. 다만 위 처리 없이는 서비스를 제공할 수 없습니다.</li>
        <li>개인정보가 담기지 않는 조회도 있습니다: 자료 가져오기(YouTube · Supadata — 영상 주소만), 비밀번호 유출 확인(Have I Been Pwned — 비밀번호 해시의 앞 5자리만).</li>
      </ul>

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
    </div></div>
  );
}

const h2 = { fontSize: '1.05rem', marginTop: 28, marginBottom: 8 };
const table = { borderCollapse: 'collapse', width: '100%', fontSize: '0.88rem', margin: '8px 0 12px' };
const th = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' };
const td = { padding: '6px 8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };
