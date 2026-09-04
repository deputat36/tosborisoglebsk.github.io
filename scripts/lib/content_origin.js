const CONTENT_ORIGINS = new Set(['verified', 'editorial', 'starter', 'request']);

const VERIFIED_NEWS_IDS = new Set([
  'mirolyubie-project-winner-2026',
  'gubari-beautiful-village-2026',
  'chkalovec-neighborhood-projects-2026',
  'tretyaki-seven-projects-news-2026',
  'tancyrey-improvement-news-2026',
  'kalinka-playground-2024',
  'bogana-sports-ground-2023',
  'mahrovka-project-experience-news-2026',
  'mayak-chigorak-projects-2025',
  'petrovskoe-water-well-2023',
  'vostochnyy-cleanups-news-2026'
]);

const ORIGIN_LABELS = {
  verified: 'Подтверждено источником',
  editorial: 'Редакционный материал',
  starter: 'Стартовая идея',
  request: 'Запрос материалов'
};

const ORIGIN_CLASSES = {
  verified: 'ok',
  editorial: '',
  starter: '',
  request: 'warn'
};

function classifyContentOrigin(item, collection = '') {
  const id = String(item?.id || '');
  if (collection === 'news' && VERIFIED_NEWS_IDS.has(id)) return 'verified';
  if (collection === 'news' && id.startsWith('send-news-')) return 'request';
  if (collection === 'needs' && id.startsWith('update-data-')) return 'request';
  if (collection === 'projects' && id.startsWith('public-stand-and-ideas-')) return 'starter';
  if (collection === 'done' && id.startsWith('result-archive-needed-')) return 'request';
  return 'editorial';
}

function inferContentOrigin(item, collection = '', options = {}) {
  const explicit = String(item?.content_origin || '').trim().toLowerCase();
  if (!options.ignoreExplicit && CONTENT_ORIGINS.has(explicit)) return explicit;
  return classifyContentOrigin(item, collection);
}

function contentOriginLabel(origin) {
  return ORIGIN_LABELS[origin] || ORIGIN_LABELS.editorial;
}

function contentOriginClass(origin) {
  return ORIGIN_CLASSES[origin] || '';
}

function contentOriginNotice(origin, collection = '') {
  if (origin === 'verified') {
    return 'Фактическая основа материала подтверждена указанным источником. Текущий статус реализации и дополнительные детали могут требовать отдельной проверки.';
  }

  if (origin === 'starter' && collection === 'projects') {
    return 'Это стартовая идея для обсуждения, а не утверждённый или реализуемый проект. Для публикации фактического проекта нужны решение ТОС, сроки, ответственные и подтверждённые материалы.';
  }

  if (origin === 'request' && collection === 'news') {
    return 'Это редакционный запрос новостей и фотографий, а не сообщение о состоявшемся событии.';
  }

  if (origin === 'request' && collection === 'needs') {
    return 'Это запрос на уточнение данных и материалов карточки, а не подтверждённая потребность в ресурсах или финансировании.';
  }

  if (origin === 'request' && collection === 'done') {
    return 'Это заготовка для сбора истории результата, а не подтверждение выполненных работ или реализованного проекта.';
  }

  if (origin === 'editorial' && collection === 'articles') {
    return 'Это редакционная практическая инструкция портала. Перед юридически значимыми действиями, подачей заявки или расходованием средств проверьте актуальные официальные требования и документы.';
  }

  return 'Материал подготовлен редакцией портала. Факты, контакты, даты и результаты следует оценивать по указанным источникам и статусу проверки.';
}

module.exports = {
  CONTENT_ORIGINS,
  VERIFIED_NEWS_IDS,
  classifyContentOrigin,
  inferContentOrigin,
  contentOriginLabel,
  contentOriginClass,
  contentOriginNotice
};
