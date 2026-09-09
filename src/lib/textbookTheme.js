// 교재·관리자 편집기·향후 PDF 출력에서 함께 쓰는 언어별 색상.
export const TEXTBOOK_THEMES = {
  Japanese: { name: '모브', main: 'var(--book-mauve-main)', wash: 'var(--book-mauve-wash)', darkText: 'var(--book-mauve-dark-text)' },
  Chinese: { name: '세이지', main: 'var(--book-sage-main)', wash: 'var(--book-sage-wash)', darkText: 'var(--book-sage-dark-text)' },
  French: { name: '잉크블루', main: 'var(--book-inkblue-main)', wash: 'var(--book-inkblue-wash)', darkText: 'var(--book-inkblue-dark-text)' },
  English: { name: '앰버', main: 'var(--book-amber-main)', wash: 'var(--book-amber-wash)', darkText: 'var(--book-amber-dark-text)' },
};

export function textbookThemeStyle(lang) {
  const theme = TEXTBOOK_THEMES[lang] || TEXTBOOK_THEMES.English;
  return {
    '--book-main': theme.main,
    '--book-wash': theme.wash,
    '--book-dark-text': theme.darkText,
  };
}
