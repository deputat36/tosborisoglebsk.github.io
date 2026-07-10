function routeEsc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function statusClass(status) {
  if (status === 'keep' || status === 'keep_separate') return 'ok';
  if (status === 'review' || status === 'ready_for_link_cleanup') return 'warn';
  return '';
}

function routeLink(item, primary = false) {
  const route = item?.route || '';
  const role = item?.role || '';
  return `<article class="card${primary ? ' highlight-card' : ''}"><div class="card-inner"><span class="tag${primary ? ' ok' : ''}">${primary ? 'главный вход' : 'связанная страница'}</span><h3><a href="${routeEsc(route)}">${routeEsc(route)}</a></h3><p>${routeEsc(role)}</p></div></article>`;
}

function renderPreconditions(items) {
  const preconditions = Array.isArray(items) ? items : [];
  if (!preconditions.length) return '';
  return `<ul>${preconditions.map((item) => `<li>${routeEsc(item)}</li>`).join('')}</ul>`;
}

function renderConsolidation(group) {
  const proposal = group?.consolidation || {};
  return `<article class="card full"><div class="card-inner"><div class="meta"><span class="tag ${statusClass(proposal.status)}">${routeEsc(proposal.status || 'status not set')}</span><span class="tag">предложение по консолидации</span></div><h3>${routeEsc(proposal.recommendation || 'Рекомендация не заполнена')}</h3><p><b>Изменение навигации:</b> ${routeEsc(proposal.navigation_change || 'Не определено')}</p><p><b>Не делать:</b> ${routeEsc(proposal.do_not_do || 'Не определено')}</p><div class="notice"><b>До изменения:</b>${renderPreconditions(proposal.preconditions)}</div></div></article>`;
}

function renderGroup(group) {
  const related = Array.isArray(group.related) ? group.related : [];
  return `<section class="section tight"><div class="container section-head"><div><span class="tag ${statusClass(group.status)}">${routeEsc(group.status || 'review')}</span><h2>${routeEsc(group.title || group.id)}</h2><p>${routeEsc(group.decision || '')}</p></div></div><div class="container grid">${routeLink(group.main, true)}${related.map((item) => routeLink(item)).join('')}${renderConsolidation(group)}</div></section>`;
}

async function loadRouteGovernance() {
  const root = document.getElementById('route-governance-groups');
  if (!root) return;

  try {
    const response = await fetch('/data/route_review_summary.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Не удалось загрузить реестр маршрутов');
    const data = await response.json();
    const groups = Array.isArray(data.groups) ? data.groups : [];

    root.innerHTML = groups.length
      ? `<div class="notice"><b>Групп в реестре:</b> ${groups.length}. Обновлено: ${routeEsc(data.updated_at || 'дата не указана')}. Для каждой группы зафиксированы роли и безопасное предложение по консолидации.</div>${groups.map(renderGroup).join('')}`
      : '<div class="notice">Группы маршрутов пока не добавлены.</div>';
  } catch (error) {
    root.innerHTML = '<div class="notice">Карта маршрутов не загрузилась. Проверьте файл <code>/data/route_review_summary.json</code>.</div>';
  }
}

loadRouteGovernance();
