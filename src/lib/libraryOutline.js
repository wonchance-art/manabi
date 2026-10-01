// Transient list layout, not a learning record. Queries and ownership stay separate.
const validKey = key => typeof key === 'string' && /^(book|pdf):[^\u0000-\u001f]{1,160}$/.test(key);
const pageSize = count => Math.min(2000, Math.max(20, Math.ceil(Number(count) / 20) * 20));
export function libraryOutline(value) {
  if (typeof value !== 'string' || value.length > 1000) return {};
  try {
    const entries = JSON.parse(value);
    if (!Array.isArray(entries) || entries.length > 20) return {};
    return Object.fromEntries(entries.filter(entry => Array.isArray(entry) && entry.length === 2 && validKey(entry[0]) && Number.isSafeInteger(entry[1]) && entry[1] >= 20 && entry[1] <= 2000));
  } catch { return {}; }
}
export function libraryOutlineHref(path, key, expanded, count = 20) {
  if (!validKey(key) || !/^\/materials(?:\?|$)/.test(path)) return path;
  const url = new URL(path, 'https://manabi.invalid');
  const entries = Object.entries(libraryOutline(url.searchParams.get('outline'))).filter(([other]) => other !== key);
  if (expanded && Number.isFinite(Number(count))) entries.push([key, pageSize(count)]);
  url.searchParams.delete('restoreY');
  while (true) {
    const value = JSON.stringify(entries);
    if (entries.length) url.searchParams.set('outline', value); else url.searchParams.delete('outline');
    const href = url.pathname + url.search;
    if (!entries.length || (entries.length <= 20 && value.length <= 1000 && href.length <= 1950)) return href;
    entries.shift();
  }
}
