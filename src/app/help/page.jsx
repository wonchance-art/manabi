import Link from 'next/link';

export const metadata = {
  title: '도움말 · Anatomy Studio',
  description: '자주 묻는 질문과 사용 팁',
};

const FAQ = [
  {
    q: '어떻게 학습을 시작하나요?',
    a: '복습 탭의 \'오늘 학습 시작\'이 정문이에요. 매일 새 이야기 한 편에 복습과 새 내용이 함께 담겨 나와요. 자료실에서 직접 글이나 PDF를 올려 읽을 수도 있어요 — 단어를 탭하면 뜻이 뜨고 단어장에 저장됩니다.',
  },
  {
    q: '복습은 어디서 하나요?',
    a: '복습 탭에서요. 오늘 몫이 이야기 한 편에 담겨 나오고, 카드로만 돌릴 수도 있어요. 자료실 글을 읽을 때도 복습 시점이 된 단어는 표시가 붙어 그 자리에서 평가할 수 있어요.',
  },
  {
    q: 'FSRS는 뭐예요?',
    a: '기억 곡선 기반 간격 반복 알고리즘입니다. 단어마다 "얼마나 잘 기억하는지"를 추적해서 다음 복습 시점을 자동으로 계산해줘요. Anki에서도 사용하는 검증된 알고리즘이에요.',
  },
  {
    q: '단어 의미가 이상해요/틀렸어요.',
    a: 'AI가 생성한 결과라 가끔 오류가 있을 수 있어요. 단어장에서 뜻을 직접 수정할 수 있고, 그 수정본은 본인 단어장에만 반영됩니다.',
  },
  {
    q: 'PDF가 분석이 안 돼요.',
    a: '이미지 스캔 PDF는 OCR이 필요해서 시간이 더 걸려요(30초~1분). 순수 텍스트 PDF는 즉시 처리됩니다. 너무 긴 PDF(100쪽 이상)는 나눠서 올려주세요.',
  },
  {
    q: '데이터를 백업/이전할 수 있나요?',
    a: '프로필 → 계정 → "내 데이터 내보내기"에서 JSON으로 전체 데이터를 받을 수 있어요.',
  },
  {
    q: '계정을 삭제하고 싶어요.',
    a: '프로필 → 계정 → "계정 삭제"에서 영구 삭제할 수 있어요. 되돌릴 수 없으니 먼저 데이터를 내보내는 걸 권장드려요.',
  },
  {
    q: '오프라인에서도 쓸 수 있나요?',
    a: '한번 연 자료는 캐시돼서 오프라인으로도 읽을 수 있어요. 하지만 새 자료 분석·단어 저장은 인터넷이 필요합니다.',
  },
  {
    q: '버그를 발견했거나 문의할 게 있어요.',
    a: '가입 이메일로 회신드려요. 화면 스크린샷과 함께 증상을 알려주시면 빠르게 확인할 수 있어요.',
  },
];

export default function HelpPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px' }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: 6 }}>도움말</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
        자주 묻는 질문을 모았어요. 여기에 없는 질문은 가입 이메일로 문의주세요.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FAQ.map(({ q, a }, i) => (
          <details key={i} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }}>
            <summary style={{ fontWeight: 600, fontSize: '0.95rem', listStyle: 'none' }}>
              Q. {q}
            </summary>
            <p style={{ marginTop: 10, color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9rem' }}>
              {a}
            </p>
          </details>
        ))}
      </div>

      <div style={{ marginTop: 40, padding: 16, borderRadius: 10, background: 'var(--bg-subtle)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        더 궁금하신 점이 있으신가요? 아래 링크도 확인해주세요.
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/guide" className="btn btn--ghost btn--sm">사용 가이드</Link>
          <Link href="/terms" className="btn btn--ghost btn--sm">이용약관</Link>
          <Link href="/privacy" className="btn btn--ghost btn--sm">개인정보</Link>
        </div>
      </div>
    </div>
  );
}
