const pageIndexEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

let pageIndexItems = [];

async function loadPageIndex() {
  const response = await fetch('/data/page_index.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('page index not found');
  return response.json();
}

function localHref(url) {
  const text = String(url || '/');
  return text.replace('https://tosborisoglebsk.ru', '') || '/';
}

function renderPageIndex() {
  const list = document.querySelector('#page-index-list');
  const input = document.querySelector('#page-index-search');
  const count = document.querySelector('#page-index-count');
  if (!list) return;
  const query = (input?.value || '').trim().toLowerCase().replace(/ё/g, 'е');
  const filtered = !query ? pageIndexItems : pageIndexItems.filter((page) => [page.title, page.description, page.section, page.url].join(' ').toLowerCase().replace(/ё/g, 'е').includes(query));
  if (count) count.textContent = `Показано ${filtered.length} из ${pageIndexItems.length} страниц`;
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">Страницы не найдены.</div>';
    return;
  }
  list.innerHTML = filtered.map((page) => `<article class="list-item"><div class="meta"><span class="tag">${pageIndexEsc(page.section)}</span></div><h3>${pageIndexEsc(page.title)}</h3><p>${pageIndexEsc(page.description || 'Описание страницы не указано.')}</p><div class="card-actions"><a class="btn" href="${pageIndexEsc(localHref(page.url))}">Открыть</a></div></article>`).join('');
}

async function initPageIndex() {
  const list = document.querySelector('#page-index-list');
  const input = document.querySelector('#page-index-search');
  try {
    const data = await loadPageIndex();
    pageIndexItems = data.pages || [];
    input?.addEventListener('input', renderPageIndex);
    renderPageIndex();
  } catch (error) {
    if (list) list.innerHTML = '<div class="empty">Индекс страниц ещё не создан. Запустите Generate TOS pages.</div>';
  }
}

initPageIndex();
