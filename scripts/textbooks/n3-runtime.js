// Independent N3 review artifact runtime. No account, audio or publication API.
const revision = document.querySelector('meta[name="manuscript-revision"]').content;
const storageKey = `manabi-japanese-n3:${revision}:answers-v1`;
const status = document.querySelector('.draft-status');
let current = 'cover';
const getAnswers = () => {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
};
for (const field of document.querySelectorAll('[data-save]')) {
  const saved = getAnswers()[field.dataset.save];
  if (field.type === 'radio') field.checked = saved === field.value;
  else if (typeof saved === 'string') field.value = saved;
  field.addEventListener('input', () => {
    if (field.type === 'radio' && !field.checked) return;
    try {
      const answers = getAnswers(); answers[field.dataset.save] = field.value;
      localStorage.setItem(storageKey, JSON.stringify(answers));
      status.textContent = '이 판본의 답안을 이 브라우저에 저장했어요.';
    } catch { status.textContent = '브라우저 저장을 사용할 수 없어 현재 화면에만 유지돼요.'; }
  });
}
function search() {
  const query = document.getElementById('lex-search').value.trim().toLocaleLowerCase();
  let count = 0;
  for (const card of document.querySelectorAll('[data-search]')) {
    card.hidden = !!query && !card.dataset.search.toLocaleLowerCase().includes(query);
    if (!card.hidden) count++;
  }
  document.querySelector('.search-status').textContent = query ? `${count}개 항목을 찾았어요.` : '';
}
function route() {
  let hash;
  try { hash = decodeURIComponent(location.hash.slice(1)) || 'cover'; } catch { hash = 'cover'; }
  const target = document.getElementById(hash);
  const page = target?.closest('[data-unit-page]');
  const units = [...document.querySelectorAll('nav [data-unit]')].map(item => item.dataset.unit);
  current = page?.dataset.unitPage || (units.includes(hash) ? hash : 'cover');
  for (const article of document.querySelectorAll('[data-unit-page]')) article.hidden = article.dataset.unitPage !== current;
  for (const link of document.querySelectorAll('nav [data-unit]')) {
    link.classList.toggle('active', link.dataset.unit === current);
    if (link.dataset.unit === current) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
  const heading = target && !target.hidden ? target : document.querySelector(`[data-unit-page="${current}"]`);
  requestAnimationFrame(() => { if (heading) { heading.scrollIntoView({ block: 'start' }); heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); } });
  search();
}
for (const button of document.querySelectorAll('.translation')) button.addEventListener('click', () => {
  const hidden = button.closest('.dialogue').classList.toggle('hide-ko');
  button.setAttribute('aria-pressed', String(hidden)); button.textContent = hidden ? '해석 보기' : '해석 가리기';
});
for (const button of document.querySelectorAll('[data-toggle]')) button.addEventListener('click', () => {
  const name = button.dataset.toggle;
  const hidden = document.getElementById('web').classList.toggle(`hide-${name}`);
  button.setAttribute('aria-pressed', String(hidden));
  button.textContent = `${name === 'meanings' ? '뜻' : '읽기'} ${hidden ? '보기' : '가리기'}`;
});
document.getElementById('lex-search').addEventListener('input', search);
window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);
route();
