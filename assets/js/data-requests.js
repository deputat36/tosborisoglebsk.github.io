const requestEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

let requestItems = [];
let requestFilter = 'all';

async function requestJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Не удалось загрузить ${url}`);
  return response.json();
}

function hasMissing(item, word) {
  return (item.missing || []).some((value) => String(value).toLowerCase().includes(word));
}

function requestMessage(item) {
  const missing = (item.missing || []).join(', ') || 'уточнение актуальности карточки';
  const chair = item.chairperson ? `, ${item.chairperson}` : '';
  return `Здравствуйте${chair}!\n\nОбновляем открытую карточку ТОС «${item.name}» на портале ТОС БГО: https://tosborisoglebsk.ru/tos/${item.slug}/\n\nСейчас нужно уточнить: ${missing}.\n\nПросим прислать только те сведения, которые можно размещать открыто: телефон для публикации, ссылку на группу/страницу ТОС, логотип, фото территории, краткое описание деятельности или источник подтверждения данных.\n\nЕсли какие-то данные публиковать нельзя, просто напишите «не публиковать».`;
}

function renderSummary(summary) {
  const root = document.querySelector('#data-requests-summary');
  if (!root) return;
  root.innerHTML = [
    ['Всего ТОС', summary.total_tos || 0],
    ['Высокий приоритет', summary.high_priority || 0],
    ['Без телефона', summary.without_phone || 0],
    ['Без соцсетей', summary.without_social || 0],
    ['Средняя заполненность', `${summary.average_score || 0}%`],
    ['Требует проверки', summary.needs_review_count || 0]
  ].map(([label, value]) => `<article class="stat"><b>${requestEsc(value)}</b><span>${requestEsc(label)}</span></article>`).join('');
}

function filteredItems() {
  return requestItems.filter((item) => {
    if (requestFilter === 'high') return item.priority === 'Высокий';
    if (requestFilter === 'contacts') return hasMissing(item, 'телефон') || hasMissing(item, 'email') || hasMissing(item, 'соц');
    if (requestFilter === 'logo') return hasMissing(item, 'логотип');
    return (item.missing || []).length;
  }).sort((a, b) => {
    const ap = a.priority === 'Высокий' ? 0 : 1;
    const bp = b.priority === 'Высокий' ? 0 : 1;
    return ap - bp || (b.missing || []).length - (a.missing || []).length || String(a.name).localeCompare(String(b.name), 'ru');
  });
}

function renderList() {
  const root = document.querySelector('#data-requests-list');
  if (!root) return;
  const items = filteredItems();
  if (!items.length) {
    root.innerHTML = '<div class="empty">По выбранному фильтру нет карточек для уточнения.</div>';
    return;
  }

  root.innerHTML = items.map((item) => {
    const missing = (item.missing || []).map((value) => `<span class="tag warn">${requestEsc(value)}</span>`).join('');
    const recommendations = (item.recommendations || []).map((value) => `<li>${requestEsc(value)}</li>`).join('');
    const text = requestEsc(requestMessage(item));
    return `<article class="list-item"><div class="meta"><span class="tag ${item.priority === 'Высокий' ? 'warn' : 'ok'}">${requestEsc(item.priority || 'Приоритет уточняется')}</span><span class="tag">${requestEsc(item.score || 0)}%</span><span class="tag">${requestEsc(item.location || '')}</span></div><h3>ТОС «${requestEsc(item.name)}»</h3><p><b>Председатель:</b> ${requestEsc(item.chairperson || 'уточняется')}</p><div>${missing}</div>${recommendations ? `<ul class="tiny">${recommendations}</ul>` : ''}<textarea class="copy-source" readonly rows="8">${text}</textarea><div class="card-actions"><button class="btn primary" type="button" data-copy-message="${requestEsc(item.slug)}">Скопировать сообщение</button><a class="btn" href="/tos/${requestEsc(item.slug)}/">Открыть карточку</a><a class="btn" href="/update-tos/?tos=${encodeURIComponent(item.slug || '')}">Обновить данные</a></div></article>`;
  }).join('');
}

function initFilters() {
  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      requestFilter = button.dataset.filter || 'all';
      renderList();
    });
  });
}

function initCopy() {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy-message]');
    if (!button) return;
    const article = button.closest('.list-item');
    const text = article?.querySelector('.copy-source')?.value || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Скопировано';
      setTimeout(() => { button.textContent = 'Скопировать сообщение'; }, 1800);
    } catch (error) {
      button.textContent = 'Скопируйте вручную';
    }
  });
}

async function initRequests() {
  initFilters();
  initCopy();
  try {
    const audit = await requestJson('/data/tos_content_audit.json');
    requestItems = audit.items || [];
    renderSummary(audit.summary || {});
    renderList();
  } catch (error) {
    const root = document.querySelector('#data-requests-list');
    if (root) root.innerHTML = '<div class="empty">Аудит не загрузился. Запустите Generate TOS pages.</div>';
  }
}

initRequests();
