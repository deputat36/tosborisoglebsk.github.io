const auditEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

const WORKFLOW_KEY = 'tos-audit-workflow-v1';
const workflowLabels = {
  new: 'Не запрошено',
  requested: 'Запрос отправлен',
  received: 'Данные получены',
  updated: 'Карточка обновлена'
};
const verificationLabels = {
  verified: 'Данные проверены',
  partial: 'Проверено частично',
  needs_review: 'Требует проверки',
  unknown: 'Данные уточняются',
  stale: 'Проверка устарела'
};

let auditItems = [];
let auditSummary = {};

async function loadAudit() {
  const response = await fetch('/data/tos_content_audit.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('audit not found');
  return response.json();
}

function updateUrl(item, type = 'card') {
  return `/update-tos/?tos=${encodeURIComponent(item.slug)}&type=${encodeURIComponent(type)}`;
}

function loadWorkflow() {
  try { return JSON.parse(localStorage.getItem(WORKFLOW_KEY) || '{}'); }
  catch { return {}; }
}

function saveWorkflow(map) {
  localStorage.setItem(WORKFLOW_KEY, JSON.stringify(map));
}

function workflowFor(slug) {
  return loadWorkflow()[slug] || 'new';
}

function setWorkflow(slug, value) {
  const map = loadWorkflow();
  map[slug] = value;
  saveWorkflow(map);
}

function normalizeVerification(item) {
  if (item.verification && item.verification.status) return item.verification;
  const date = item.updated_at || '';
  const ageDays = date ? Math.floor((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86400000) : null;
  let status = 'unknown';
  if (date && Number(item.score || 0) >= 80) status = 'partial';
  else if (date) status = 'needs_review';
  if (ageDays !== null && ageDays > 180) status = 'stale';
  return {
    status,
    label: verificationLabels[status],
    date,
    stale: status === 'stale',
    source: '',
    note: status === 'stale' ? 'С момента обновления прошло более 180 дней.' : ''
  };
}

function statTile(value, label) {
  return `<article class="stat"><b>${auditEsc(value)}</b><span>${auditEsc(label)}</span></article>`;
}

function renderSummary(summary) {
  const root = document.querySelector('#audit-summary');
  if (!root) return;
  root.innerHTML = [
    statTile(summary.total_tos || 0, 'ТОСов в реестре'),
    statTile(`${summary.average_score || 0}%`, 'средняя заполненность'),
    statTile(summary.high_priority || 0, 'высокий приоритет'),
    statTile(summary.verified_count || 0, 'данные проверены'),
    statTile(summary.partial_count || 0, 'проверено частично'),
    statTile(summary.needs_review_count || 0, 'требует проверки'),
    statTile(summary.stale_count || 0, 'проверка устарела'),
    statTile(summary.without_phone || 0, 'без телефона')
  ].join('');
}

function priorityClass(priority) {
  if (priority === 'Высокий') return 'warn';
  if (priority === 'Низкий') return 'ok';
  return '';
}

function verificationBadge(item) {
  const verification = normalizeVerification(item);
  const label = verification.label || verificationLabels[verification.status] || verificationLabels.unknown;
  return `<span class="verification-badge" data-status="${auditEsc(verification.status)}">${auditEsc(label)}</span>`;
}

function missingChecklist(item) {
  const missing = item.missing || [];
  const lines = [];
  if (missing.includes('телефон') || missing.includes('нет телефона')) lines.push('телефон для связи с председателем или ответственным представителем');
  if (missing.includes('email') || missing.includes('нет email')) lines.push('рабочий email, если его можно публиковать');
  if (missing.includes('соцсети') || missing.includes('нет соцсетей')) lines.push('ссылку на группу, страницу или чат ТОС');
  if (missing.includes('логотип') || missing.includes('нет логотипа')) lines.push('логотип ТОС в PNG, JPG или SVG');
  if (missing.includes('описание') || missing.includes('слабое или пустое описание')) lines.push('2–4 предложения о территории, задачах и активности ТОС');
  if (!lines.length) lines.push('подтверждение, что председатель, контакты, границы и описание указаны верно');
  return [...new Set(lines)];
}

function requestText(item) {
  const checklist = missingChecklist(item).map((value) => `— ${value}`).join('\n');
  const requested = (item.recommendations || []).map((value) => `— ${value}`).join('\n');
  return `Здравствуйте! Обновляем карточку ТОС «${item.name || item.slug}» на портале tosborisoglebsk.ru.\n\nПожалуйста, проверьте данные карточки и пришлите недостающую информацию.\n\nКарточка ТОС:\nhttps://tosborisoglebsk.ru/tos/${item.slug}/\n\nЧто сейчас нужно уточнить:\n${checklist}\n${requested ? `\nДополнительно по аудиту:\n${requested}\n` : ''}\nМожно прислать прямо ответным сообщением:\n1. председатель;\n2. телефон для публикации;\n3. email для публикации;\n4. ссылка на группу или страницу ТОС;\n5. границы ТОС;\n6. краткое описание;\n7. реализованные проекты;\n8. логотип и 3–5 фотографий.\n\nФорма обновления:\nhttps://tosborisoglebsk.ru${updateUrl(item, 'card')}\n\nПожалуйста, присылайте только те персональные данные, которые можно размещать открыто.`;
}

function logoPhotoText(item) {
  return `Здравствуйте! Для карточки ТОС «${item.name || item.slug}» на сайте tosborisoglebsk.ru хотим добавить визуальные материалы.\n\nНужно, если есть:\n1. логотип ТОС в PNG, JPG или SVG;\n2. 3–5 хороших фотографий территории, мероприятий, проектов или результата работы;\n3. короткая подпись к фото: где снято, что происходит, какой год.\n\nКарточка ТОС:\nhttps://tosborisoglebsk.ru/tos/${item.slug}/\n\nЛучше присылать оригинальные файлы, не скриншоты. Фото с детьми крупным планом лучше не отправлять без согласия родителей.`;
}

function shortRequestText(item) {
  return `Здравствуйте! Проверьте, пожалуйста, карточку ТОС «${item.name || item.slug}»: https://tosborisoglebsk.ru/tos/${item.slug}/\n\nЕсли что-то нужно исправить, пришлите ответом актуальные данные: председатель, телефон, email, группа/страница, границы, описание, проекты, логотип и фото.\n\nФорма: https://tosborisoglebsk.ru${updateUrl(item, 'card')}`;
}

function workflowSelect(item) {
  const current = workflowFor(item.slug);
  const options = Object.entries(workflowLabels).map(([value, label]) => `<option value="${value}"${value === current ? ' selected' : ''}>${label}</option>`).join('');
  return `<label class="audit-field"><span>Ход работы</span><select class="input audit-workflow-select" data-slug="${auditEsc(item.slug)}">${options}</select></label>`;
}

function renderItem(item) {
  const verification = normalizeVerification(item);
  const missing = (item.missing || []).slice(0, 10).map((value) => `<span class="tag warn">${auditEsc(value)}</span>`).join('');
  const recommendations = (item.recommendations || []).map((value) => `<li>${auditEsc(value)}</li>`).join('');
  const related = item.linked || {};
  const verificationDetails = [
    verification.date ? `Дата: ${verification.date}` : '',
    verification.source ? `Источник: ${verification.source}` : '',
    verification.note || ''
  ].filter(Boolean).join(' · ');

  return `<article class="list-item audit-card" data-priority="${auditEsc(item.priority)}" data-slug="${auditEsc(item.slug)}">
    <div class="audit-card-top"><div><div class="meta"><span class="tag ${priorityClass(item.priority)}">${auditEsc(item.priority)} приоритет</span><span class="tag">Заполнено ${auditEsc(item.score)}%</span><span class="tag">${auditEsc(item.type || 'Тип уточняется')}</span><span class="tag">${auditEsc(item.location || 'Территория уточняется')}</span></div><h3>ТОС «${auditEsc(item.name || item.slug)}»</h3><p class="tiny"><b>Председатель:</b> ${auditEsc(item.chairperson || 'уточняется')} · <b>Обновлено:</b> ${auditEsc(item.updated_at || 'дата уточняется')}</p></div><div>${verificationBadge(item)}</div></div>
    ${verificationDetails ? `<p class="tiny">${auditEsc(verificationDetails)}</p>` : ''}
    <div class="audit-card-main">
      <section class="audit-card-section"><h4>Что отсутствует или требует уточнения</h4><div class="audit-missing">${missing || '<span class="tag ok">Основные поля заполнены</span>'}</div>${recommendations ? `<p class="tiny"><b>Что запросить:</b></p><ul class="tiny">${recommendations}</ul>` : ''}</section>
      <section class="audit-card-section"><h4>Связанные материалы</h4><div class="audit-related"><span><b>${auditEsc(related.news || 0)}</b>Новости</span><span><b>${auditEsc(related.done || 0)}</b>Сделано</span><span><b>${auditEsc(related.needs || 0)}</b>Потребности</span><span><b>${auditEsc(related.projects || 0)}</b>Проекты</span><span><b>${auditEsc(related.events || 0)}</b>События</span></div></section>
    </div>
    <div class="audit-workflow">${workflowSelect(item)}<div class="audit-workflow-note">Рабочий статус сохраняется только на текущем устройстве.</div></div>
    <div class="card-actions"><a class="btn primary" href="/tos/${auditEsc(item.slug)}/">Карточка ТОС</a><a class="btn" href="${auditEsc(updateUrl(item, 'card'))}">Уточнить данные</a><a class="btn" href="${auditEsc(updateUrl(item, 'news'))}">Новость</a><a class="btn" href="${auditEsc(updateUrl(item, 'project'))}">Проект</a><button class="btn audit-copy-request" type="button" data-kind="full" data-slug="${auditEsc(item.slug)}">Полный запрос</button><button class="btn audit-copy-request" type="button" data-kind="short" data-slug="${auditEsc(item.slug)}">Коротко</button><button class="btn audit-copy-request" type="button" data-kind="media" data-slug="${auditEsc(item.slug)}">Логотип/фото</button></div>
    <div class="audit-copy-status" data-copy-status="${auditEsc(item.slug)}"></div>
  </article>`;
}

function fillSelect(id, values) {
  const select = document.querySelector(id);
  if (!select) return;
  values.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), 'ru')).forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function currentFilters() {
  const value = (id) => document.querySelector(id)?.value || '';
  return {
    search: value('#audit-search').trim().toLowerCase().replace(/ё/g, 'е'),
    priority: value('#audit-priority'),
    verification: value('#audit-verification'),
    missing: value('#audit-missing'),
    type: value('#audit-type'),
    workflow: value('#audit-workflow'),
    sort: value('#audit-sort') || 'priority'
  };
}

