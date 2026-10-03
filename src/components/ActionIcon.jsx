// Decorative only: the owning control supplies its accessible name and state.
const paths={
  home:'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',
  book:'M12 5v16M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Z',
  library:'M4 4v16M9 4v16M14 4v16M18 4l3 16',
  compass:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M16 8l-3 5-5 3 3-5 5-3Z',
  review:'M20 8a8 8 0 0 0-14-3L3 8M3 3v5h5M4 16a8 8 0 0 0 14 3l3-3M16 16h5v5',
  menu:'M4 6h16M4 12h16M4 18h16',
  search:'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15M16 16l5 5',
  user:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21v-2a8 8 0 0 1 16 0v2',
  users:'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M2 21v-2a7 7 0 0 1 14 0v2M16 3a4 4 0 0 1 0 8M18 13a6 6 0 0 1 4 6v2',
  settings:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  type:'M4 19 10 5l6 14M6 14h8M17 19l3-8 3 8M18 16h4',
  moon:'M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10',
  sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  back:'M20 12H4M10 6l-6 6 6 6',
  previous:'m15 5-7 7 7 7', next:'m9 5 7 7-7 7',
  up:'m5 15 7-7 7 7', down:'m5 9 7 7 7-7',
  play:'m8 4 12 8-12 8V4Z', pause:'M8 4v16M16 4v16', stop:'M5 5h14v14H5Z',
  audio:'m3 9 4 0 5-5v16l-5-5H3V9ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14',
  headphones:'M3 14v-3a9 9 0 0 1 18 0v3M3 12h4v9H3ZM17 12h4v9h-4Z',
  edit:'m4 16 12-12 4 4L8 20H4v-4ZM13 7l4 4',
  more:'M5 12h.01M12 12h.01M19 12h.01',
  close:'m6 6 12 12M6 18 18 6',
  expand:'M9 3H3v6M15 3h6v6M21 15v6h-6M9 21H3v-6',
  collapse:'M3 9h6V3M15 3v6h6M21 15h-6v6M9 21v-6H3',
  translate:'M3 4h12M9 2v2M5 4c0 7 7 11 7 11M13 4c0 7-7 11-10 12M13 21l4-10 4 10M15 17h4',
};
export default function ActionIcon({name}) {
  return <svg className="action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]||paths.more}/></svg>;
}
