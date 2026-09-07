const grantsEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const grantsPublished = (item) => item && item.status !== 'draft';
const GRANTS_FRESHNESS_DATE = '07.09.2026';
const OBRAZ_TOS_RESULTS_URL = 'https://obraz36.ru/sobitiya/-dorogie-druzja-napominaem-chto-ostalos-7-dnej-dlja-podachi-zajavok-na-konkurs-tos-ot-slov-k-delu-';

function normalizeGrantFreshness(item) {
  if (!item || typeof item !== 'object') return item;
  const next = { ...item };

  if (next.id === 'obraz-budushchego') {
    next.status = 'Конкурс «ТОС: от слов — к делу» — приём заявок завершён; следить за итогами и новыми объявлениями';
    next.deadline = 'приём заявок на конкурс «ТОС: от слов — к делу» завершился 24 августа 2026 года';
    next.source = OBRAZ_TOS_RESULTS_URL;
    next.note = 'Проверено 07.09.2026 по официальной публикации АНО «Образ Будущего». Конкурс был открыт для ТОС Воронежской области, реализовавших инициативы в 2025 году, по 12 номинациям. До публикации нового объявления не считать приём открытым.';
  }

  if (next.id === 'myvmeste-award-2026') {
    next.status = 'Приём заявок 2026 завершён / следить за итогами и следующим циклом';
    next.deadline = 'приём заявок завершился 14 июня 2026 года';
    next.note = 'Дата 14 июня 2026 года уже прошла. Карточка сохранена как ориентир для подготовки кейсов и отслеживания следующего цикла, а не как действующий приём заявок.';
  }

  return next;
}

function applyGrantFreshnessNotice() {
  const notices = [...document.querySelectorAll('main .notice')];
  const freshness = notices.find((notice) => notice.textContent.includes('Актуальность:'));
  if (!freshness) return;

  freshness.innerHTML = `<b>Актуальность:</b> проверено ${GRANTS_FRESHNESS_DATE}. Конкурс АНО «Образ Будущего» «ТОС: от слов — к делу» принимал заявки до 24.08.2026; приём завершён. Федеральная премия #МЫВМЕСТЕ 2026 также больше не принимает заявки по опубликованному дедлайну 14.06.2026. Новую возможность считаем открытой только после проверки официального объявления, положения и срока подачи.`;
}

function grantProjectLinks(item) {
  const links = Array.isArray(item.project_links) ? item.project_links.filter(Boolean).slice(0, 6) : [];
  if (!links.length) return '';

  return `<div class="card-actions">${links.map((slug) => `<a class="btn" href="/projects/${grantsEsc(slug)}/">${grantsEsc(slug.replace(/-/g, ' '))}</a>`).join('')}</div>`;
}

function grantPrepareList(item) {
  const steps = Array.isArray(item.prepare) ? item.prepare.filter(Boolean).slice(0, 5) : [];
  if (!steps.length) return '';

  return `<div class="notice"><b style="color:var(--text)">Что подготовить</b><br>${steps.map((step) => `- ${grantsEsc(step)}`).join('<br>')}</div>`;
}

function grantCard(item) {
  const source = item.source ? `<a class="btn" href="${grantsEsc(item.source)}" target="_blank" rel="noopener">Источник</a>` : '';
  return `<article class="list-item grant-card">
    <div class="meta">
      <span class="tag warn">${grantsEsc(item.category || 'Возможность')}</span>
      <span class="tag">${grantsEsc(item.difficulty || 'Сложность уточняется')}</span>
    </div>
    <h3>${grantsEsc(item.title || 'Возможность поддержки')}</h3>
    <p>${grantsEsc(item.best_for || item.directions || '')}</p>
    <div class="grid" style="margin:14px 0">
      <article class="card"><div class="card-inner"><span class="tag">Статус</span><p>${grantsEsc(item.status || 'Уточняется')}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Сумма / ресурс</span><p>${grantsEsc(item.amount || 'Уточняется')}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Срок</span><p>${grantsEsc(item.deadline || 'Уточняется')}</p></div></article>
      <article class="card"><div class="card-inner"><span class="tag">Кому подходит</span><p>${grantsEsc(item.who || 'Уточняется')}</p></div></article>
    </div>
    ${grantPrepareList(item)}
    ${item.note ? `<p class="tiny"><b>Редакционная пометка:</b> ${grantsEsc(item.note)}</p>` : ''}
    <div class="card-actions">
      <a class="btn primary" href="/projects/">Подобрать проект</a>
      <a class="btn" href="/documents/">Шаблоны</a>
      <a class="btn" href="/update-tos/?type=project#message-builder">Предложить проект</a>
      ${source}
    </div>
    ${grantProjectLinks(item)}
  </article>`;
}

async function renderGrants() {
  const root = document.querySelector('#grants-list');
  if (!root) return;

  try {
    const grants = await fetch('/data/grants.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : []);
    const items = Array.isArray(grants) ? grants.filter(grantsPublished).map(normalizeGrantFreshness) : [];
    root.innerHTML = items.length ? items.map(grantCard).join('') : '<div class="empty">Возможности поддержки пока не добавлены.</div>';
  } catch (error) {
    root.innerHTML = '<div class="empty">Раздел не загрузился. Проверьте файл data/grants.json</div>';
  }
}

applyGrantFreshnessNotice();
renderGrants();
