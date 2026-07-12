const doneEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const donePublished = (item) => item.status !== 'draft';
const doneYear = (value) => String(value || '').slice(0, 4) || 'Год уточняется';

function doneOrigin(item) {
  if (['verified', 'editorial', 'starter', 'request'].includes(item.content_origin)) return item.content_origin;
  if (String(item.id || '').startsWith('result-archive-needed-')) return 'request';
  return 'editorial';
}

function doneOriginTag(item) {
  const origin = doneOrigin(item);
  const labels = {
    verified: 'Подтверждено источником',
    editorial: 'Редакционный материал',
    starter: 'Стартовый материал',
    request: 'Запрос истории'
  };
  const className = origin === 'verified' ? 'ok' : origin === 'request' ? 'warn' : '';
  return `<span class="tag ${className}">${doneEsc(labels[origin])}</span>`;
}

function doneReviewTag(item) {
  const origin = doneOrigin(item);
  if (origin === 'verified' && item.source_url && !item.needs_details) {
    return '<span class="tag ok">подтверждённый результат</span>';
  }
  if (origin === 'request') return '<span class="tag warn">нужны материалы</span>';
  if (origin === 'starter') return '<span class="tag">стартовая заготовка</span>';
  if (item.needs_details) return '<span class="tag warn">нужно уточнить</span>';
  return '<span class="tag">редакционная история</span>';
}

async function loadDoneData() {
  const [done, toses] = await Promise.all([
    fetch('/data/done.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []),
    fetch('/data/toses.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []).catch(() => [])
  ]);
  return { done: done.filter(donePublished), toses };
}

function doneTosName(slug, toses) {
  if (!slug) return '';
  const found = toses.find((tos) => tos.slug === slug);
  return found ? `ТОС «${found.name}»` : slug;
}

function renderDoneSummary(items) {
  const root = document.querySelector('#done-summary');
  if (!root) return;
  const verified = items.filter((item) => doneOrigin(item) === 'verified').length;
  const editorial = items.filter((item) => doneOrigin(item) === 'editorial').length;
  const requests = items.filter((item) => doneOrigin(item) === 'request').length;
  const withTos = items.filter((item) => item.tos_slug).length;
  root.innerHTML = `<div class="summary-grid"><div class="summary-tile"><b>${items.length}</b><span>записей найдено</span></div><div class="summary-tile"><b>${verified}</b><span>подтверждённые результаты</span></div><div class="summary-tile"><b>${editorial}</b><span>редакционные истории</span></div><div class="summary-tile"><b>${requests}</b><span>запросы историй</span></div><div class="summary-tile"><b>${withTos}</b><span>привязаны к ТОС</span></div></div>`;
}

function doneCard(item, toses) {
  const tosName = doneTosName(item.tos_slug, toses);
  const year = doneYear(item.date);
  const sourceLink = item.source_url
    ? `<a class="btn"${/^https?:\/\//i.test(item.source_url) ? ' target="_blank" rel="noopener"' : ''} href="${doneEsc(item.source_url)}">${doneEsc(item.source_label || 'Источник')}</a>`
    : '';
  return `<article class="list-item done-story"><div class="meta">${doneOriginTag(item)}<span class="tag">${doneEsc(item.type || 'История')}</span>${tosName ? `<span class="tag">${doneEsc(tosName)}</span>` : ''}<span class="tag">${doneEsc(year)}</span>${doneReviewTag(item)}</div><h3>${doneEsc(item.title || 'История ТОС')}</h3><p>${doneEsc(item.summary || '')}</p><div class="done-steps"><article class="card"><div class="card-inner"><span class="tag">Было</span><p>${doneEsc(item.before || 'Информация уточняется.')}</p></div></article><article class="card"><div class="card-inner"><span class="tag">Сделали</span><p>${doneEsc(item.done || 'Информация уточняется.')}</p></div></article><article class="card"><div class="card-inner"><span class="tag">Стало</span><p>${doneEsc(item.result || 'Информация уточняется.')}</p></div></article></div>${item.participants ? `<p class="tiny"><b>Кто участвовал:</b> ${doneEsc(item.participants)}</p>` : ''}${item.needs_details ? `<div class="notice"><b style="color:var(--text)">Что нужно уточнить для полной истории</b><br>${doneEsc(item.needs_details)}</div>` : ''}<div class="card-actions"><a class="btn primary" href="/done/${doneEsc(item.id)}/">Подробнее</a>${sourceLink}${item.tos_slug ? `<a class="btn" href="/tos/${doneEsc(item.tos_slug)}/">Карточка ТОС</a>` : ''}<a class="btn" href="/partners/">Партнёрам</a><a class="btn" href="/contacts/">Прислать фото или детали</a></div></article>`;
}

async function renderDone() {
  const root = document.querySelector('#done-list');
  if (!root) return;
  const search = document.querySelector('#done-search');
  const type = document.querySelector('#done-type-filter');
  const tos = document.querySelector('#done-tos-filter');
  const year = document.querySelector('#done-year-filter');
  const status = document.querySelector('#done-status-filter');

  try {
    const { done, toses } = await loadDoneData();
    const types = [...new Set(done.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const usedTos = [...new Set(done.map((item) => item.tos_slug).filter(Boolean))];
    const years = [...new Set(done.map((item) => doneYear(item.date)).filter((value) => value !== 'Год уточняется'))].sort((a, b) => b.localeCompare(a));

    if (type) type.innerHTML = '<option value="">Все типы историй</option>' + types.map((value) => `<option>${doneEsc(value)}</option>`).join('');
    if (tos) tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map((slug) => `<option value="${doneEsc(slug)}">${doneEsc(doneTosName(slug, toses))}</option>`).join('');
    if (year) year.innerHTML = '<option value="">Все годы</option>' + years.map((value) => `<option>${doneEsc(value)}</option>`).join('');

    function apply() {
      const query = (search?.value || '').toLowerCase().trim().replace(/ё/g, 'е');
      const selectedType = type?.value || '';
      const selectedTos = tos?.value || '';
      const selectedYear = year?.value || '';
      const selectedStatus = status?.value || '';
      const filtered = done
        .filter((item) => !selectedType || item.type === selectedType)
        .filter((item) => !selectedTos || item.tos_slug === selectedTos)
        .filter((item) => !selectedYear || doneYear(item.date) === selectedYear)
        .filter((item) => selectedStatus !== 'needs-details' || Boolean(item.needs_details))
        .filter((item) => selectedStatus !== 'has-participants' || Boolean(item.participants))
        .filter((item) => selectedStatus !== 'has-source' || Boolean(item.source_url))
        .filter((item) => {
          const tosName = doneTosName(item.tos_slug, toses);
          const hay = [item.title, item.summary, item.before, item.done, item.result, item.participants, item.needs_details, item.type, tosName, doneOrigin(item)].join(' ').toLowerCase().replace(/ё/g, 'е');
          return !query || hay.includes(query);
        })
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      root.innerHTML = filtered.length ? filtered.map((item) => doneCard(item, toses)).join('') : '<div class="empty">Истории не найдены.</div>';
      renderDoneSummary(filtered);
    }

    [search, type, tos, year, status].forEach((element) => element?.addEventListener('input', apply));
    apply();
  } catch (error) {
    root.innerHTML = '<div class="empty">Раздел не загрузился. Проверьте data/done.json</div>';
  }
}

renderDone();
