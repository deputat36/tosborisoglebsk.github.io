const needsEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const needsFmtDate = (value) => {
  if (!value) return 'Дата уточняется';
  const date = new Date(value + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const needsPublished = (item) => item.status !== 'draft';

async function loadNeedsData() {
  const [needs, toses] = await Promise.all([
    fetch('/data/needs.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []),
    fetch('/data/toses.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []).catch(() => [])
  ]);
  return { needs: needs.filter(needsPublished), toses };
}

function needsTosName(slug, toses) {
  if (!slug) return '';
  const found = toses.find((tos) => tos.slug === slug);
  return found ? `ТОС «${found.name}»` : slug;
}

function priorityClass(priority) {
  const text = String(priority || '').toLowerCase();
  if (text.includes('выс')) return 'warn';
  if (text.includes('низ')) return '';
  return '';
}

function statusLabel(status) {
  if (status === 'closed' || status === 'done') return 'Закрыто';
  if (status === 'archived') return 'Архив';
  return 'Актуально';
}

function statusClass(status) {
  if (status === 'closed' || status === 'done') return '';
  if (status === 'archived') return '';
  return 'warn';
}

function needCard(item, toses) {
  const tosName = needsTosName(item.tos_slug, toses);
  const helpText = item.how_to_help || item.help || 'Свяжитесь с ответственным и уточните, чем именно можете помочь: материалами, временем, транспортом, волонтёрами, фото или информационной поддержкой.';
  const resultText = item.result || item.closed_result || '';
  return `<article class="list-item">
    <div class="meta">
      <span class="tag ${statusClass(item.status)}">${needsEsc(statusLabel(item.status))}</span>
      <span class="tag">${needsEsc(item.need_type || 'Потребность')}</span>
      <span class="tag ${priorityClass(item.priority)}">${needsEsc(item.priority || 'Приоритет уточняется')}</span>
      <span class="tag">${needsEsc(needsFmtDate(item.date))}</span>
      ${tosName ? `<span class="tag">${needsEsc(tosName)}</span>` : ''}
    </div>
    <h3>${needsEsc(item.title || 'Потребность без названия')}</h3>
    <p>${needsEsc(item.description || '')}</p>
    <div class="notice"><b style="color:var(--text)">Как помочь</b><br>${needsEsc(helpText)}</div>
    ${resultText ? `<p class="tiny"><b>Результат:</b> ${needsEsc(resultText)}</p>` : ''}
    <p class="tiny"><b>Контакт:</b> ${needsEsc(item.contact || 'Уточняется')}</p>
    <div class="card-actions">
      ${item.tos_slug ? `<a class="btn" href="/tos/${needsEsc(item.tos_slug)}/">Открыть ТОС</a>` : ''}
      <a class="btn primary" href="/contacts/">Предложить помощь</a>
      <a class="btn" href="/update-tos/#template-need">Уточнить потребность</a>
      ${item.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${needsEsc(item.source_url)}">Источник</a>` : ''}
    </div>
  </article>`;
}

async function renderNeeds() {
  const root = document.querySelector('#needs-list');
  if (!root) return;
  const search = document.querySelector('#needs-search');
  const type = document.querySelector('#needs-type-filter');
  const tos = document.querySelector('#needs-tos-filter');
  const priority = document.querySelector('#needs-priority-filter');

  try {
    const { needs, toses } = await loadNeedsData();
    const types = [...new Set(needs.map((item) => item.need_type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const priorities = [...new Set(needs.map((item) => item.priority).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
    const usedTos = [...new Set(needs.map((item) => item.tos_slug).filter(Boolean))];

    if (type) type.innerHTML = '<option value="">Все типы помощи</option>' + types.map((value) => `<option>${needsEsc(value)}</option>`).join('');
    if (priority) priority.innerHTML = '<option value="">Любой приоритет</option>' + priorities.map((value) => `<option>${needsEsc(value)}</option>`).join('');
    if (tos) tos.innerHTML = '<option value="">Все ТОС</option>' + usedTos.map((slug) => `<option value="${needsEsc(slug)}">${needsEsc(needsTosName(slug, toses))}</option>`).join('');

    function apply() {
      const query = (search?.value || '').toLowerCase().trim().replace(/ё/g, 'е');
      const selectedType = type?.value || '';
      const selectedPriority = priority?.value || '';
      const selectedTos = tos?.value || '';
      const filtered = needs
        .filter((item) => !selectedType || item.need_type === selectedType)
        .filter((item) => !selectedPriority || item.priority === selectedPriority)
        .filter((item) => !selectedTos || item.tos_slug === selectedTos)
        .filter((item) => {
          const tosName = needsTosName(item.tos_slug, toses);
          const hay = [item.title, item.description, item.need_type, item.priority, item.contact, item.source, item.how_to_help, item.result, tosName].join(' ').toLowerCase().replace(/ё/g, 'е');
          return !query || hay.includes(query);
        })
        .sort((a, b) => {
          const statusA = a.status === 'closed' || a.status === 'done' || a.status === 'archived' ? 1 : 0;
          const statusB = b.status === 'closed' || b.status === 'done' || b.status === 'archived' ? 1 : 0;
          if (statusA !== statusB) return statusA - statusB;
          return String(b.date || '').localeCompare(String(a.date || ''));
        });
      root.innerHTML = filtered.length ? filtered.map((item) => needCard(item, toses)).join('') : '<div class="empty">Потребности не найдены.</div>';
    }

    [search, type, tos, priority].forEach((element) => element?.addEventListener('input', apply));
    apply();
  } catch (error) {
    root.innerHTML = '<div class="empty">Раздел не загрузился. Проверьте файл data/needs.json</div>';
  }
}

renderNeeds();
