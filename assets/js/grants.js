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
    if (item.season) facts.push(['Сезон', item.season, 'season']);
    if (item.operator) facts.push(['Организатор', item.operator, 'operator']);
  }
  return `<dl class="grant-facts">${facts.map(([label, value, kind]) =>
    `<div class="grant-fact grant-fact--${kind}"><dt>${grantsEsc(label)}</dt><dd>${grantsEsc(value)}</dd></div>`
  ).join('')}</dl>`;
}

function grantSources(item) {
  const documents=(item.source_documents||[]).filter(doc=>core.safeUrl(doc.url));
  const history=(item.source_history||[]).filter(change=>core.safeUrl(change.url));
  return `${documents.length?`<h4>Документы этого сезона</h4><ul>${documents.map(doc=>`<li><a href="${grantsEsc(core.safeUrl(doc.url))}" target="_blank" rel="noopener noreferrer">${grantsEsc(doc.title)}</a>${doc.locator?` · ${grantsEsc(doc.locator)}`:''}${doc.note?`<p class="tiny">${grantsEsc(doc.note)}</p>`:''}</li>`).join('')}</ul>`:''}${history.length?`<h4>Изменения условий</h4><ul>${history.map(change=>`<li><b>${grantsEsc(change.checked_at)} · ${grantsEsc(change.title)}</b><p>${grantsEsc(change.text)}</p><a href="${grantsEsc(core.safeUrl(change.url))}" target="_blank" rel="noopener noreferrer">Основание изменения</a></li>`).join('')}</ul>`:''}`;
}

function grantFilters() {
  const options=(rows)=>Object.entries(rows).map(([id,label])=>`<option value="${grantsEsc(id)}">${grantsEsc(label)}</option>`).join('');
  return `<label for="grant-view">Стадия</label><select class="input" id="grant-view"><option value="">Все возможности</option><option value="current">Ближайшие приёмы</option><option value="archive">Завершённые приёмы</option><option value="support">Организации и направления поддержки</option><option value="prepare">Подготовка заявки</option></select><label for="grant-applicant">Кто подаёт</label><select class="input" id="grant-applicant"><option value="">Любой заявитель</option>${options(core.APPLICANTS)}</select><label for="grant-theme">Задача проекта</label><select class="input" id="grant-theme"><option value="">Все темы</option>${options(core.THEMES)}</select><label for="grant-type">Что нужно</label><select class="input" id="grant-type"><option value="">Любой вид поддержки</option>${options(core.TYPES)}</select><label for="grant-geography">Территория</label><select class="input" id="grant-geography"><option value="">Любая территория</option><option value="bgo">Борисоглебский округ</option><option value="voronezh">Воронежская область</option></select><label for="grant-search">Поиск</label><input class="input" id="grant-search" type="search" maxlength="150" placeholder="Название, организатор или задача"/><button class="btn" type="button" id="grant-reset">Сбросить фильтры</button><p id="grant-filter-status" role="status" aria-live="polite"></p><p class="tiny">Подбор показывает возможные маршруты. Если положение не проверено, допуск нужно уточнить у организатора.</p>`;
}

