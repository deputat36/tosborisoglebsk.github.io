const pageIndexSearch = (() => {
  const input = document.querySelector('#site-search');
  const baseResults = document.querySelector('#search-results');
  if (!input || !baseResults) return;

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const normalize = (value) => String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  let pages = [];

  const box = document.createElement('div');
  box.id = 'page-index-search-results';
  box.className = 'list';
  baseResults.insertAdjacentElement('afterend', box);

  function render() {
    const query = normalize(input.value);
    if (!query || query.length < 2) {
      box.innerHTML = '';
      return;
    }

    const results = pages
      .filter((page) => normalize([page.title, page.description, page.section, page.path, page.url].join(' ')).includes(query))
      .slice(0, 30);

    if (!results.length) {
      box.innerHTML = '';
      return;
    }

    box.innerHTML = `<div class="section-head"><div><h2>Страницы сайта</h2><p>Дополнительные результаты из полного индекса страниц</p></div></div>` + results.map((page) => `<article class="list-item"><span class="tag">${esc(page.section || 'Страница')}</span><h3>${esc(page.title || 'Без названия')}</h3><p>${esc(page.description || page.path || '')}</p><a class="btn" href="${esc(new URL(page.url).pathname)}">Открыть</a></article>`).join('');
  }

  fetch('/data/page_index.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      pages = Array.isArray(data?.pages) ? data.pages : [];
      render();
    })
    .catch(() => { pages = []; });

  input.addEventListener('input', render);
})();
