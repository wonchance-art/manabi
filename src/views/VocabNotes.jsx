import Link from 'next/link';
import EmptyState from '../components/EmptyState';

export default function VocabNotes({ grammarNotes, deleteNoteMutation }) {
  return (
    <div className="grammar-notes-list">
      {grammarNotes.length === 0 ? (
        <EmptyState
          icon="📝"
          title="저장된 문법 노트가 없어요"
          desc="뷰어에서 문장을 드래그해 AI 해설을 받고 저장해보세요"
          action={<Link href="/materials" className="btn btn--primary btn--md">📰 자료 보러가기</Link>}
        />
      ) : grammarNotes.map(note => (
        <div key={note.id} className="grammar-note-card">
          <div className="grammar-note-card__header">
            <span className="grammar-note-card__text">&ldquo;{note.selected_text}&rdquo;</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              {note.reading_materials && (
                <span className="grammar-note-card__source">{note.reading_materials.title}</span>
              )}
              <button
                className="grammar-note-card__delete"
                onClick={() => deleteNoteMutation.mutate(note.id)}
                title="삭제"
              >✕</button>
            </div>
          </div>
          <div className="grammar-note-card__explanation">
            {note.explanation.split('\n').slice(0, 4).map((line, i) => {
              if (!line.trim()) return null;
              const formatted = line
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/`(.+?)`/g, '<code>$1</code>');
              return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} style={{ margin: '2px 0', fontSize: '0.88rem', lineHeight: 1.6 }} />;
            })}
          </div>
          <div className="grammar-note-card__footer">
            {new Date(note.created_at).toLocaleDateString('ko-KR')}
          </div>
        </div>
      ))}
    </div>
  );
}
