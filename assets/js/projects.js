const projectEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const projectPublished = (item) => item && item.status !== 'draft';

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
  return `<article class="list-item project-card">
    <div class="meta">
      <span class="tag">${projectEsc(item.type || 'Проект')}</span>
      <span class="tag ${item.status === 'published' ? 'ok' : ''}">${projectEsc(item.status === 'published' ? 'Опубликовано' : item.status || 'Статус уточняется')}</span>
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

async function renderProjects() {
  const root = document.querySelector('#projects-list');
  if (!root) return;

  try {
    const { projects, toses } = await loadProjectsData();
    const sorted = projects.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ru'));
    root.innerHTML = sorted.length ? sorted.map((item) => projectCard(item, toses)).join('') : '<div class="empty">Проекты пока не добавлены.</div>';
  } catch {
    root.innerHTML = '<div class="empty">Банк проектов не загрузился. Проверьте файл data/projects.json</div>';
  }
}

renderProjects();
