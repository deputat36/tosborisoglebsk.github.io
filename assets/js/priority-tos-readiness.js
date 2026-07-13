const priorityReadinessEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

function priorityReadinessDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function priorityReadinessEvidenceTag(label, value) {
  return `<span class="tag ${value ? 'ok' : ''}">${priorityReadinessEsc(label)}: ${value ? 'да' : 'нет'}</span>`;
}

function priorityReadinessCard(item) {
  const dates = [
    item.sent_at ? `<span class="tag">Отправлено: ${priorityReadinessEsc(priorityReadinessDate(item.sent_at))}</span>` : '',
    item.response_received_at ? `<span class="tag">Ответ: ${priorityReadinessEsc(priorityReadinessDate(item.response_received_at))}</span>` : ''
  ].filter(Boolean).join('');

  const blockers = Array.isArray(item.blockers) && item.blockers.length
    ? `<div class="notice"><b style="color:var(--text)">Что блокирует следующий этап</b><ul>${item.blockers.map((blocker) => `<li>${priorityReadinessEsc(blocker)}</li>`).join('')}</ul></div>`
    : '<div class="notice"><b style="color:var(--text)">Блокирующих условий нет.</b><br>Перед изменением карточки всё равно нужно пройти CI-проверку доказательств.</div>';

  return `<article class="card">
    <div class="card-inner">
      <div class="meta">
        <span class="tag ${priorityReadinessEsc(item.stage_class || '')}">${priorityReadinessEsc(item.stage_label || item.stage)}</span>
        ${dates}
      </div>
      <h3>${priorityReadinessEsc(item.name)}</h3>
      <p><b>Трекер:</b> ${priorityReadinessEsc(item.tracking_status || 'Статус не указан')}</p>
      <p><b>Разбор ответа:</b> ${priorityReadinessEsc(item.review_status || 'Статус не указан')}</p>
      <div class="meta">
        ${priorityReadinessEvidenceTag('Канал найден', item.contact_channel_available)}
        ${priorityReadinessEvidenceTag('Ответ получен', item.response_received)}
        ${priorityReadinessEvidenceTag('Источник записан', item.source_recorded)}
        ${priorityReadinessEvidenceTag('Согласие записано', item.publication_consent_recorded)}
      </div>
      ${blockers}
      <p><b>Следующий шаг:</b> ${priorityReadinessEsc(item.next_action)}</p>
      <div class="card-actions">
        <a class="btn primary" href="${priorityReadinessEsc(item.card_url)}">Открыть карточку</a>
        <a class="btn" href="/data/priority_tos_tracking_template.csv">Трекер</a>
        <a class="btn" href="/data/priority_tos_response_review.csv">Разбор ответа</a>
      </div>
    </div>
  </article>`;
}

function priorityReadinessSection(report) {
  const byStage = report.summary?.by_stage || {};
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'priority-tos-readiness';
  section.setAttribute('aria-labelledby', 'priority-tos-readiness-title');
  section.innerHTML = `<div class="container section-head">
    <div>
      <h2 id="priority-tos-readiness-title">Готовность карточек к обновлению</h2>
      <p>Автоматическая сводка трекера отправки и разбора ответов без публикации контактов и закрытой переписки</p>
    </div>
    <a class="btn" href="/data/priority_tos_update_readiness.json">Открыть JSON</a>
  </div>
  <div class="container">
    <div class="summary-grid">
      <div class="summary-tile"><b>${priorityReadinessEsc(report.summary?.total ?? 0)}</b><span>приоритетные карточки</span></div>
      <div class="summary-tile"><b>${priorityReadinessEsc(report.summary?.ready_for_card_update ?? 0)}</b><span>готовы к обновлению</span></div>
      <div class="summary-tile"><b>${priorityReadinessEsc(report.summary?.waiting_external_action ?? 0)}</b><span>ждут внешнего действия</span></div>
      <div class="summary-tile"><b>${priorityReadinessEsc(byStage.review_response ?? 0)}</b><span>ответов нужно разобрать</span></div>
    </div>
    <div class="notice"><b style="color:var(--text)">Конфиденциальность:</b> ${priorityReadinessEsc(report.privacy_note || '')}</div>
    <div class="grid">${(report.items || []).map(priorityReadinessCard).join('')}</div>
  </div>`;
  return section;
}

async function loadPriorityTosReadiness() {
  const main = document.querySelector('main');
  const hero = main?.querySelector('.hero');
  if (!main || !hero || document.getElementById('priority-tos-readiness')) return;

  try {
    const response = await fetch('/data/priority_tos_update_readiness.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const report = await response.json();
    hero.insertAdjacentElement('afterend', priorityReadinessSection(report));
  } catch (error) {
    const section = document.createElement('section');
    section.className = 'section';
    section.id = 'priority-tos-readiness';
    section.innerHTML = '<div class="container notice"><b>Сводка готовности временно недоступна.</b><br>Используйте трекер отправки и реестр разбора ответов.</div>';
    hero.insertAdjacentElement('afterend', section);
  }
}

loadPriorityTosReadiness();
