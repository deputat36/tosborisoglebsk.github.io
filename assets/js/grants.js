(() => {
'use strict';
const isNode = typeof module === 'object' && Boolean(module.exports);
const core = isNode ? require('./grants-core') : window.GrantsCore;
if (!core) return;
const grantsEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const grantsPublished = (item) => item && item.status !== 'draft';

function grantOrganizationLink(item) {
  const href = String(item.organization_url || '');
  return /^\/grants\/[a-z0-9-]+\/$/.test(href)
    ? `<a class="btn" href="${grantsEsc(href)}">Об организации и программах</a>` : '';
}

function grantGuideLink(item) {
  const href = String(item.guide_url || '');
  return /^\/materials\/[a-z0-9-]+\/$/.test(href)
    ? `<a class="btn" href="${grantsEsc(href)}">Как подготовить заявку</a>` : '';
}

function grantProjectLinks(item) {
  const links = Array.isArray(item.project_links) ? item.project_links.filter(Boolean).slice(0, 6) : [];
  if (!links.length) return '';

  return `<div class="card-actions">${links.map((slug) => `<a class="btn" href="/projects/${grantsEsc(slug)}/">${grantsEsc(item.project_labels?.[slug] || 'Пример проекта ТОС')}</a>`).join('')}</div>`;
}

function grantPrepareList(item) {
  const steps = Array.isArray(item.prepare) ? item.prepare.filter(Boolean).slice(0, 5) : [];
  if (!steps.length) return '';

  return `<div class="notice"><b>Что подготовить</b><br>${steps.map((step) => `- ${grantsEsc(step)}`).join('<br>')}</div>`;
}

function grantFacts(item, includeDetails = false) {
  const facts = [
    ['Срок', item.deadline || 'Уточняется', 'deadline'],
    ['Сумма / ресурс', item.amount || 'Уточняется', 'amount']
  ];
  if (includeDetails) {
    facts.push(['Статус', core.statusLabel(item), 'status']);
    facts.push(['Кому подходит', item.who || 'Уточняется', 'audience']);
  }
  return `<dl class="grant-facts">${facts.map(([label, value, kind]) =>
    `<div class="grant-fact grant-fact--${kind}"><dt>${grantsEsc(label)}</dt><dd>${grantsEsc(value)}</dd></div>`
  ).join('')}</dl>`;
}

function grantCard(item) {
  const source = item.source ? `<a class="btn" href="${grantsEsc(item.source)}" target="_blank" rel="noopener">Источник</a>` : '';
  const conditions = item.conditions_url ? `<a class="btn" href="${grantsEsc(item.conditions_url)}" target="_blank" rel="noopener">Условия и документы</a>` : '';
  return `<article class="list-item grant-card" id="grant-${grantsEsc(item.id)}" data-grant-group="${core.group(item)}" data-grant-id="${grantsEsc(item.id)}" data-call-state="${core.state(item)}">
    <div class="meta">
      <span class="tag warn">${grantsEsc(item.category || 'Возможность')}</span>
      <span class="tag">${grantsEsc(item.difficulty || 'Сложность уточняется')}</span>
    </div>
    <h3>${grantsEsc(item.title || 'Возможность поддержки')}</h3>
    <p>${grantsEsc(item.best_for || item.directions || '')}</p>
    ${grantFacts(item, true)}
    <details class="grant-details"><summary>Подготовка, документы и источники</summary>${grantPrepareList(item)}
    ${item.note ? `<p class="tiny"><b>Редакционная пометка:</b> ${grantsEsc(item.note)}</p>` : ''}
    ${item.source_checked_at ? `<p class="tiny">Объявление сверено: <time datetime="${grantsEsc(item.source_checked_at)}">${grantsEsc(item.source_checked_at)}</time>. Перед подачей проверьте изменения у организатора.</p>` : ''}
    <div class="card-actions">
      <a class="btn primary" href="/projects/">Подобрать проект</a>
      <a class="btn" href="/documents/">Шаблоны</a>
      <a class="btn" href="/update-tos/?type=project#message-builder">Предложить проект</a>
      ${source}
      ${conditions}
      ${grantOrganizationLink(item)}
      ${grantGuideLink(item)}
    </div>
    ${grantProjectLinks(item)}</details>
  </article>`;
}

function grantSummary(item) {
  return `<article class="list-item" data-grant-id="${grantsEsc(item.id)}" data-call-state="${core.state(item)}">
    <h3>${grantsEsc(item.title)}</h3>
    ${grantFacts(item)}
    <p><b>Кому подходит:</b> ${grantsEsc(item.who)}</p>
    <p class="tiny">${grantsEsc(item.note)}</p>${item.source_checked_at ? `<p class="tiny">Объявление сверено: <time datetime="${grantsEsc(item.source_checked_at)}">${grantsEsc(item.source_checked_at)}</time></p>` : ''}
    <div class="card-actions"><a class="btn primary" href="${grantsEsc(item.source)}" target="_blank" rel="noopener">Открыть объявление</a><a class="btn" href="#grant-${grantsEsc(item.id)}">Что подготовить</a>${grantOrganizationLink(item)}${grantGuideLink(item)}</div>
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
    const controls=document.querySelector('[data-grant-filters]');
    const view=document.querySelector('#grant-view');
    const status=document.querySelector('#grant-filter-status');
    const groups=new Set(['current','archive','support','prepare']);
    const params=new URLSearchParams(location.search);
    if(view&&groups.has(params.get('view')))view.value=params.get('view');
    if(controls)controls.hidden=false;
    let previousStates = null;
    const render = () => {
      const selected=view?.value||'';
      const states = selected+'|'+items.map(item => core.group(item)).join('|');
      if (states === previousStates) return;
      previousStates = states;
      const shown=selected?items.filter(item=>core.group(item)===selected):items;
      if(status)status.textContent=`Показано ${shown.length} из ${items.length}.`;
      root.innerHTML = shown.length ? shown.map(grantCard).join('') : `<div class="empty">${selected?'По выбранному фильтру ничего не найдено. Выберите «Все возможности».':'Возможности поддержки пока не добавлены.'}</div>`;
      const currentRoot = document.querySelector('#current-grants');
      if (currentRoot) {
        const current = core.current(items);
        currentRoot.innerHTML = current.length ? current.map(grantSummary).join('') : '<div class="notice">Ближайших сроков с недавно проверенными объявлениями нет. Ниже доступны направления поддержки и ссылки для подготовки.</div>';
      }
    };
    view?.addEventListener('change',()=>{const url=new URL(location.href);if(view.value)url.searchParams.set('view',view.value);else url.searchParams.delete('view');if(url.hash.startsWith('#grant-'))url.hash='';history.replaceState(null,'',url);render();});
    function revealHash(){if(location.hash.startsWith('#grant-')&&view){view.value='';render();document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start'});}}
    render();revealHash();window.addEventListener('hashchange',revealHash);
    // Keep a tab left open over a deadline from advertising an expired call.
    setInterval(render, 60000);
  } catch (error) {
    const message = '<div class="notice">Не удалось обновить список. Ниже сохранена датированная подборка. Перед подачей проверьте сроки и изменения у организатора.</div>';
    if (root.querySelector('[data-grant-id]')) root.insertAdjacentHTML('afterbegin', message);
    else root.innerHTML = message;
  }
}

if (isNode) {
  module.exports = { grantCard, grantSummary, grantOrganizationLink, grantsPublished };
  return;
}
renderGrants();
})();
