import Spinner from '../components/Spinner';
import Button from '../components/Button';

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="md-strong">$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em class="md-em">$1</em>')
    .replace(/`(.+?)`/g,       '<code class="md-code">$1</code>');
}

const KNOWN_LABELS = new Set([
  '직역','의역','주어','서술어','목적어','보어','패턴','단어','상황','격식','반말',
  '예문','예시','의미','유사표현',
  '뉘앙스','차이','참고','활용법','조사',
]);

function preprocessMd(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const soloLabel = t.match(/^[\*_]*([가-힣A-Za-z·~]+(?:\s[가-힣A-Za-z]+)?)[\*_]*\s*[:：]\s*$/);
    if (soloLabel && KNOWN_LABELS.has(soloLabel[1])) {
      const nextContent = lines[i + 1]?.trim();
      if (nextContent && !nextContent.startsWith('#') && !nextContent.startsWith('-')) {
        out.push(`${soloLabel[1]}: ${nextContent}`);
        i++;
        continue;
      }
    }
    out.push(lines[i]);
  }
  return out.join('\n');
}

const TIER1 = ['직역','의역','주어','서술어','목적어','보어','패턴','단어','상황','격식','반말'];
const TIER2 = ['예문','예시','의미','유사표현'];
const TIER3 = ['뉘앙스','차이','참고','활용법','조사','Note','Nuance'];

function renderMdLine(line, i) {
  const t = line.trim();
  if (!t) return <div key={i} className="md-gap" />;
  if (t.startsWith('### ')) return <h4 key={i} className="md-subsection">{t.slice(4)}</h4>;
  if (t.startsWith('## '))  return <h3 key={i} className="md-section">{t.slice(3)}</h3>;
  if (t.startsWith('# '))   return <h2 key={i} className="md-title">{t.slice(2)}</h2>;
  if (t === '---') return <hr key={i} className="md-rule" />;

  const labelMatch = t.match(/^[\*_]*([가-힣A-Za-z·~]+(?:\s[가-힣A-Za-z]+)?)[\*_]*\s*[:：]\s*(.+)/);
  if (labelMatch) {
    const label = labelMatch[1].trim();
    const content = labelMatch[2].trim();
    if (TIER1.includes(label)) {
      return (
        <div key={i} className="md-trans md-trans--main">
          <span className="md-trans__label">{label}</span>
          <span className="md-trans__text">{content}</span>
        </div>
      );
    }
    if (TIER2.includes(label)) {
      return (
        <div key={i} className="md-example">
          <span className="md-example__label">{label}</span>
          <span className="md-example__text">{content}</span>
        </div>
      );
    }
    if (TIER3.includes(label)) {
      return (
        <p key={i} className="md-nuance">
          <span className="md-nuance__label">{label}</span>
          {' '}{content}
        </p>
      );
    }
  }

  const numberedMatch = t.match(/^(\d+[.)]\s+|[①②③④⑤⑥⑦⑧⑨⑩]\s*)(.+)/);
  if (numberedMatch) {
    const num = numberedMatch[1].trim();
    const content = numberedMatch[2];
    const html = inlineFormat(content);
    return (
      <div key={i} className="md-numbered">
        <span className="md-numbered__num">{num}</span>
        <span dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  if (t.startsWith('- ') || t.startsWith('· ')) {
    const html = inlineFormat(t.slice(2));
    return <div key={i} className="md-bullet" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const html = inlineFormat(t);
  return <p key={i} className="md-p" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ViewerGrammarModal({
  isOpen, onClose, selectedRangeText, materialLang,
  isGrammarLoading, grammarAnalysis,
  checkedActions, setCheckedActions, GRAMMAR_ACTIONS,
  requestGrammarAnalysis,
  grammarFollowUp, setGrammarFollowUp,
  grammarFollowLoading, askFollowUp,
  saveGrammarNoteMutation, user,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">💡 AI 문법 해설사</h2>
          <button onClick={onClose} className="modal__close">✕</button>
        </div>
        <div className="modal__body">
          <div className="modal__quote">
            {materialLang === 'Japanese'
              ? selectedRangeText.replace(/\s+/g, '')
              : selectedRangeText}
          </div>

          {!isGrammarLoading && (
            <div style={{ marginBottom: '16px' }}>
              <div className="grammar-action-grid">
                {GRAMMAR_ACTIONS.map(a => {
                  const checked = checkedActions.has(a.key);
                  return (
                    <button
                      key={a.key}
                      className={`grammar-action-btn ${checked ? 'grammar-action-btn--checked' : ''}`}
                      onClick={() => setCheckedActions(prev => {
                        const next = new Set(prev);
                        if (next.has(a.key)) next.delete(a.key); else next.add(a.key);
                        return next;
                      })}
                    >
                      <span className="grammar-action-btn__check">{checked ? '✓' : ''}</span>
                      <span className="grammar-action-btn__label">{a.label}</span>
                      <span className="grammar-action-btn__desc">{a.desc}</span>
                    </button>
                  );
                })}
              </div>
              {checkedActions.size === 0
                ? <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '10px' }}>원하는 항목을 선택해주세요</p>
                : <button
                    className="btn btn--primary"
                    style={{ width: '100%', marginTop: '10px' }}
                    onClick={() => requestGrammarAnalysis([...checkedActions])}
                  >
                    ✨ 분석 시작 ({checkedActions.size}개 선택)
                  </button>
              }
            </div>
          )}

          {isGrammarLoading
            ? <Spinner message="AI가 문장을 해부하고 있습니다..." />
            : grammarAnalysis && (
                <div className="md-body">
                  {preprocessMd(grammarAnalysis).split('\n').map((line, i) => renderMdLine(line, i))}
                </div>
              )
          }
        </div>
        {!isGrammarLoading && grammarAnalysis && (
          <div className="modal__footer" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={grammarFollowUp}
                onChange={e => setGrammarFollowUp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && askFollowUp()}
                placeholder="이 문장에 대해 질문하기..."
                className="search-input"
                style={{ flex: 1, fontSize: '0.88rem' }}
                disabled={grammarFollowLoading}
              />
              <Button size="sm" onClick={askFollowUp} disabled={!grammarFollowUp.trim() || grammarFollowLoading}>
                {grammarFollowLoading ? '...' : '질문'}
              </Button>
            </div>
            {user && (
              <button
                onClick={() => saveGrammarNoteMutation.mutate()}
                disabled={saveGrammarNoteMutation.isPending || saveGrammarNoteMutation.isSuccess}
                className="btn btn--secondary btn--sm"
              >
                {saveGrammarNoteMutation.isSuccess ? '✅ 저장됨' : saveGrammarNoteMutation.isPending ? '저장 중...' : '📝 노트에 저장'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
