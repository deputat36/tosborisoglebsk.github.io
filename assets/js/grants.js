(() => {
'use strict';
const core = window.GrantsCore;
if (!core) return;
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
  const conditions = item.conditions_url ? `<a class="btn" href="${grantsEsc(item.conditions_url)}" target="_blank" rel="noopener">Условия и документы</a>` : '';
  return `<article class="list-item grant-card" data-grant-id="${grantsEsc(item.id)}" data-call-state="${core.state(item)}">
    <div class="meta">
      <span class="tag warn">${grantsEsc(item.category || 'Возможность')}</span>
      <span class="tag">${grantsEsc(item.difficulty || 'Сложность уточняется')}</span>
    </div>
    <h3>${grantsEsc(item.title || 'Возможность поддержки')}</h3>
    <p>${grantsEsc(item.best_for || item.directions || '')}</p>
    <div class="grid" style="margin:14px 0">
      <article class="card"><div class="card-inner"><span class="tag">Статус</span><p>${grantsEsc(core.statusLabel(item))}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Сумма / ресурс</span><p>${grantsEsc(item.amount || 'Уточняется')}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Срок</span><p>${grantsEsc(item.deadline || 'Уточняется')}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Кому подходит</span><p>${grantsEsc(item.who || 'Уточняется')}</p></div></article>
    </div>
    ${grantPrepareList(item)}
    ${item.note ? `<p class="tiny"><b>Редакционная пометка:</b> ${grantsEsc(item.note)}</p>` : ''}
    ${item.source_checked_at ? `<p class="tiny">Объявление сверено: <time datetime="${grantsEsc(item.source_checked_at)}">${grantsEsc(item.source_checked_at)}</time>. Перед подачей проверьте изменения у организатора.</p>` : ''}
    <div class="card-actions">
      <a class="btn primary" href="/projects/">Подобрать проект</a>
      <a class="btn" href="/documents/">Шаблоны</a>
      <a class="btn" href="/update-tos/?type=project#message-builder">Предложить проект</a>
      ${source}
      ${conditions}
    </div>
    ${grantProjectLinks(item)}
  </article>`;
}

async function renderGrants() {
  const root = document.querySelector('#grants-list');
  if (!root) return;

  try {
    const response = await fetch('/data/grants.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('opportunities unavailable');
    const grants = await response.json();
    if (!Array.isArray(grants)) throw new Error('invalid opportunities');
    const items = Array.isArray(grants) ? grants.filter(grantsPublished) : [];
    const render = () => {
      root.innerHTML = items.length ? items.map(grantCard).join('') : '<div class="empty">Возможности поддержки пока не добавлены.</div>';
      const currentRoot = document.querySelector('#current-grants');
      if (currentRoot) {
        const current = core.current(items);
        currentRoot.innerHTML = current.length ? current.map(grantCard).join('') : '<div class="notice">Ближайших сроков с недавно проверенными объявлениями нет. Ниже доступны направления поддержки и ссылки для подготовки.</div>';
      }
    };
    render();
    // Keep a tab left open over a deadline from advertising an expired call.
    setInterval(render, 60000);
  } catch (error) {
    root.innerHTML = '<div class="empty">Не удалось обновить список. Откройте объявления организаторов выше или попробуйте обновить страницу позже.</div>';
  }
}

renderGrants();
})();
