const auditEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

async function loadAudit() {
  const response = await fetch('/data/tos_content_audit.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('audit not found');
  return response.json();
}

function statTile(value, label) {
  return `<article class="stat"><b>${auditEsc(value)}</b><span>${auditEsc(label)}</span></article>`;
}

function renderSummary(summary) {
  const root = document.querySelector('#audit-summary');
  if (!root) return;
  root.innerHTML = [
    statTile(summary.total_tos || 0, 'ТОСов в аудите'),
    statTile(summary.average_score || 0, 'средняя заполненность'),
    statTile(summary.high_priority || 0, 'высокий приоритет'),
    statTile(summary.without_phone || 0, 'без телефона'),
    statTile(summary.without_news || 0, 'без новостей'),
    statTile(summary.without_done || 0, 'без историй результата')
  ].join('');
}

function priorityClass(priority) {
  if (priority === 'Высокий') return 'warn';
  if (priority === 'Средний') return '';
  return 'ok';
}

function renderItem(item) {
  const missing = (item.missing || []).slice(0, 8).map((value) => `<span class="tag warn">${auditEsc(value)}</span>`).join('');
  const recommendations = (item.recommendations || []).map((value) => `<li>${auditEsc(value)}</li>`).join('');
  return `<article class="list-item">
    <div class="meta"><span class="tag ${priorityClass(item.priority)}">${auditEsc(item.priority)} приоритет</span><span class="tag">Заполнено ${auditEsc(item.score)}%</span><span class="tag">${auditEsc(item.location || 'территория уточняется')}</span></div>
    <h3>ТОС «${auditEsc(item.name || item.slug)}»</h3>
    <p><b>Председатель:</b> ${auditEsc(item.chairperson || 'уточняется')}<br><b>Обновлено:</b> ${auditEsc(item.updated_at || 'дата уточняется')}</p>
    <div class="meta">${missing || '<span class="tag ok">Основные поля заполнены</span>'}</div>
    <div class="notice"><b style="color:var(--text)">Связанные материалы</b><br>Новости: ${auditEsc(item.linked?.news || 0)} · Сделано: ${auditEsc(item.linked?.done || 0)} · Потребности: ${auditEsc(item.linked?.needs || 0)} · Проекты: ${auditEsc(item.linked?.projects || 0)} · События: ${auditEsc(item.linked?.events || 0)}</div>
    ${recommendations ? `<p class="tiny"><b>Что запросить:</b></p><ul class="tiny">${recommendations}</ul>` : ''}
    <div class="card-actions"><a class="btn primary" href="/tos/${auditEsc(item.slug)}/">Карточка ТОС</a><a class="btn" href="/update-tos/">Обновить данные</a><a class="btn" href="/contacts/">Написать редакции</a></div>
  </article>`;
}

async function renderAudit() {
  const list = document.querySelector('#audit-list');
  if (!list) return;
  try {
    const data = await loadAudit();
    renderSummary(data.summary || {});
    const items = data.items || [];
    list.innerHTML = items.length ? items.map(renderItem).join('') : '<div class="empty">Аудит пока пуст.</div>';
  } catch (error) {
    document.querySelector('#audit-summary').innerHTML = '<div class="empty">Файл аудита ещё не создан. Запустите Generate TOS pages.</div>';
    list.innerHTML = '<div class="empty">После запуска генерации появится data/tos_content_audit.json.</div>';
  }
}

renderAudit();
