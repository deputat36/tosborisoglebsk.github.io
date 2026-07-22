const projectCore = window.CollectionBrowserCore;
// Search normalization is centralized in CollectionBrowserCore.normalizeText: replace(/ё/g, 'е').

const projectEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const projectPublished = (item) => item && item.status !== 'draft';
const projectFields = ['q', 'type', 'tos', 'origin'];

function projectOrigin(item) {
  if (['verified', 'editorial', 'starter', 'request'].includes(item.content_origin)) return item.content_origin;
  if (String(item.id || '').startsWith('public-stand-and-ideas-')) return 'starter';
  return 'editorial';
}

function projectOriginTag(item) {
  const origin = projectOrigin(item);
  const labels = {
    verified: 'Подтверждено источником',
    editorial: 'Редакционный материал',
    starter: 'Стартовая идея',
    request: 'Запрос материалов'
  };
  const className = origin === 'verified' ? 'ok' : origin === 'request' ? 'warn' : '';
  return `<span class="tag ${className}">${projectEsc(labels[origin])}</span>`;
}

function projectCatalogStatus(item) {
  if (item.status === 'published') return 'В каталоге';
  return item.status ? `Технический статус: ${item.status}` : 'Технический статус уточняется';
}

async function loadProjectsData() {
  const [projects, toses] = await Promise.all([
    fetch('/data/projects.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []),
    fetch('/data/toses.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []).catch(() => [])
  ]);
  return { projects: projects.filter(projectPublished), toses };
}

function projectTosName(slug, toses) {
  if (!slug) return '';
  const found = toses.find((tos) => tos.slug === slug);
  return found ? `ТОС «${found.name}»` : slug;
}

function projectCard(item, toses) {
  const tosName = projectTosName(item.tos_slug, toses);
  const detailUrl = item.id ? `/projects/${projectEsc(item.id)}/` : '/projects/';
  const steps = Array.isArray(item.steps) ? item.steps.slice(0, 3) : [];
  return `<article class="list-item project-card" data-content-origin="${projectEsc(projectOrigin(item))}">
    <div class="meta">
      ${projectOriginTag(item)}
      <span class="tag">${projectEsc(item.type || 'Проект')}</span>
      <span class="tag">${projectEsc(projectCatalogStatus(item))}</span>
      ${tosName ? `<span class="tag">${projectEsc(tosName)}</span>` : ''}
    </div>
    <h3>${projectEsc(item.title || 'Проект без названия')}</h3>
    <p>${projectEsc(item.description || '')}</p>
    ${item.grant_logic ? `<p class="tiny"><b>Подходит для заявки:</b> ${projectEsc(item.grant_logic)}</p>` : ''}
    ${item.based_on ? `<p class="tiny"><b>Основание:</b> ${projectEsc(item.based_on)}</p>` : ''}
    ${steps.length ? `<div class="notice"><b style="color:var(--text)">Первые шаги</b><br>${steps.map((step) => `- ${projectEsc(step)}`).join('<br>')}</div>` : ''}
    <div class="card-actions">
      <a class="btn primary" href="${detailUrl}">Подробнее</a>
      ${item.tos_slug ? `<a class="btn" href="/tos/${projectEsc(item.tos_slug)}/">Открыть ТОС</a>` : ''}
      <a class="btn" href="/projects/action-routes/">Маршрут проекта</a>
      <a class="btn" href="/update-tos/?type=project#message-builder">Предложить проект</a>
      ${item.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${projectEsc(item.source_url)}">Источник</a>` : ''}
    </div>
  </article>`;
}

function renderProjectsSummary(items, total) {
  const root = document.querySelector('#projects-summary');
  if (!root) return;
  const counts = projectCore.countOrigins(items, projectOrigin);
  const withTos = items.filter((item) => item.tos_slug).length;
  root.innerHTML = `<div class="summary-grid"><div class="summary-tile"><b>${items.length}</b><span>показано из ${total}</span></div><div class="summary-tile"><b>${counts.verified}</b><span>подтверждено источником</span></div><div class="summary-tile"><b>${counts.editorial}</b><span>редакционные проекты</span></div><div class="summary-tile"><b>${counts.starter}</b><span>стартовые идеи</span></div><div class="summary-tile"><b>${withTos}</b><span>привязаны к ТОС</span></div></div>`;
}

async function renderProjects() {
  const root = document.querySelector('#projects-list');
  if (!root || !projectCore) return;

  const controls = {
    q: document.querySelector('#projects-search'),
    type: document.querySelector('#projects-type-filter'),
    tos: document.querySelector('#projects-tos-filter'),
    origin: document.querySelector('#projects-origin-filter')
  };
  const reset = document.querySelector('#projects-reset-filters');
  const status = document.querySelector('#projects-filter-status');

  try {
    const { projects, toses } = await loadProjectsData();
    const types = [...new Set(projects.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const usedTos = [...new Set(projects.map((item) => item.tos_slug).filter(Boolean))];

    if (controls.type) controls.type.innerHTML = '<option value="">Все типы проектов</option>' + types.map((value) => `<option>${projectEsc(value)}</option>`).join('');
    if (controls.tos) controls.tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map((slug) => `<option value="${projectEsc(slug)}">${projectEsc(projectTosName(slug, toses))}</option>`).join('');

    projectCore.applyControls(projectCore.parseState(window.location.search, projectFields), controls);

    function apply(sync = true) {
      const state = projectCore.readControls(controls);
      const query = projectCore.normalizeText(state.q);
      const filtered = projects
        .filter((item) => !state.type || item.type === state.type)
        .filter((item) => !state.tos || item.tos_slug === state.tos)
        .filter((item) => !state.origin || projectOrigin(item) === state.origin)
        .filter((item) => {
          const tosName = projectTosName(item.tos_slug, toses);
          const hay = projectCore.normalizeText([item.title, item.description, item.type, item.grant_logic, item.based_on, item.tos_slug, tosName, projectOrigin(item), ...(item.steps || [])].join(' '));
          return !query || hay.includes(query);
        })
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru'));

      root.innerHTML = filtered.length ? filtered.map((item) => projectCard(item, toses)).join('') : '<div class="empty">По выбранным фильтрам проекты и идеи не найдены. Сбросьте фильтры или измените запрос.</div>';
      renderProjectsSummary(filtered, projects.length);
      projectCore.setStatus(status, filtered.length, projects.length, projectCore.activeFilterCount(state));
      if (sync) projectCore.syncUrl(state, projectFields);
    }

    projectCore.bindControls(controls, () => apply(true));
    reset?.addEventListener('click', () => {
      projectCore.resetControls(controls);
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
    root.innerHTML = '<div class="empty">Банк проектов не загрузился. Проверьте файл data/projects.json</div>';
    if (status) status.textContent = 'Ошибка загрузки банка проектов.';
  }
}

renderProjects();