function filterItems(items, filters) {
  return items.filter((item) => {
    const verification = normalizeVerification(item);
    const haystack = [item.name, item.slug, item.location, item.chairperson, item.type, ...(item.missing || [])].join(' ').toLowerCase().replace(/ё/g, 'е');
    if (filters.search && !haystack.includes(filters.search)) return false;
    if (filters.priority && item.priority !== filters.priority) return false;
    if (filters.verification && verification.status !== filters.verification) return false;
    if (filters.missing && !(item.missing || []).includes(filters.missing)) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.workflow && workflowFor(item.slug) !== filters.workflow) return false;
    return true;
  });
}

function sortItems(items, sort) {
  const priorityRank = { 'Высокий': 0, 'Средний': 1, 'Низкий': 2 };
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === 'score-asc') return Number(a.score) - Number(b.score) || String(a.name).localeCompare(String(b.name), 'ru');
    if (sort === 'score-desc') return Number(b.score) - Number(a.score) || String(a.name).localeCompare(String(b.name), 'ru');
    if (sort === 'updated-desc') return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    if (sort === 'updated-asc') return String(a.updated_at || '').localeCompare(String(b.updated_at || ''));
    if (sort === 'name') return String(a.name).localeCompare(String(b.name), 'ru');
    return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) || Number(a.score) - Number(b.score) || String(a.name).localeCompare(String(b.name), 'ru');
  });
  return copy;
}

