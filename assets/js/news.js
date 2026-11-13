const newsCore = window.CollectionBrowserCore;
// Search normalization is centralized in CollectionBrowserCore.normalizeText: replace(/ё/g, 'е').

const newsEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const newsPublished = (item) => item.status !== 'draft';
const newsFields = ['q', 'category', 'tos', 'origin', 'year', 'page'];
const NEWS_PAGE_SIZE = 24;

function newsOrigin(item) {
  if (['verified', 'editorial', 'starter', 'request'].includes(item.content_origin)) return item.content_origin;
  if (item.id === 'mirolyubie-project-winner-2026') return 'verified';
  if (String(item.id || '').startsWith('send-news-')) return 'request';
  return 'editorial';
}

function newsDefaultVisible(item) {
  return newsOrigin(item) !== 'request';
}

function newsOriginTag(item) {
  if (item.imported_from === 'vk') return '<span class="tag">Из сообщества ВКонтакте</span>';
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
  if (item.imported_from === 'vk') return '';
  const origin = newsOrigin(item);
  if (origin === 'verified') return '';
  if (origin === 'request') return '<div class="notice"><b class="news-origin-label">Это запрос материалов</b><br>Запись приглашает прислать сведения, фото или уточнение и не подтверждает, что событие уже произошло.</div>';
  if (origin === 'starter') return '<div class="notice"><b class="news-origin-label">Стартовая заготовка</b><br>До получения даты события, участников, результата и источника материал нельзя считать фактической новостью территории.</div>';
  return '<div class="notice"><b class="news-origin-label">Редакционный материал</b><br>Текст подготовлен порталом. Для утверждений о событии, результате или сроках проверьте первичный источник.</div>';
}

