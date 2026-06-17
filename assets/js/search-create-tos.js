document.addEventListener('DOMContentLoaded', () => {
  const input = document.querySelector('#site-search');
  const root = document.querySelector('#search-results');
  if (!input || !root) return;

  const manualItems = [
    {
      type: 'Создание ТОС',
      title: 'Как создать ТОС в Борисоглебском городском округе',
      text: 'инициативная группа территория границы городская Дума собрание конференция устав регистрация устава органы ТОС первые 30 дней',
      url: '/create-tos/'
    },
    {
      type: 'Комплект документов',
      title: 'Документы для создания ТОС',
      text: 'карточка инициативы описание территории объявление список участников протокол решения проект устава сопроводительный лист чек-лист',
      url: '/documents/templates/tos-creation-kit/'
    }
  ];

  let pageIndexItems = [];
  let lastQuery = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function norm(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function pathFromUrl(url) {
    try { return new URL(url).pathname; } catch (error) { return url || '/'; }
  }

  function renderExtras() {
    const query = norm(input.value);
    if (query === lastQuery && root.querySelector('.search-create-extra')) return;
    lastQuery = query;

    root.querySelectorAll('.search-create-extra').forEach((node) => node.remove());

    const combined = [
      ...manualItems,
      ...pageIndexItems.map((page) => ({
        type: page.section || 'Страница',
        title: page.title || 'Без названия',
        text: [page.description, page.path].filter(Boolean).join(' '),
        url: pathFromUrl(page.url)
      }))
    ];

    const seen = new Set();
    const fragment = document.createDocumentFragment();
    combined.forEach((item) => {
      if (seen.has(item.url)) return;
      seen.add(item.url);
      const haystack = norm([item.type, item.title, item.text, item.url].join(' '));
      if (query && !haystack.includes(query)) return;
      if (!query && !manualItems.includes(item)) return;

      const card = document.createElement('article');
      card.className = 'list-item search-create-extra';
      card.innerHTML = `<span class="tag">${esc(item.type)}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p><a class="btn" href="${esc(item.url)}">Открыть</a>`;
      fragment.appendChild(card);
    });
    root.appendChild(fragment);
  }

  fetch('/data/page_index.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => {
      pageIndexItems = Array.isArray(data?.pages) ? data.pages : [];
      renderExtras();
    })
    .catch(() => { pageIndexItems = []; });

  input.addEventListener('input', () => setTimeout(renderExtras, 0));
  setTimeout(renderExtras, 700);
});
