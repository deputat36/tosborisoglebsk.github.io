const CONTENT_ORIGINS = new Set(['verified', 'editorial', 'starter', 'request']);

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

function inferContentOrigin(item, collection = '') {
  const explicit = String(item?.content_origin || '').trim().toLowerCase();
  if (CONTENT_ORIGINS.has(explicit)) return explicit;

  const id = String(item?.id || '');
  if (collection === 'news' && id === 'mirolyubie-project-winner-2026') return 'verified';
  if (collection === 'news' && id.startsWith('send-news-')) return 'request';
  if (collection === 'needs' && id.startsWith('update-data-')) return 'request';
  if (collection === 'projects' && id.startsWith('public-stand-and-ideas-')) return 'starter';
  if (collection === 'done' && id.startsWith('result-archive-needed-')) return 'request';

  return 'editorial';
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

  return 'Материал подготовлен редакцией портала. Факты, контакты, даты и результаты следует оценивать по указанным источникам и статусу проверки.';
}

module.exports = {
  CONTENT_ORIGINS,
  inferContentOrigin,
  contentOriginLabel,
  contentOriginClass,
  contentOriginNotice
};