function grantCard(item) {
  const source = core.safeUrl(item.source) ? `<a class="btn" href="${grantsEsc(core.safeUrl(item.source))}" target="_blank" rel="noopener">Источник</a>` : '';
  const conditions = core.safeUrl(item.conditions_url) ? `<a class="btn" href="${grantsEsc(core.safeUrl(item.conditions_url))}" target="_blank" rel="noopener">Условия и документы</a>` : '';
  const check = item.opportunity_type==='grant'||item.opportunity_type==='award' ? `<a class="btn primary" href="/grant-application-kit/?opportunity=${encodeURIComponent(item.id)}#contest-check">Проверить подготовку${core.group(item)==='archive'?' по этому сезону':''}</a>` : '';
  return `<article class="list-item grant-card" id="grant-${grantsEsc(item.id)}" data-grant-group="${core.group(item)}" data-grant-id="${grantsEsc(item.id)}" data-call-state="${core.state(item)}">
    <div class="meta">
      <span class="tag warn">${grantsEsc(item.category || 'Возможность')}</span>
      <span class="tag">${grantsEsc(item.difficulty || 'Сложность уточняется')}</span>
      ${core.TYPES[item.opportunity_type]?`<span class="tag">${grantsEsc(core.TYPES[item.opportunity_type])}</span>`:''}
    </div>
    <h3>${grantsEsc(item.title || 'Возможность поддержки')}</h3>
    <p>${grantsEsc(item.best_for || item.directions || '')}</p>
    ${grantFacts(item, true)}
    ${item.eligibility?.note?`<p class="tiny" data-eligibility-note>${grantsEsc(item.eligibility.note)}</p>`:''}
    ${check?`<div class="card-actions">${check}</div>`:''}
    <details class="grant-details"><summary>Подготовка, документы и источники</summary>${grantPrepareList(item)}
    ${item.note ? `<p class="tiny"><b>Редакционная пометка:</b> ${grantsEsc(item.note)}</p>` : ''}
    ${item.source_checked_at ? `<p class="tiny">Объявление сверено: <time datetime="${grantsEsc(item.source_checked_at)}">${grantsEsc(item.source_checked_at)}</time>. Перед подачей проверьте изменения у организатора.</p>` : ''}
    <div class="card-actions">
      <a class="btn" href="/projects/">Подобрать проект</a>
      <a class="btn" href="/documents/">Шаблоны</a>
      <a class="btn" href="/update-tos/?type=project#message-builder">Предложить проект</a>
      ${source}
      ${conditions}
      ${grantOrganizationLink(item)}
      ${grantGuideLink(item)}
    </div>
    ${grantSources(item)}${grantProjectLinks(item)}</details>
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
    const fields={view,applicant:document.querySelector('#grant-applicant'),theme:document.querySelector('#grant-theme'),type:document.querySelector('#grant-type'),geography:document.querySelector('#grant-geography'),q:document.querySelector('#grant-search')};
    function readUrl(){const params=new URLSearchParams(location.search);for(const [key,node] of Object.entries(fields)){if(!node)continue;const value=params.get(key)||'';node.value=node.tagName==='SELECT'?(Array.from(node.options).some(option=>option.value===value)?value:''):value.slice(0,150);}}
    readUrl();
    if(controls)controls.hidden=false;
    let previousStates = null;
    const render = () => {
      const filters=Object.fromEntries(Object.entries(fields).map(([key,node])=>[key,node?.value||'']));
      const states = JSON.stringify(filters)+'|'+items.map(item => core.group(item)).join('|');
      if (states === previousStates) return;
      previousStates = states;
      const shown=items.filter(item=>core.matches(item,filters));
      const unknown=filters.applicant?shown.filter(item=>core.eligibility(item,filters.applicant)==='unknown').length:0;
      if(status)status.textContent=`Показано ${shown.length} из ${items.length}.${unknown?` Неуточнённый допуск: ${unknown}.`:''}`;
      root.innerHTML = shown.length ? shown.map(grantCard).join('') : '<div class="empty">По выбранным условиям ничего не найдено. Сбросьте часть фильтров или проверьте партнёрский маршрут с подходящей организацией.</div>';
      const currentRoot = document.querySelector('#current-grants');
      if (currentRoot) {
        const current = core.current(items);
        currentRoot.innerHTML = current.length ? current.map(grantSummary).join('') : '<div class="notice">Ближайших сроков с недавно проверенными объявлениями нет. Ниже доступны направления поддержки и ссылки для подготовки.</div>';
      }
    };
    function sync(){const url=new URL(location.href);for(const [key,node] of Object.entries(fields)){const value=node?.value.trim()||'';if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}if(url.hash.startsWith('#grant-'))url.hash='';history.replaceState(null,'',url);render();}
    for(const node of Object.values(fields)){node?.addEventListener(node.tagName==='SELECT'?'change':'input',sync);}
    document.querySelector('#grant-reset')?.addEventListener('click',()=>{Object.values(fields).forEach(node=>{if(node)node.value='';});sync();});
    function revealHash(){if(location.hash.startsWith('#grant-')&&items.some(item=>'#grant-'+item.id===location.hash)){Object.values(fields).forEach(node=>{if(node)node.value='';});render();document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start'});}}
    render();revealHash();window.addEventListener('hashchange',revealHash);window.addEventListener('popstate',()=>{readUrl();render();revealHash();});
    // Keep a tab left open over a deadline from advertising an expired call.
    setInterval(render, 60000);
  } catch (error) {
    const message = '<div class="notice">Не удалось обновить список. Ниже сохранена датированная подборка. Перед подачей проверьте сроки и изменения у организатора.</div>';
    if (root.querySelector('[data-grant-id]')) root.insertAdjacentHTML('afterbegin', message);
    else root.innerHTML = message;
  }
}

if (isNode) {
  module.exports = { grantCard, grantSummary, grantOrganizationLink, grantsPublished, grantSources, grantFilters };
  return;
}
renderGrants();
})();
