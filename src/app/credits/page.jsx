import Link from 'next/link';
import { DATA_CREDIT_SECTIONS, DATA_CREDITS_UPDATED } from '@/lib/dataCredits';

export const metadata = {
  title: '자료 출처',
  description: 'manabi가 사용하는 공개 자료의 출처와 라이선스',
};

export default function CreditsPage() {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px', lineHeight: 1.75 }}>
      <h1 style={{ fontSize: '1.6rem', marginBottom: 6 }}>자료 출처</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 28 }}>
        최종 업데이트: {DATA_CREDITS_UPDATED}
      </p>
      <p>
        manabi는 아래 공개 자료를 가공해 씁니다. 저작권은 각 원저작자에게 있습니다.
        추천 읽을거리와 영상은 각 글·영상에 출처와 원문 링크를 함께 표시합니다.
      </p>

      {DATA_CREDIT_SECTIONS.map((section) => (
        <section key={section.title}>
          <h2 style={h2}>{section.title}</h2>
          <ul style={{ paddingLeft: 18 }}>
            {section.items.map((item) => (
              <li key={item.id} id={item.id} style={{ marginBottom: 10 }}>
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>
                  {item.name}
                </a>
                {item.holder ? ` · ${item.holder}` : ''}
                {' · '}
                <a href={item.licenseUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                  {item.license}
                </a>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {item.use}
                  {item.changes ? ` — ${item.changes}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p style={{ marginTop: 40 }}>
        <Link href="/terms" style={{ color: 'var(--primary)' }}>← 이용약관 보기</Link>
      </p>
    </div>
  );
}

const h2 = { fontSize: '1.05rem', marginTop: 28, marginBottom: 8 };