function renderRegistry() {
  const list = document.querySelector('#audit-list');
  if (!list) return;
  const filtered = sortItems(filterItems(auditItems, currentFilters()), currentFilters().sort);
  list.innerHTML = filtered.length ? filtered.map(renderItem).join('') : '<div class="audit-empty">По выбранным фильтрам карточек нет.</div>';
  const count = document.querySelector('#audit-result-count');
  if (count) count.textContent = `${filtered.length} из ${auditItems.length} карточек`;
}

function csvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function exportCsv() {
  const filtered = sortItems(filterItems(auditItems, currentFilters()), currentFilters().sort);
  const header = ['ТОС', 'Населённый пункт', 'Председатель', 'Приоритет', 'Заполненность', 'Проверка', 'Дата проверки', 'Рабочий статус', 'Не хватает', 'Новости', 'Сделано', 'Потребности', 'Проекты'];
  const rows = filtered.map((item) => {
    const verification = normalizeVerification(item);
    return [item.name, item.location, item.chairperson, item.priority, item.score, verificationLabels[verification.status] || verification.status, verification.date, workflowLabels[workflowFor(item.slug)], (item.missing || []).join('; '), item.linked?.news || 0, item.linked?.done || 0, item.linked?.needs || 0, item.linked?.projects || 0].map(csvCell).join(';');
  });
  const blob = new Blob(['\ufeff', [header.map(csvCell).join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `tos-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

function bindControls() {
  document.querySelectorAll('#audit-search,#audit-priority,#audit-verification,#audit-missing,#audit-type,#audit-workflow,#audit-sort').forEach((control) => {
    control.addEventListener(control.id === 'audit-search' ? 'input' : 'change', renderRegistry);
  });
  document.querySelector('#audit-reset')?.addEventListener('click', () => {
    document.querySelectorAll('#audit-search,#audit-priority,#audit-verification,#audit-missing,#audit-type,#audit-workflow').forEach((control) => { control.value = ''; });
    document.querySelector('#audit-sort').value = 'priority';
    renderRegistry();
  });
  document.querySelector('#audit-export')?.addEventListener('click', exportCsv);

  document.querySelector('#audit-list')?.addEventListener('change', (event) => {
    const select = event.target.closest('.audit-workflow-select');
    if (!select) return;
    setWorkflow(select.dataset.slug, select.value);
    if (currentFilters().workflow) renderRegistry();
  });

  document.querySelector('#audit-list')?.addEventListener('click', async (event) => {
    const button = event.target.closest('.audit-copy-request');
    if (!button) return;
    const item = auditItems.find((entry) => entry.slug === button.dataset.slug);
    if (!item) return;
    const status = document.querySelector(`[data-copy-status="${CSS.escape(item.slug)}"]`);
    const kind = button.dataset.kind || 'full';
    const text = kind === 'media' ? logoPhotoText(item) : kind === 'short' ? shortRequestText(item) : requestText(item);
    try {
      await copyText(text);
      if (status) status.textContent = kind === 'media' ? 'Запрос логотипа и фото скопирован.' : kind === 'short' ? 'Короткий запрос скопирован.' : 'Полный запрос скопирован.';
    } catch {
      if (status) status.textContent = 'Не удалось скопировать. Откройте карточку и подготовьте запрос вручную.';
    }
  });
}

async function initAudit() {
  const list = document.querySelector('#audit-list');
  try {
    const data = await loadAudit();
    auditItems = data.items || [];
    auditSummary = data.summary || {};
    renderSummary(auditSummary);
    fillSelect('#audit-missing', [...new Set(auditItems.flatMap((item) => item.missing || []))]);
    fillSelect('#audit-type', [...new Set(auditItems.map((item) => item.type))]);
    const generated = document.querySelector('#audit-generated-at');
    if (generated && auditSummary.generated_at) generated.textContent = `Аудит сформирован: ${new Date(auditSummary.generated_at).toLocaleString('ru-RU')}`;
    bindControls();
    renderRegistry();
  } catch (error) {
    document.querySelector('#audit-summary').innerHTML = '<div class="empty">Файл аудита ещё не создан.</div>';
    if (list) list.innerHTML = '<div class="empty">Запустите workflow Generate TOS pages.</div>';
  }
}

initAudit();
