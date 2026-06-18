const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function isPublished(item) {
  return item && item.status !== 'draft';
}

async function getJSON(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Не удалось загрузить ${url}`);
  return response.json();
}

function compactNav() {
  const nav = $('#site-nav');
  if (!nav || nav.children.length) return;
  const links = [
    ['Каталог ТОС', '/tos/'],
    ['Жителям', '/residents/'],
    ['Председателю', '/chairperson/'],
    ['Партнёрам', '/partners/'],
    ['Проекты', '/projects/'],
    ['Сделано', '/done/'],
    ['Нужна помощь', '/needs/'],
    ['Документы', '/documents/'],
    ['Контакты', '/contacts/'],
    ['Все разделы', '/sections/']
  ];
  nav.innerHTML = links.map(([label, url]) => `<a href="${url}">${label}</a>`).join('');
}

function ensureFooterLinks() {
  const footer = $('.footer .footer-grid');
  if (!footer || $('#footer-extra-links')) return;
  const block = document.createElement('div');
  block.id = 'footer-extra-links';
  block.className = 'tiny footer-links';
  block.innerHTML = '<a href="/sections/">Все разделы</a> · <a href="/editorial-policy/">О портале</a> · <a href="/privacy/">Публикация сведений</a> · <a href="/sources/">Источники данных</a> · <a href="/site-health/">Аудит сайта</a>';
  footer.appendChild(block);
}

function injectBreadcrumbs() {
  if ($('#breadcrumbs')) return;
  const main = $('#main');
  if (!main) return;
  const parts = location.pathname.split('/').filter(Boolean);
  if (!parts.length) return;
  const labels = {
    tos: 'Каталог ТОС',
    residents: 'Жителям',
    partners: 'Партнёрам',
    news: 'Новости',
    grants: 'Поддержка',
    projects: 'Проекты',
    done: 'Сделано',
    calendar: 'Календарь',
    needs: 'Нужна помощь',
    materials: 'Материалы',
    documents: 'Документы',
    legal: 'Правовая основа',
    places: 'Территории',
    sources: 'Источники данных',
    'data-quality': 'Качество данных',
    methodology: 'Методика',
    glossary: 'Словарь',
    privacy: 'Публикация сведений',
    'create-tos': 'Создать ТОС',
    chairperson: 'Председателю',
    'update-tos': 'Обновить данные',
    map: 'Карта',
    contacts: 'Контакты',
    'editorial-policy': 'О портале',
    search: 'Поиск',
    sections: 'Все разделы',
    workbench: 'Рабочая панель',
    'site-health': 'Аудит сайта',
    'verification-tasks': 'Задачи проверки',
    'open-data': 'Открытые данные'
  };
  const crumbs = [{ name: 'Главная', url: '/' }];
  let current = '';
  for (const part of parts) {
    current += `/${part}`;
    crumbs.push({ name: labels[part] || decodeURIComponent(part), url: `${current}/` });
  }
  const nav = document.createElement('nav');
  nav.id = 'breadcrumbs';
  nav.className = 'breadcrumbs container tiny';
  nav.setAttribute('aria-label', 'Хлебные крошки');
  nav.innerHTML = crumbs.map((item, index) => index === crumbs.length - 1 ? `<span>${esc(item.name)}</span>` : `<a href="${esc(item.url)}">${esc(item.name)}</a>`).join(' <span aria-hidden="true">/</span> ');
  main.prepend(nav);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.url, location.origin).href
    }))
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

function injectHomePortalStatus() {
  const isHome = location.pathname === '/' || location.pathname === '/index.html';
  if (!isHome || $('#home-portal-status')) return;
  const main = $('#main');
  if (!main) return;
  const section = document.createElement('section');
  section.className = 'section';
  section.id = 'home-portal-status';
  section.innerHTML = `<div class="container grid"><article class="card full"><div class="card-inner"><div class="eyebrow">Статус и доверие</div><h2>Как работает портал и кто может прислать материалы</h2><p>tosborisoglebsk.ru — информационный и рабочий портал для ТОСов Борисоглебского городского округа. Здесь можно найти карточки ТОС, новости, проекты, потребности, документы и полезные материалы для председателей и жителей.</p><div class="notice"><b style="color:var(--text)">Важно:</b> сайт не является официальным сайтом администрации. Для официальных действий нужно сверять документы, решения и правовую информацию с актуальными официальными источниками.</div><div class="grid"><article class="card"><div class="card-inner"><span class="tag">Материалы</span><h3>Что можно прислать</h3><p>Новость, фотоотчёт, обновление карточки ТОС, проект, потребность территории или сообщение об ошибке.</p></div></article><article class="card"><div class="card-inner"><span class="tag">Проверка</span><h3>Как оформляется публикация</h3><p>Материал уточняется, приводится к единому формату и привязывается к нужному ТОС или разделу сайта.</p></div></article></div><div class="card-actions"><a class="btn primary" href="/workbench/">Рабочая панель</a><a class="btn" href="/data-requests/">Запросы данных</a><a class="btn" href="/data-quality/">Качество данных</a><a class="btn" href="/communication-kit/">Тексты для ВК</a><a class="btn" href="/update-tos/">Обновить данные ТОС</a><a class="btn" href="/sections/">Все разделы</a></div></div></article></div>`;
  const stats = $('#home-stats')?.closest('section');
  if (stats) main.insertBefore(section, stats);
  else main.appendChild(section);
}

function initCommonUi() {
  compactNav();
  ensureFooterLinks();
  injectBreadcrumbs();
  injectHomePortalStatus();

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') document.documentElement.dataset.theme = 'dark';

  $('[data-action=theme]')?.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    if (isDark) {
      delete document.documentElement.dataset.theme;
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem('theme', 'dark');
    }
  });

  $('[data-action=menu]')?.addEventListener('click', (event) => {
    const nav = $('#site-nav');
    nav?.classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', nav?.classList.contains('open') ? 'true' : 'false');
  });

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
}

function listItem(item, baseUrl) {
  return `<article class="list-item"><div class="meta"><span class="tag">${esc(item.category || item.type || 'Материал')}</span>${item.date ? `<span class="tag">${esc(item.date)}</span>` : ''}${item.tos_slug ? `<span class="tag">ТОС: ${esc(item.tos_slug)}</span>` : ''}</div><h3>${esc(item.title || 'Без названия')}</h3><p>${esc(item.lead || item.description || '')}</p><div class="card-actions"><a class="btn" href="${baseUrl}${esc(item.id)}/">Открыть</a>${item.source_url ? `<a class="btn" target="_blank" rel="noopener" href="${esc(item.source_url)}">Источник</a>` : ''}</div></article>`;
}

async function renderNews() {
  const root = $('#news-list');
  if (!root) return;
  try {
    const data = (await getJSON('/data/news.json')).filter(isPublished);
    root.innerHTML = data.length ? data.map((item) => listItem(item, '/news/')).join('') : '<div class="empty">Новости пока не добавлены.</div>';
  } catch (error) {
    root.innerHTML = '<div class="empty">Новости не загрузились. Проверьте data/news.json</div>';
  }
}

async function renderArticles() {
  const root = $('#articles-list');
  if (!root) return;
  try {
    const data = (await getJSON('/data/articles.json')).filter(isPublished);
    root.innerHTML = data.length ? data.map((item) => listItem(item, '/materials/')).join('') : '<div class="empty">Материалы пока не добавлены.</div>';
  } catch (error) {
    root.innerHTML = '<div class="empty">Материалы не загрузились. Проверьте data/articles.json</div>';
  }
}

function documentCard(doc) {
  const isArchive = String(doc.status || '').toLowerCase().includes('утрат') || String(doc.status || '').toLowerCase().includes('архив');
  return `<article class="list-item document-card ${doc.type === 'Шаблон' ? 'template-card' : ''}"><div class="meta"><span class="tag">${esc(doc.type || 'Документ')}</span>${doc.status ? `<span class="tag ${isArchive ? 'warn' : ''}">${esc(doc.status)}</span>` : ''}${doc.date ? `<span class="tag">${esc(doc.date)}</span>` : ''}</div><h3>${esc(doc.title || 'Документ')}</h3><p>${esc(doc.description || '')}</p>${doc.use_for ? `<div class="notice"><b style="color:var(--text)">Для чего использовать</b><br>${esc(doc.use_for)}</div>` : ''}${doc.attention ? `<p class="tiny"><b>На что обратить внимание:</b> ${esc(doc.attention)}</p>` : ''}<div class="card-actions">${doc.url ? `<a class="btn" href="/${esc(doc.url)}" target="_blank" rel="noopener">Открыть документ</a>` : ''}<a class="btn" href="/contacts/">Уточнить по документу</a></div></article>`;
}

async function renderDocuments() {
  const root = $('#documents-list');
  if (!root) return;
  try {
    const data = (await getJSON('/data/documents.json')).filter(isPublished);
    root.innerHTML = data.length ? data.map(documentCard).join('') : '<div class="empty">Документы пока не добавлены.</div>';
  } catch (error) {
    root.innerHTML = '<div class="empty">Документы не загрузились. Проверьте data/documents.json</div>';
  }
}

function grantCard(grant) {
  const prepare = (grant.prepare || []).map((item) => `<li>${esc(item)}</li>`).join('');
  const projects = (grant.project_links || []).slice(0, 6).map((id) => `<a class="tag" href="/projects/${esc(id)}/">${esc(id)}</a>`).join('');
  return `<article class="list-item grant-card"><div class="meta"><span class="tag">${esc(grant.category || 'Возможность')}</span><span class="tag warn">${esc(grant.status || 'Статус уточняется')}</span><span class="tag">Сложность: ${esc(grant.difficulty || 'уточняется')}</span>${grant.amount ? `<span class="tag">${esc(grant.amount)}</span>` : ''}</div><h3>${esc(grant.title || 'Возможность')}</h3><p><b>Срок:</b> ${esc(grant.deadline || 'проверять объявления')}</p><p><b>Когда начинать:</b> ${esc(grant.start_prepare || 'заранее')}</p><p><b>Кому подходит:</b> ${esc(grant.who || 'ТОС и актив жителей')}</p><p><b>Лучше всего для:</b> ${esc(grant.best_for || grant.directions || 'проектов местного значения')}</p><p>${esc(grant.note || '')}</p>${prepare ? `<div class="notice"><b style="color:var(--text)">Что подготовить</b><ul>${prepare}</ul></div>` : ''}${projects ? `<p class="tiny"><b>Подходящие идеи из банка проектов:</b><br>${projects}</p>` : ''}<div class="card-actions"><a class="btn" href="/projects/">Банк проектов</a><a class="btn" href="/contacts/">Задать вопрос</a>${grant.source ? `<a class="btn" target="_blank" rel="noopener" href="${esc(grant.source)}">Источник</a>` : ''}</div></article>`;
}

async function renderGrants() {
  const root = $('#grants-list');
  if (!root) return;
  try {
    const data = await getJSON('/data/grants.json');
    root.innerHTML = data.length ? data.map(grantCard).join('') : '<div class="empty">Возможности пока не добавлены.</div>';
  } catch (error) {
    root.innerHTML = '<div class="empty">Возможности не загрузились. Проверьте data/grants.json</div>';
  }
}

function projectCard(project) {
  const steps = (project.steps || []).slice(0, 4).map((step) => `<li>${esc(step)}</li>`).join('');
  return `<article class="card project-card"><div class="card-inner"><div class="meta"><span class="tag">${esc(project.type || 'Проект')}</span>${project.based_on ? '<span class="tag">На основе практики ТОС</span>' : ''}${project.grant_logic ? '<span class="tag">Под заявку</span>' : ''}</div><h3>${esc(project.title || 'Проект ТОС')}</h3><p>${esc(project.description || '')}</p>${project.grant_logic ? `<div class="notice"><b style="color:var(--text)">Грантовая логика</b><br>${esc(project.grant_logic)}</div>` : ''}${project.based_on ? `<p class="tiny"><b>Основа идеи:</b> ${esc(project.based_on)}</p>` : ''}${steps ? `<hr class="sep"/><p class="tiny"><b>Первые шаги:</b></p><ul class="tiny">${steps}</ul>` : ''}<div class="card-actions"><a class="btn" href="/projects/${esc(project.id)}/">Подробнее</a><a class="btn" href="/contacts/">Предложить проект</a></div></div></article>`;
}

async function renderProjects() {
  const root = $('#projects-list');
  if (!root) return;
  try {
    const data = (await getJSON('/data/projects.json')).filter(isPublished);
    root.innerHTML = data.length ? data.map(projectCard).join('') : '<div class="empty">Проекты пока не добавлены.</div>';
  } catch (error) {
    root.innerHTML = '<div class="empty">Проекты не загрузились. Проверьте data/projects.json</div>';
  }
}

async function renderSearch() {
  const root = $('#search-results');
  const input = $('#site-search');
  if (!root || !input) return;
  try {
    const [toses, news, articles, docs, grants, projects, done, events, needs] = await Promise.all([
      getJSON('/data/toses.json').catch(() => []),
      getJSON('/data/news.json').catch(() => []),
      getJSON('/data/articles.json').catch(() => []),
      getJSON('/data/documents.json').catch(() => []),
      getJSON('/data/grants.json').catch(() => []),
      getJSON('/data/projects.json').catch(() => []),
      getJSON('/data/done.json').catch(() => []),
      getJSON('/data/events.json').catch(() => []),
      getJSON('/data/needs.json').catch(() => [])
    ]);

    const items = [
      ...toses.filter(isPublished).map((x) => ({ type: 'ТОС', title: `ТОС «${x.name}»`, text: [x.location, x.boundaries, x.chairperson, x.description].join(' '), url: `/tos/${x.slug}/` })),
      ...news.filter(isPublished).map((x) => ({ type: 'Новость', title: x.title, text: [x.lead, (x.text || []).join(' ')].join(' '), url: `/news/${x.id}/` })),
      ...articles.filter(isPublished).map((x) => ({ type: 'Материал', title: x.title, text: [x.lead, (x.content || []).join(' ')].join(' '), url: `/materials/${x.id}/` })),
      ...docs.filter(isPublished).map((x) => ({ type: 'Документ', title: x.title, text: [x.type, x.status, x.description, x.use_for, x.attention, x.date].join(' '), url: x.url ? `/${x.url}` : '/documents/' })),
      ...grants.map((x) => ({ type: 'Поддержка', title: x.title, text: [x.category, x.status, x.note, x.directions, x.who, x.best_for, x.difficulty, x.start_prepare, (x.prepare || []).join(' ')].join(' '), url: '/grants/' })),
      ...projects.filter(isPublished).map((x) => ({ type: 'Проект', title: x.title, text: [x.type, x.description, x.grant_logic, x.based_on, (x.steps || []).join(' ')].join(' '), url: `/projects/${x.id}/` })),
      ...done.filter(isPublished).map((x) => ({ type: 'Сделано', title: x.title, text: [x.type, x.summary, x.before, x.done, x.result, x.participants, x.needs_details].join(' '), url: '/done/' })),
      ...events.filter(isPublished).map((x) => ({ type: 'Событие', title: x.title, text: [x.type, x.description, x.place, x.tos_slug].join(' '), url: '/calendar/' })),
      ...needs.filter(isPublished).map((x) => ({ type: 'Нужна помощь', title: x.title, text: [x.need_type, x.priority, x.description, x.contact, x.tos_slug].join(' '), url: '/needs/' })),
      { type: 'Жителям', title: 'Жителям: как пользоваться ТОС и участвовать в жизни территории', text: 'что такое ТОС как найти свой ТОС председатель сообщить о проблеме предложить идею помочь территории', url: '/residents/' },
      { type: 'Председателю', title: 'Председателю ТОС: рабочий кабинет, чек-листы и документы', text: 'председателю ТОС чек-листы практические инструкции первые 30 дней собрание конференция протокол устав документы документы ТОС проект ТОС смета новость фотоотчет фотоотчёт архив конфликт жалоба потребности жители актив Борисоглебск', url: '/chairperson/' },
      { type: 'Председателю', title: 'Как подтвердить карточку ТОС', text: 'проверить карточку ТОС подтвердить данные сведения открытые контакты председатель телефон соцсети логотип фото границы источник дата проверки статус подтверждено', url: '/chairperson/verify-card/' },
      { type: 'Председателю', title: 'Первые 30 дней председателя ТОС', text: 'первые 30 дней председателя ТОС контакты архив документы ТОС проблемы территории активисты новости проектные идеи контроль задач', url: '/chairperson/first-30-days/' },
      { type: 'Председателю', title: 'Собрание или конференция ТОС', text: 'собрание конференция ТОС повестка уведомление жители протокол документы ТОС голосование список участников решения ответственные сроки', url: '/chairperson/meeting/' },
      { type: 'Председателю', title: 'Проект ТОС: идея, смета, заявка и отчёт', text: 'проект ТОС проблема фото смета поддержка жителей партнеры грант заявка реализация отчет благоустройство паспорт проекта', url: '/chairperson/project/' },
      { type: 'Председателю', title: 'Новость ТОС и фотоотчёт', text: 'новость ТОС фотоотчет фотоотчёт публикация событие субботник результат участники благодарность фото до после', url: '/chairperson/news/' },
      { type: 'Председателю', title: 'Архив документов ТОС', text: 'архив документы ТОС устав границы протоколы собрания смета сметы обращения ответы фото проекты публикации', url: '/chairperson/documents/' },
      { type: 'Председателю', title: 'Конфликты в ТОС и спокойный диалог', text: 'конфликт конфликты спор жалоба жители факты фото обращение диалог председатель ТОС не обещать лишнего персональные данные', url: '/chairperson/conflicts/' },
      { type: 'Рабочая панель', title: 'Рабочая панель портала ТОС БГО', text: 'инструменты развитие портала качество данных запросы председателям кампания актуализации чек-лист фото логотипы', url: '/workbench/' },
      { type: 'Запросы данных', title: 'Запросы на уточнение данных ТОС', text: 'готовые сообщения председателям недостающие телефоны соцсети логотипы источники проверка карточек', url: '/data-requests/' },
      { type: 'Коммуникации', title: 'Коммуникационный набор ТОС БГО', text: 'готовые тексты ВК пост сообщение председателю рабочий чат проверить карточку прислать логотип фото', url: '/communication-kit/' },
      { type: 'Кампания', title: 'Кампания актуализации данных ТОС', text: 'план на 14 дней актуализация карточек контакты соцсети логотипы источники фото', url: '/campaign/' },
      { type: 'Чек-лист', title: 'Чек-лист проверки карточки ТОС', text: 'печатный чек-лист проверка карточки контакты соцсети логотип фото границы источник', url: '/field-checklist/' },
      { type: 'Фото и логотипы', title: 'Фото и логотипы для карточек ТОС', text: 'памятка логотипы фотографии территории мероприятия результаты было сделали стало подпись фото', url: '/media-guide/' },
      { type: 'Территории', title: 'Населённые пункты и территории ТОС БГО', text: 'территории населенные пункты Борисоглебский городской округ ТОС Богана Губари Ивановка Подстёпки', url: '/places/' },
      { type: 'Источники данных', title: 'Источники данных портала ТОС БГО', text: 'источники данных проверка сведений актуальность карточки ТОС качество данных', url: '/sources/' },
      { type: 'Качество данных', title: 'Качество данных каталога ТОС БГО', text: 'аудит заполненность карточек телефоны соцсети логотипы проверка данных', url: '/data-quality/' },
      { type: 'Словарь', title: 'Словарь ТОС простыми словами', text: 'словарь ТОС председатель инициативная группа собрание конференция устав границы проект потребность', url: '/glossary/' },
      { type: 'Правовая основа', title: 'ФЗ №33-ФЗ и ТОС простыми словами', text: '33-ФЗ местное самоуправление публичная власть ТОС устав собрание конференция границы', url: '/legal/federal-law-33/' },
      { type: 'О портале', title: 'Как развивается портал ТОС БГО', text: 'методика развитие портала открытый справочник аудит заготовки подтверждение данные', url: '/methodology/' },
      { type: 'Партнёрам', title: 'Партнёрам ТОС БГО: как помочь территориям и проектам', text: 'партнеры бизнес учреждения депутаты НКО волонтеры помощь материалами техника транспорт', url: '/partners/' },
      { type: 'Вопросы и ответы', title: 'Частые вопросы о ТОС и портале', text: 'FAQ частые вопросы что такое ТОС как найти свой ТОС как создать ТОС как прислать новость', url: '/faq/' },
      { type: 'Все разделы', title: 'Все разделы сайта ТОС БГО', text: 'разделы навигатор каталог жители председателю партнеры проекты документы новости контакты поиск карта материалы правовая основа', url: '/sections/' },
      { type: 'Правовая основа', title: 'Правовая основа ТОС простыми словами', text: 'правовой навигатор документы устав БГО местное самоуправление создание ТОС', url: '/legal/' },
      { type: 'О портале', title: 'О портале и редакционная политика', text: 'статус портала редакционная политика кто ведёт сайт проверка материалов не официальный сайт администрации', url: '/editorial-policy/' }
    ];

    function apply() {
      const query = input.value.toLowerCase().trim().replace(/ё/g, 'е');
      const result = !query ? items : items.filter((item) => [item.title, item.text, item.type].join(' ').toLowerCase().replace(/ё/g, 'е').includes(query));
      root.innerHTML = result.length ? result.map((item) => `<article class="list-item"><span class="tag">${esc(item.type)}</span><h3>${esc(item.title || 'Без названия')}</h3><p>${esc((item.text || '').slice(0, 220))}${(item.text || '').length > 220 ? '...' : ''}</p><a class="btn" href="${esc(item.url)}">Открыть</a></article>`).join('') : '<div class="empty">Ничего не найдено.</div>';
    }

    input.addEventListener('input', apply);
    apply();
  } catch (error) {
    root.innerHTML = '<div class="empty">Поиск не загрузился. Проверьте JSON-данные сайта.</div>';
  }
}

initCommonUi();
renderNews();
renderArticles();
renderDocuments();
renderGrants();
renderProjects();
renderSearch();
