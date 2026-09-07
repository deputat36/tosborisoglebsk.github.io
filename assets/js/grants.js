const grantsEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const grantsPublished = (item) => item && item.status !== 'draft';

function grantProjectLinks(item) {
  const links = Array.isArray(item.project_links) ? item.project_links.filter(Boolean).slice(0, 6) : [];
  if (!links.length) return '';

  return `<div class="card-actions">${links.map((slug) => `<a class="btn" href="/projects/${grantsEsc(slug)}/">${grantsEsc(slug.replace(/-/g, ' '))}</a>`).join('')}</div>`;
}

function grantPrepareList(item) {
  const steps = Array.isArray(item.prepare) ? item.prepare.filter(Boolean).slice(0, 5) : [];
  if (!steps.length) return '';

  return `<div class="notice"><b style="color:var(--text)">Что подготовить</b><br>${steps.map((step) => `- ${grantsEsc(step)}`).join('<br>')}</div>`;
}

function grantCard(item) {
  const source = item.source ? `<a class="btn" href="${grantsEsc(item.source)}" target="_blank" rel="noopener">Источник</a>` : '';
  return `<article class="list-item grant-card">
    <div class="meta">
      <span class="tag warn">${grantsEsc(item.category || 'Возможность')}</span>
      <span class="tag">${grantsEsc(item.difficulty || 'Сложность уточняется')}</span>
    </div>
    <h3>${grantsEsc(item.title || 'Возможность поддержки')}</h3>
    <p>${grantsEsc(item.best_for || item.directions || '')}</p>
    <div class="grid" style="margin:14px 0">
      <article class="card"><div class="card-inner"><span class="tag">Статус</span><p>${grantsEsc(item.status || 'Уточняется')}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Сумма / ресурс</span><p>${grantsEsc(item.amount || 'Уточняется')}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Срок</span><p>${grantsEsc(item.deadline || 'Уточняется')}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Кому подходит</span><p>${grantsEsc(item.who || 'Уточняется')}</p></div></article>
    </div>
    ${grantPrepareList(item)}
    ${item.note ? `<p class="tiny"><b>Редакционная пометка:</b> ${grantsEsc(item.note)}</p>` : ''}
    <div class="card-actions">
      <a class="btn primary" href="/projects/">Подобрать проект</a>
      <a class="btn" href="/documents/">Шаблоны</a>
      <a class="btn" href="/update-tos/?type=project#message-builder">Предложить проект</a>
      ${source}
    </div>
    ${grantProjectLinks(item)}
  </article>`;
}

async function renderGrants() {
  const root = document.querySelector('#grants-list');
  if (!root) return;

  try {
    const grants = await fetch('/data/grants.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []);
    const items = Array.isArray(grants) ? grants.filter(grantsPublished) : [];
    root.innerHTML = items.length ? items.map(grantCard).join('') : '<div class="empty">Возможности поддержки пока не добавлены.</div>';
  } catch (error) {
    root.innerHTML = '<div class="empty">Раздел не загрузился. Проверьте файл data/grants.json</div>';
  }
}

renderGrants();