function newsDate(value) {
  if (!value) return 'Дата уточняется';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function loadNewsPageData() {
  const [news, toses] = await Promise.all([
    fetch('/data/news.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject(new Error('News unavailable'))),
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
  const tosName = newsCore.tosSlugs(item).map(slug => newsTosName(slug, toses)).join(' · ');
  return `<article class="list-item" data-content-origin="${newsEsc(newsOrigin(item))}">
    ${window.TosNewsMedia ? window.TosNewsMedia.render(item, true) : ''}
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
      ${newsCore.tosSlugs(item).map(slug => `<a class="btn" href="/tos/${newsEsc(slug)}/">${newsEsc(newsTosName(slug, toses))}</a>`).join('')}
      ${item.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${newsEsc(item.source_url)}">Источник</a>` : ''}
    </div>
  </article>`;
}

function renderNewsSummary(items, total) {
  const root = document.querySelector('#news-summary');
  if (!root) return;
  const counts = newsCore.countOrigins(items, newsOrigin);
  const vkCount = items.filter(item => item.imported_from === 'vk').length;
  root.innerHTML = `<div class="summary-grid"><div class="summary-tile"><b>${items.length}</b><span>найдено из ${total}</span></div><div class="summary-tile"><b>${counts.verified}</b><span>подтверждено источником</span></div><div class="summary-tile"><b>${counts.editorial-vkCount}</b><span>редакционные материалы</span></div><div class="summary-tile"><b>${vkCount}</b><span>из сообщества ВКонтакте</span></div><div class="summary-tile"><b>${counts.starter}</b><span>стартовые материалы</span></div><div class="summary-tile"><b>${counts.request}</b><span>запросы материалов</span></div></div>`;
}

async function renderNewsPage() {
  const root = document.querySelector('#news-feed');
  if (!root || !newsCore) return;

  const controls = {
    q: document.querySelector('#news-search'),
    category: document.querySelector('#news-category-filter'),
    tos: document.querySelector('#news-tos-filter'),
    origin: document.querySelector('#news-origin-filter'),
    year: document.querySelector('#news-year-filter')
  };
  if (controls.origin?.options?.[0]) controls.origin.options[0].textContent = 'Содержательные публикации';
  const reset = document.querySelector('#news-reset-filters');
  const status = document.querySelector('#news-filter-status');

  try {
    const { news, toses } = await loadNewsPageData();
    Object.values(controls).forEach(control => { if (control) control.disabled = false; });
    if (reset) reset.disabled = false;
    const categories = [...new Set(news.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const usedTos = [...new Set(news.flatMap((item) => newsCore.tosSlugs(item)))];

    if (controls.year) controls.year.innerHTML = '<option value="">Все годы</option>' + [...new Set(news.map(item => String(item.date || '').slice(0,4)).filter(value => /^\d{4}$/.test(value)))].sort().reverse().map(year => `<option>${year}</option>`).join('');
    if (controls.category) controls.category.innerHTML = '<option value="">Все темы</option>' + categories.map((value) => `<option>${newsEsc(value)}</option>`).join('');
    if (controls.tos) controls.tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map((slug) => `<option value="${newsEsc(slug)}">${newsEsc(newsTosName(slug, toses))}</option>`).join('');

    const initial = newsCore.parseState(window.location.search, newsFields);
    let page = Math.max(1, Math.floor(Number(initial.page)) || Number(window.location.pathname.match(/\/archive\/(\d+)\//)?.[1]) || 1);
    newsCore.applyControls(initial, controls);

    function apply(sync = true) {
      const state = newsCore.readControls(controls);
      const query = newsCore.normalizeText(state.q);
      const originPool = state.origin
        ? news.filter((item) => newsOrigin(item) === state.origin)
        : news.filter(newsDefaultVisible);
      const filtered = originPool
        .filter((item) => !state.category || item.category === state.category)
        .filter((item) => !state.tos || newsCore.belongsToTos(item, state.tos))
        .filter((item) => !state.year || String(item.date || '').startsWith(state.year))
        .filter((item) => {
          const tosName = newsCore.tosSlugs(item).map(slug => newsTosName(slug, toses)).join(' · ');
          const hay = newsCore.normalizeText([item.title, item.lead, item.category, item.source, item.tos_slug, tosName, newsOrigin(item), ...(item.text || []), ...(item.reposts || []).flatMap(part => part.text || [])].join(' '));
          return !query || hay.includes(query);
        })
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.published_at || b.date || '').localeCompare(String(a.published_at || a.date || '')));

      const pages = Math.max(1, Math.ceil(filtered.length / NEWS_PAGE_SIZE));
      page = Math.min(page, pages);
      const shown = filtered.slice((page-1)*NEWS_PAGE_SIZE,page*NEWS_PAGE_SIZE);
      root.innerHTML = shown.length ? shown.map((item) => newsCard(item, toses)).join('') : '<div class="empty">По выбранным фильтрам новости и материалы не найдены. Сбросьте фильтры или измените запрос.</div>';
      renderNewsSummary(filtered, originPool.length);
      const pager = document.querySelector('#news-pagination');
      if (pager) {
        const link = (number,label) => {const query = new URLSearchParams({...state,page:String(number)});return `<a class="btn" href="/news/?${newsEsc(query.toString())}" data-news-page="${number}">${label}</a>`;};
        pager.innerHTML = pages>1 ? `${page>1 ? link(page-1,'← Предыдущая') : ''}<span>Страница ${page} из ${pages}</span>${page<pages ? link(page+1,'Следующая →') : ''}` : '';
        pager.querySelectorAll('[data-news-page]').forEach(link => link.addEventListener('click', event => {event.preventDefault();page=Number(link.dataset.newsPage);apply(true);root.scrollIntoView({block:'start'});}));
      }
      newsCore.setStatus(status, shown.length, filtered.length, newsCore.activeFilterCount(state));
      state.page = page>1 || /\/archive\//.test(window.location.pathname) ? String(page) : '';
      if (sync) newsCore.syncUrl(state, newsFields);
    }

    newsCore.bindControls(controls, () => {page=1;apply(true);});
    reset?.addEventListener('click', () => {
      newsCore.resetControls(controls);
      page=1;
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
    if (!root.querySelector('article')) root.innerHTML = '<div class="empty">Новости временно недоступны. Попробуйте позже или <a href="https://vk.ru/tosbgo">откройте наше сообщество ВК</a>.</div>';
    Object.values(controls).forEach(control => { if (control) control.disabled = true; });
    if (reset) reset.disabled = true;
    if (status) status.textContent = 'Показаны сохранённые публикации. Поиск и фильтры временно недоступны.';
  }
}

renderNewsPage();
