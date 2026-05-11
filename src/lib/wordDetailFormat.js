/**
 * 단어 상세 markdown → HTML
 * 도입 문구 제거, **섹션 제목**(뜻/뉘앙스/예문/발음)은 hr + heading,
 * 일반 **bold**는 그대로, 빈 줄은 단락 분리.
 */
export function formatDetail(text) {
  if (!text) return '';
  const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '-');
  const startIdx = lines.findIndex(l => l.startsWith('**'));
  const cleaned = (startIdx > 0 ? lines.slice(startIdx) : lines).join('\n');
  return cleaned
    .replace(/\*\*(.+?)\*\*/g, (_, m) => {
      if (/^(번역|맥락|발음|뜻|뉘앙스|예문)$/.test(m.trim())) {
        return `<hr class="pdf-detail-hr" /><strong class="pdf-detail-heading">${m}</strong>`;
      }
      return `<strong>${m}</strong>`;
    })
    .split('\n').map(l => l.trim()).filter(Boolean).join('<br />')
    .replace(/(<br \/>){2,}/g, '</p><p>')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 강의 설명 markdown → HTML
 * **헤딩**, 일반 단락, 일본어 예문 줄(클릭 시 TTS 가능)을 분리 렌더.
 * 일본어 줄 = 굵은 헤딩이 아니고 일본어 문자(히라가나/가타카나/한자) 포함.
 */
export function formatLessonExplanation(text) {
  if (!text) return '';
  const lines = text.split('\n').map(l => l.trim());
  const out = [];
  for (const raw of lines) {
    if (!raw) {
      out.push('<div class="lesson-explanation__gap" aria-hidden="true"></div>');
      continue;
    }
    const isHeading = raw.startsWith('**') && raw.endsWith('**') && raw.length > 4;
    if (isHeading) {
      const head = raw.slice(2, -2);
      out.push(`<h3 class="lesson-explanation__heading">${escapeHtml(head)}</h3>`);
      continue;
    }
    const hasJa = /[぀-ヿ一-鿿]/.test(raw);
    const startsJa = /^[぀-ヿ一-鿿]/.test(raw);
    const inlined = raw.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (hasJa && startsJa) {
      const jaOnly = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
      out.push(`<p class="lesson-body__line lesson-explanation__example" data-ja="${escapeHtml(jaOnly)}">${inlined}</p>`);
    } else {
      out.push(`<p class="lesson-explanation__p">${inlined}</p>`);
    }
  }
  return out.join('');
}
