const newsEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const newsPublished = (item) => item.status !== 'draft';

function newsDate(value) {
  if (!value) return 'Дата уточняется';
  const date = new Date(value + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function loadNewsPageData() {
  const [news, toses] = await Promise.all([
    fetch('/data/news.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []),
    fetch('/data/toses.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []).catch(() => [])
  ]);
  return { news: news.filter(newsPublished), toses };
}

function newsTosName(slug, toses) {
  if (!slug) return '';
  const found = toses.find((tos) => tos.slug === slug);
  return found ? `ТОС «${found.name}»` : slug;
}

function newsCard(item, toses) {
  const tosName = newsTosName(item.tos_slug, toses);
  return `<article class="list-item">
    <div class="meta">
      <span class="tag">${newsEsc(item.category || 'Новость')}</span>
      <span class="tag">${newsEsc(newsDate(item.date))}</span>
      ${tosName ? `<span class="tag">${newsEsc(tosName)}</span>` : ''}
    </div>
    <h3>${newsEsc(item.title || 'Новость')}</h3>
    <p>${newsEsc(item.lead || '')}</p>
    ${item.text && Array.isArray(item.text) && item.text[0] ? `<p class="tiny">${newsEsc(item.text[0]).slice(0, 260)}${newsEsc(item.text[0]).length > 260 ? '...' : ''}</p>` : ''}
    <div class="card-actions">
      <a class="btn primary" href="/news/${newsEsc(item.id)}/">Читать</a>
      ${item.tos_slug ? `<a class="btn" href="/tos/${newsEsc(item.tos_slug)}/">Карточка ТОС</a>` : ''}
      ${item.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${newsEsc(item.source_url)}">Источник</a>` : ''}
    </div>
  </article>`;
}

async function renderNewsPage() {
  const root = document.querySelector('#news-feed');
  if (!root) return;
  const search = document.querySelector('#news-search');
  const category = document.querySelector('#news-category-filter');
  const tos = document.querySelector('#news-tos-filter');

  try {
    const { news, toses } = await loadNewsPageData();
    const categories = [...new Set(news.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const usedTos = [...new Set(news.map((item) => item.tos_slug).filter(Boolean))];

    if (category) category.innerHTML = '<option value="">Все темы</option>' + categories.map((value) => `<option>${newsEsc(value)}</option>`).join('');
    if (tos) tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map((slug) => `<option value="${newsEsc(slug)}">${newsEsc(newsTosName(slug, toses))}</option>`).join('');

    function apply() {
      const query = (search?.value || '').toLowerCase().trim().replace(/ё/g, 'е');
      const selectedCategory = category?.value || '';
      const selectedTos = tos?.value || '';
      const filtered = news
        .filter((item) => !selectedCategory || item.category === selectedCategory)
        .filter((item) => !selectedTos || item.tos_slug === selectedTos)
        .filter((item) => {
          const tosName = newsTosName(item.tos_slug, toses);
          const hay = [item.title, item.lead, item.category, item.source, item.tos_slug, tosName, ...(item.text || [])].join(' ').toLowerCase().replace(/ё/g, 'е');
          return !query || hay.includes(query);
        })
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      root.innerHTML = filtered.length ? filtered.map((item) => newsCard(item, toses)).join('') : '<div class="empty">Новости не найдены.</div>';
    }

    [search, category, tos].forEach((element) => element?.addEventListener('input', apply));
    apply();
  } catch (error) {
    root.innerHTML = '<div class="empty">Новости не загрузились. Проверьте data/news.json</div>';
  }
}

renderNewsPage();
