const newsCore = window.CollectionBrowserCore;

const newsEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const newsPublished = (item) => item.status !== 'draft';
const newsFields = ['q', 'category', 'tos', 'origin'];

function newsOrigin(item) {
  if (['verified', 'editorial', 'starter', 'request'].includes(item.content_origin)) return item.content_origin;
  if (item.id === 'mirolyubie-project-winner-2026') return 'verified';
  if (String(item.id || '').startsWith('send-news-')) return 'request';
  return 'editorial';
}

function newsOriginTag(item) {
  const origin = newsOrigin(item);
  const labels = {
    verified: 'Подтверждено источником',
    editorial: 'Редакционный материал',
    starter: 'Стартовый материал',
    request: 'Запрос материалов'
  };
  const className = origin === 'verified' ? 'ok' : origin === 'request' ? 'warn' : '';
  return `<span class="tag ${className}">${newsEsc(labels[origin])}</span>`;
}

function newsOriginNotice(item) {
  const origin = newsOrigin(item);
  if (origin === 'verified') return '';
  if (origin === 'request') return '<div class="notice"><b style="color:var(--text)">Это запрос материалов</b><br>Запись приглашает прислать сведения, фото или уточнение и не подтверждает, что событие уже произошло.</div>';
  if (origin === 'starter') return '<div class="notice"><b style="color:var(--text)">Стартовая заготовка</b><br>До получения даты события, участников, результата и источника материал нельзя считать фактической новостью территории.</div>';
  return '<div class="notice"><b style="color:var(--text)">Редакционный материал</b><br>Текст подготовлен порталом. Для утверждений о событии, результате или сроках проверьте первичный источник.</div>';
}

function newsDate(value) {
  if (!value) return 'Дата уточняется';
  const date = new Date(`${value}T00:00:00`);
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
  return `<article class="list-item" data-content-origin="${newsEsc(newsOrigin(item))}">
    <div class="meta">
      ${newsOriginTag(item)}
      <span class="tag">${newsEsc(item.category || 'Новость')}</span>
      <span class="tag">${newsEsc(newsDate(item.date))}</span>
      ${tosName ? `<span class="tag">${newsEsc(tosName)}</span>` : ''}
    </div>
    <h3>${newsEsc(item.title || 'Новость')}</h3>
    <p>${newsEsc(item.lead || '')}</p>
    ${item.text && Array.isArray(item.text) && item.text[0] ? `<p class="tiny">${newsEsc(item.text[0]).slice(0, 260)}${newsEsc(item.text[0]).length > 260 ? '...' : ''}</p>` : ''}
    ${newsOriginNotice(item)}
    <div class="card-actions">
      <a class="btn primary" href="/news/${newsEsc(item.id)}/">Читать</a>
      ${item.tos_slug ? `<a class="btn" href="/tos/${newsEsc(item.tos_slug)}/">Карточка ТОС</a>` : ''}
      ${item.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${newsEsc(item.source_url)}">Источник</a>` : ''}
    </div>
  </article>`;
}

function renderNewsSummary(items, total) {
  const root = document.querySelector('#news-summary');
  if (!root) return;
  const counts = newsCore.countOrigins(items, newsOrigin);
  root.innerHTML = `<div class="summary-grid"><div class="summary-tile"><b>${items.length}</b><span>показано из ${total}</span></div><div class="summary-tile"><b>${counts.verified}</b><span>подтверждено источником</span></div><div class="summary-tile"><b>${counts.editorial}</b><span>редакционные материалы</span></div><div class="summary-tile"><b>${counts.starter}</b><span>стартовые материалы</span></div><div class="summary-tile"><b>${counts.request}</b><span>запросы материалов</span></div></div>`;
}

async function renderNewsPage() {
  const root = document.querySelector('#news-feed');
  if (!root || !newsCore) return;

  const controls = {
    q: document.querySelector('#news-search'),
    category: document.querySelector('#news-category-filter'),
    tos: document.querySelector('#news-tos-filter'),
    origin: document.querySelector('#news-origin-filter')
  };
  const reset = document.querySelector('#news-reset-filters');
  const status = document.querySelector('#news-filter-status');

  try {
    const { news, toses } = await loadNewsPageData();
    const categories = [...new Set(news.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const usedTos = [...new Set(news.map((item) => item.tos_slug).filter(Boolean))];

    if (controls.category) controls.category.innerHTML = '<option value="">Все темы</option>' + categories.map((value) => `<option>${newsEsc(value)}</option>`).join('');
    if (controls.tos) controls.tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map((slug) => `<option value="${newsEsc(slug)}">${newsEsc(newsTosName(slug, toses))}</option>`).join('');

    newsCore.applyControls(newsCore.parseState(window.location.search, newsFields), controls);

    function apply(sync = true) {
      const state = newsCore.readControls(controls);
      const query = newsCore.normalizeText(state.q);
      const filtered = news
        .filter((item) => !state.category || item.category === state.category)
        .filter((item) => !state.tos || item.tos_slug === state.tos)
        .filter((item) => !state.origin || newsOrigin(item) === state.origin)
        .filter((item) => {
          const tosName = newsTosName(item.tos_slug, toses);
          const hay = newsCore.normalizeText([item.title, item.lead, item.category, item.source, item.tos_slug, tosName, newsOrigin(item), ...(item.text || [])].join(' '));
          return !query || hay.includes(query);
        })
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

      root.innerHTML = filtered.length ? filtered.map((item) => newsCard(item, toses)).join('') : '<div class="empty">По выбранным фильтрам новости и материалы не найдены. Сбросьте фильтры или измените запрос.</div>';
      renderNewsSummary(filtered, news.length);
      newsCore.setStatus(status, filtered.length, news.length, newsCore.activeFilterCount(state));
      if (sync) newsCore.syncUrl(state, newsFields);
    }

    newsCore.bindControls(controls, () => apply(true));
    reset?.addEventListener('click', () => {
      newsCore.resetControls(controls);
      apply(true);
      controls.q?.focus();
    });
    controls.q?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && controls.q.value) {
        controls.q.value = '';
        apply(true);
      }
    });
    apply(true);
  } catch (error) {
    root.innerHTML = '<div class="empty">Новости не загрузились. Проверьте data/news.json</div>';
    if (status) status.textContent = 'Ошибка загрузки ленты новостей.';
  }
}

renderNewsPage();
