const siteHealthReadinessEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

function siteHealthReadinessMarkup(item) {
  const blockers = Array.isArray(item.blockers) && item.blockers.length
    ? `<div class="notice"><b style="color:var(--text)">Блокирует обновление</b><ul>${item.blockers.map((value) => `<li>${siteHealthReadinessEsc(value)}</li>`).join('')}</ul></div>`
    : '<div class="notice"><b style="color:var(--text)">Блокирующих условий нет.</b><br>Изменение карточки всё равно должно пройти evidence-guard.</div>';

  return `<div class="priority-readiness-detail">
    <div class="meta">
      <span class="tag ${siteHealthReadinessEsc(item.stage_class || '')}">${siteHealthReadinessEsc(item.stage_label || item.stage)}</span>
      <span class="tag ${item.source_recorded ? 'ok' : ''}">Источник: ${item.source_recorded ? 'зафиксирован' : 'не зафиксирован'}</span>
      <span class="tag ${item.publication_consent_recorded ? 'ok' : ''}">Согласие: ${item.publication_consent_recorded ? 'зафиксировано' : 'не зафиксировано'}</span>
    </div>
    ${blockers}
    <p><b>Следующий шаг:</b> ${siteHealthReadinessEsc(item.next_action || 'Проверить рабочий статус')}</p>
    <div class="card-actions"><a class="btn" href="/data-requests/priority-tos/#priority-tos-readiness">Открыть рабочую сводку</a></div>
  </div>`;
}

function enrichSiteHealthPriorityCards(report) {
  const root = document.getElementById('site-health-priority');
  if (!root) return false;

  const bySlug = new Map((report.items || []).map((item) => [item.slug, item]));
  let enriched = 0;

  root.querySelectorAll('article.card').forEach((card) => {
    if (card.dataset.readinessEnriched === 'true') return;
    const cardLink = card.querySelector('a[href^="/tos/"]');
    const match = cardLink?.getAttribute('href')?.match(/^\/tos\/([^/]+)\/$/);
    if (!match) return;

    const item = bySlug.get(decodeURIComponent(match[1]));
    if (!item) return;

    const inner = card.querySelector('.card-inner') || card;
    inner.insertAdjacentHTML('beforeend', siteHealthReadinessMarkup(item));
    card.dataset.readinessEnriched = 'true';
    enriched += 1;
  });

  return enriched === bySlug.size;
}

async function loadSiteHealthPriorityReadiness() {
  const root = document.getElementById('site-health-priority');
  if (!root) return;

  try {
    const response = await fetch('/data/priority_tos_update_readiness.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const report = await response.json();

    if (enrichSiteHealthPriorityCards(report)) return;

    const observer = new MutationObserver(() => {
      if (enrichSiteHealthPriorityCards(report)) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
  } catch (error) {
    root.insertAdjacentHTML('beforeend', '<div class="notice"><b>Операционная готовность не загрузилась.</b><br>Используйте страницу персональных запросов и readiness JSON.</div>');
  }
}

loadSiteHealthPriorityReadiness();
