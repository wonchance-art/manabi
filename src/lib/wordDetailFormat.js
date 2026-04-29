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
