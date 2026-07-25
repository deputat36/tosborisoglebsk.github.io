const qualityEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

async function qualityJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Не удалось загрузить ${url}`);
  return response.json();
}

function qualityStat(value, label) {
  return `<article class="stat"><b>${qualityEsc(value)}</b><span>${qualityEsc(label)}</span></article>`;
}

function renderQualitySummary(summary) {
  const root = document.querySelector('#quality-summary');
  if (!root) return;
  root.innerHTML = [
    qualityStat(summary.total_tos || 0, 'ТОСов в каталоге'),
    qualityStat(`${summary.average_score || 0}%`, 'средняя заполненность'),
    qualityStat(summary.high_priority || 0, 'высокий приоритет'),
    qualityStat(summary.verified_count || 0, 'подтверждено'),
    qualityStat(summary.partial_count || 0, 'проверено частично'),
    qualityStat(summary.needs_review_count || 0, 'требует проверки'),
    qualityStat(summary.without_phone || 0, 'без телефона'),
    qualityStat(summary.without_social || 0, 'без соцсетей'),
    qualityStat(summary.without_news || 0, 'без содержательной публикации'),
    qualityStat(summary.request_only_news || 0, 'только с запросом новости'),
    qualityStat(summary.without_done || 0, 'без истории результата'),
    qualityStat(summary.request_only_done || 0, 'только с запросом результата')
  ].join('');
}

function priorityClass(priority) {
  if (priority === 'Высокий') return 'warn';
  if (priority === 'Низкий') return 'ok';
  return '';
}

function statusClass(status) {
  if (status === 'verified') return 'ok';
  if (status === 'partial') return 'info';
  if (status === 'needs_review' || status === 'stale') return 'warn';
  return '';
}

function statusLabel(status) {
  return ({
    verified: 'сведения подтверждены',
    partial: 'проверено частично',
    needs_review: 'требует проверки',
    stale: 'проверка устарела',
    unknown: 'данные уточняются'
  })[status] || 'данные уточняются';
}

function cardUpdateUrl(slug) {
  return `/update-tos/?tos=${encodeURIComponent(slug || '')}&type=card#message-builder`;
}

function contentMaturityTags(item) {
  const linked = item.linked || {};
  const requests = item.linked_requests || {};
  const tags = [];
  if (!linked.news && requests.news) tags.push('<span class="tag warn">запрос вместо новости</span>');
  if (!linked.done && requests.done) tags.push('<span class="tag warn">запрос вместо результата</span>');
  if (!linked.needs && requests.needs) tags.push('<span class="tag warn">запрос вместо потребности</span>');
  if (!linked.projects && requests.projects) tags.push('<span class="tag warn">запрос вместо проекта</span>');
  return tags.join('');
}

function renderQualityList(items) {
  const root = document.querySelector('#quality-list');
  if (!root) return;
  const important = items
    .filter((item) => item.priority === 'Высокий' || (item.missing || []).length || item.verification_status !== 'verified')
    .sort((a, b) => {
      const rank = { 'Высокий': 0, 'Средний': 1, 'Низкий': 2 };
      return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9)
        || Number(a.score || 0) - Number(b.score || 0)
        || String(a.name).localeCompare(String(b.name), 'ru');
    });

  if (!important.length) {
    root.innerHTML = '<div class="empty">Критичных пробелов по карточкам не найдено.</div>';
    return;
  }

  root.innerHTML = important.map((item) => {
    const missing = (item.missing || []).map((value) => `<span class="tag warn">${qualityEsc(value)}</span>`).join('');
    const maturity = contentMaturityTags(item);
    const recommendations = (item.recommendations || []).map((value) => `<li>${qualityEsc(value)}</li>`).join('');
    const status = item.verification_status || item.data_status || item.verification?.status || 'unknown';
    return `<article class="list-item"><div class="meta"><span class="tag ${priorityClass(item.priority)}">${qualityEsc(item.priority)} приоритет</span><span class="tag">${qualityEsc(item.score)}%</span><span class="tag ${statusClass(status)}">${qualityEsc(statusLabel(status))}</span><span class="tag">${qualityEsc(item.location || 'территория уточняется')}</span></div><h3>ТОС «${qualityEsc(item.name || item.slug)}»</h3><p><b>Председатель:</b> ${qualityEsc(item.chairperson || 'уточняется')}</p><div class="audit-missing">${missing || '<span class="tag ok">Основные поля заполнены</span>'}${maturity}</div>${recommendations ? `<ul class="tiny">${recommendations}</ul>` : ''}<div class="card-actions"><a class="btn" href="/tos/${qualityEsc(item.slug)}/">Открыть карточку</a><a class="btn" href="/verification-tasks/">Задачи проверки</a><a class="btn" href="/collection-board/">Доска сбора</a><a class="btn primary" href="${cardUpdateUrl(item.slug)}">Прислать уточнение</a></div></article>`;
  }).join('');
}

async function initQualityDashboard() {
  try {
    const audit = await qualityJson('/data/tos_content_audit.json');
    renderQualitySummary(audit.summary || {});
    renderQualityList(audit.items || []);
  } catch (error) {
    const summary = document.querySelector('#quality-summary');
    const list = document.querySelector('#quality-list');
    if (summary) summary.innerHTML = '<div class="empty">Аудит пока не создан.</div>';
    if (list) list.innerHTML = '<div class="empty">Запустите workflow Generate TOS pages.</div>';
  }
}

initQualityDashboard();
