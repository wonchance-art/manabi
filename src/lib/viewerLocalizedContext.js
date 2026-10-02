import { canonicalViewerLocale, viewerLanguageInfo } from './viewerLanguage';

export const LOCALIZED_EXPLANATION_VERSION = 1;
const fields = ['meaning', 'translation', 'structure', 'pattern'];
const nonempty = value => typeof value === 'string' && !!value.trim();
const splitsSurrogate = (text, at) => at > 0 && at < text.length
  && /[\uD800-\uDBFF]/.test(text[at - 1]) && /[\uDC00-\uDFFF]/.test(text[at]);

/** Raw source offsets use UTF-16, never normalized text or reconstructed lemmas. */
export function absoluteSourceSpan(rawText, sourceSpan) {
  if (typeof rawText !== 'string' || sourceSpan?.unit !== 'utf16'
    || !Number.isSafeInteger(sourceSpan.start) || !Number.isSafeInteger(sourceSpan.end)
    || sourceSpan.start < 0 || sourceSpan.end <= sourceSpan.start) return null;
  let origin = 0, limit = rawText.length;
  const absoluteWithLine = sourceSpan.lineStart !== undefined || sourceSpan.lineEnd !== undefined;
  if (absoluteWithLine) {
    if (!Number.isSafeInteger(sourceSpan.lineIndex) || sourceSpan.lineIndex < 0
      || !Number.isSafeInteger(sourceSpan.lineStart) || sourceSpan.lineStart < 0
      || !Number.isSafeInteger(sourceSpan.lineEnd) || sourceSpan.lineEnd <= sourceSpan.lineStart) return null;
    // The saved Korean client contract uses split('\n') lines, retaining CR.
    const lines = rawText.split('\n');
    if (sourceSpan.lineIndex >= lines.length) return null;
    for (let i = 0; i < sourceSpan.lineIndex; i++) origin += lines[i].length + 1;
    const lineLimit = lines[sourceSpan.lineIndex].length + (sourceSpan.lineIndex < lines.length - 1 ? 1 : 0);
    if (sourceSpan.lineEnd > lineLimit || sourceSpan.start !== origin + sourceSpan.lineStart
      || sourceSpan.end !== origin + sourceSpan.lineEnd) return null;
    if (splitsSurrogate(rawText, sourceSpan.start) || splitsSurrogate(rawText, sourceSpan.end)) return null;
    return { start: sourceSpan.start, end: sourceSpan.end, unit: 'utf16' };
  }
  if (sourceSpan.lineIndex !== undefined) {
    if (!Number.isSafeInteger(sourceSpan.lineIndex) || sourceSpan.lineIndex < 0) return null;
    const breaks = /\r\n|\r|\n/g;
    for (let line = 0; line < sourceSpan.lineIndex; line++) {
      const match = breaks.exec(rawText);
      if (!match) return null;
      origin = match.index + match[0].length;
    }
    const next = breaks.exec(rawText);
    limit = next ? next.index : rawText.length;
  }
  const start = origin + sourceSpan.start, end = origin + sourceSpan.end;
  if (end > limit || splitsSurrogate(rawText, start) || splitsSurrogate(rawText, end)) return null;
  return { start, end, unit: 'utf16' };
}

/** An expected surface is compared literally; whitespace/NFC differences are meaningful. */
export function exactSourceQuote(rawText, sourceSpan, expectedSurface) {
  const span = absoluteSourceSpan(rawText, sourceSpan);
  if (!span) return null;
  const quote = rawText.slice(span.start, span.end);
  return expectedSurface === undefined || expectedSurface === quote ? quote : null;
}

/** In-memory identity only. Existing DB source_key and card IDs remain authoritative. */
export function viewerSourceIdentity({ materialId, targetLanguage, sourceRevision, rawText, sourceSpan } = {}) {
  const language = viewerLanguageInfo(targetLanguage);
  const span = absoluteSourceSpan(rawText, sourceSpan);
  if (!language || !span || !nonempty(sourceRevision) || !nonempty(String(materialId ?? ''))) return null;
  return JSON.stringify(['viewer_source:v1', String(materialId), language.language,
    sourceRevision, span.start, span.end, rawText.slice(span.start, span.end)]);
}

/** Optional JSON metadata only; this does not build a vocabulary UPDATE payload. */
export function withLocalizedExplanation(record, explanation) {
  const locale = canonicalViewerLocale(explanation?.explanationLocale);
  if (!record || typeof record !== 'object' || Array.isArray(record) || !locale
    || !nonempty(explanation.sourceRevision) || !nonempty(explanation.explanationVersion)
    || fields.some(field => explanation[field] !== undefined && typeof explanation[field] !== 'string')) {
    throw new TypeError('Invalid localized explanation');
  }
  const previous = record.localizedExplanations;
  // Unknown future contracts must survive older writers without silent replacement.
  if (previous && previous.version !== LOCALIZED_EXPLANATION_VERSION) {
    throw new TypeError('Unsupported localized explanation version');
  }
  const sameRevision = previous?.sourceRevision === explanation.sourceRevision;
  const byLocale = sameRevision && previous?.byLocale && typeof previous.byLocale === 'object'
    && !Array.isArray(previous.byLocale) ? previous.byLocale : {};
  const value = { explanationVersion: explanation.explanationVersion,
    ...Object.fromEntries(fields.filter(field => explanation[field] !== undefined).map(field => [field, explanation[field]])) };
  return { ...record, localizedExplanations: { version: LOCALIZED_EXPLANATION_VERSION,
    sourceRevision: explanation.sourceRevision, byLocale: { ...byLocale, [locale]: value } } };
}

/** A legacy Korean meaning is never presented as a Chinese explanation. */
export function readLocalizedExplanation(record, { explanationLocale = 'ko', sourceRevision, explanationVersion } = {}) {
  const locale = canonicalViewerLocale(explanationLocale);
  if (!locale) return null;
  const envelope = record?.localizedExplanations;
  if (envelope) {
    if (envelope.version !== LOCALIZED_EXPLANATION_VERSION || !nonempty(sourceRevision)
      || envelope.sourceRevision !== sourceRevision) return null;
    const value = envelope.byLocale?.[locale];
    if (value) {
      if (!nonempty(value.explanationVersion)
        || (explanationVersion !== undefined && value.explanationVersion !== explanationVersion)
        || fields.some(field => value[field] !== undefined && typeof value[field] !== 'string')) return null;
      return { locale, sourceRevision, explanationVersion: value.explanationVersion,
        ...Object.fromEntries(fields.filter(field => value[field] !== undefined).map(field => [field, value[field]])), legacy: false };
    }
  }
  return locale === 'ko' && typeof record?.meaning === 'string'
    ? { locale: 'ko', meaning: record.meaning, legacy: true } : null;
}
