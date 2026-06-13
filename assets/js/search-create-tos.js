document.addEventListener('DOMContentLoaded', () => {
  const input = document.querySelector('#site-search');
  const root = document.querySelector('#search-results');
  if (!input || !root) return;

  const items = [
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

  let lastQuery = null;

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function renderExtras() {
    const query = input.value.toLowerCase().trim().replace(/ё/g, 'е');
    if (query === lastQuery && root.querySelector('.search-create-extra')) return;
    lastQuery = query;

    root.querySelectorAll('.search-create-extra').forEach((node) => node.remove());

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const haystack = [item.type, item.title, item.text].join(' ').toLowerCase().replace(/ё/g, 'е');
      if (query && !haystack.includes(query)) return;

      const card = document.createElement('article');
      card.className = 'list-item search-create-extra';
      card.innerHTML = `<span class="tag">${esc(item.type)}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p><a class="btn" href="${esc(item.url)}">Открыть</a>`;
      fragment.appendChild(card);
    });
    root.appendChild(fragment);
  }

  input.addEventListener('input', () => setTimeout(renderExtras, 0));
  setTimeout(renderExtras, 700);
});
