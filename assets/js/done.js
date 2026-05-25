const doneEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const donePublished = (item) => item.status !== 'draft';

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

function doneCard(item, toses) {
  const tosName = doneTosName(item.tos_slug, toses);
  return `<article class="list-item">
    <div class="meta">
      <span class="tag">${doneEsc(item.type || 'История')}</span>
      ${tosName ? `<span class="tag">${doneEsc(tosName)}</span>` : ''}
      ${item.date ? `<span class="tag">${doneEsc(item.date)}</span>` : ''}
    </div>
    <h3>${doneEsc(item.title || 'История ТОС')}</h3>
    <p>${doneEsc(item.summary || '')}</p>
    <div class="grid">
      <article class="card"><div class="card-inner"><span class="tag">Было</span><p>${doneEsc(item.before || 'Информация уточняется.')}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Сделали</span><p>${doneEsc(item.done || 'Информация уточняется.')}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Результат</span><p>${doneEsc(item.result || 'Информация уточняется.')}</p></div></article>
    </div>
    ${item.participants ? `<p class="tiny"><b>Участники:</b> ${doneEsc(item.participants)}</p>` : ''}
    ${item.needs_details ? `<div class="notice"><b style="color:var(--text)">Что нужно уточнить для полной истории</b><br>${doneEsc(item.needs_details)}</div>` : ''}
    <div class="card-actions">
      ${item.source_url ? `<a class="btn" href="${doneEsc(item.source_url)}">${doneEsc(item.source_label || 'Источник')}</a>` : ''}
      ${item.tos_slug ? `<a class="btn" href="/tos/${doneEsc(item.tos_slug)}/">Карточка ТОС</a>` : ''}
      <a class="btn primary" href="/contacts/">Прислать фото или детали</a>
    </div>
  </article>`;
}

async function renderDone() {
  const root = document.querySelector('#done-list');
  if (!root) return;
  const search = document.querySelector('#done-search');
  const type = document.querySelector('#done-type-filter');
  const tos = document.querySelector('#done-tos-filter');

  try {
    const { done, toses } = await loadDoneData();
    const types = [...new Set(done.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const usedTos = [...new Set(done.map((item) => item.tos_slug).filter(Boolean))];

    if (type) type.innerHTML = '<option value="">Все типы историй</option>' + types.map((value) => `<option>${doneEsc(value)}</option>`).join('');
    if (tos) tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map((slug) => `<option value="${doneEsc(slug)}">${doneEsc(doneTosName(slug, toses))}</option>`).join('');

    function apply() {
      const query = (search?.value || '').toLowerCase().trim().replace(/ё/g, 'е');
      const selectedType = type?.value || '';
      const selectedTos = tos?.value || '';
      const filtered = done
        .filter((item) => !selectedType || item.type === selectedType)
        .filter((item) => !selectedTos || item.tos_slug === selectedTos)
        .filter((item) => {
          const tosName = doneTosName(item.tos_slug, toses);
          const hay = [item.title, item.summary, item.before, item.done, item.result, item.participants, item.type, tosName].join(' ').toLowerCase().replace(/ё/g, 'е');
          return !query || hay.includes(query);
        });
      root.innerHTML = filtered.length ? filtered.map((item) => doneCard(item, toses)).join('') : '<div class="empty">Истории не найдены.</div>';
    }

    [search, type, tos].forEach((element) => element?.addEventListener('input', apply));
    apply();
  } catch (error) {
    root.innerHTML = '<div class="empty">Раздел не загрузился. Проверьте data/done.json</div>';
  }
}

renderDone();
