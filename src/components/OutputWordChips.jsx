'use client';

/**
 * 오늘 복습한 말 칩 줄 (#1077-16+17 목업 ③) — 작문·회화 화면 상단에 조용히 놓인다.
 * 칩 탭 = 뜻 토스트, usedSet(회화)에 든 단어는 ✓. 후보 없으면 아무것도 그리지 않는다.
 */
import { useToast } from '../lib/ToastContext';

export default function OutputWordChips({ words, usedSet }) {
  const toast = useToast();
  if (!words?.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>
        ✍️ 오늘 복습한 말 써먹기:
      </span>
      {words.map((w) => {
        const used = usedSet?.has?.(w.word_text);
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => { if (w.meaning) toast(`${w.word_text} — ${w.meaning}`, 'info'); }}
            title={w.meaning || undefined}
            style={{
              border: '1px solid var(--border)', borderRadius: 999, padding: '2px 10px',
              background: 'none', cursor: w.meaning ? 'pointer' : 'default',
              fontSize: '0.82rem', color: 'var(--text-secondary)',
            }}
          >
            {w.word_text}{used ? ' ✓' : ''}
          </button>
        );
      })}
    </div>
  );
}
