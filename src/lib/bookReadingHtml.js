// Only SHA-verified, application-owned edition HTML is passed to this parser.
// Do not use this path for uploaded documents or administrator-supplied HTML.
export function extractReadingSections(html) {
  const articles = [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)];
  return articles.flatMap(([article]) => {
    const opening = article.slice(0, article.indexOf('>') + 1);
    const unit = opening.match(/data-unit-page="([a-z0-9-]+)"/)?.[1];
    const id = opening.match(/\bid="([a-zA-Z0-9_-]+)"/)?.[1];
    if (!unit || !id) return [];
    if (/<(?:script|iframe|object|embed)\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*javascript:/i.test(article)) throw new Error('Unsafe edition HTML');
    const content = article.replace(opening, opening.replace(/\s+hidden(?:="[^"]*")?/, ''));
    return [{ id, unit, anchors: [...article.matchAll(/\bid="([a-zA-Z0-9_-]+)"/g)].map(match => match[1]), html: content }];
  });
}

export function readingSectionLabel(section, pages) {
  const page = pages.find(item => item.id === section.id);
  if (section.id.endsWith('-start')) return '장면과 준비';
  if (section.id.endsWith('-patterns')) return '표현 익히기';
  if (section.id.endsWith('-dialogue')) return '대화로 사용하기';
  if (section.id.endsWith('-practice')) return '읽기와 연습';
  return page?.title || section.id;
}
