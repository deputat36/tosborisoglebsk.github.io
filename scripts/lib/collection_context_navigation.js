const COLLECTION_CONFIG = {
  projects: {
    sectionId: 'project-context',
    actionHref: '/projects/action-routes/',
    actionLabel: 'Маршрут подготовки проекта',
    helperHref: '/documents/templates/project-kit/',
    helperLabel: 'Комплект проектных форм',
    relatedHref: '/grants/',
    relatedLabel: 'Конкурсы и гранты',
    updateLabel: 'Предложить проект или уточнение'
  },
  needs: {
    sectionId: 'need-context',
    actionHref: '/needs/action-routes/',
    actionLabel: 'Как организовать помощь',
    helperHref: '/partners/',
    helperLabel: 'Партнёрам и организациям',
    relatedHref: '/done/',
    relatedLabel: 'Истории результата',
    updateHref: '/update-tos/?type=need#message-builder',
    updateLabel: 'Передать потребность или уточнение'
  },
  done: {
    sectionId: 'done-context',
    actionHref: '/done/action-routes/',
    actionLabel: 'Как оформить историю результата',
    helperHref: '/documents/templates/project-photo-report/',
    helperLabel: 'Шаблон фотоотчёта',
    relatedHref: '/projects/',
    relatedLabel: 'Банк проектов и идей',
    updateHref: '/update-tos/?type=photo#message-builder',
    updateLabel: 'Прислать фото или уточнение'
  },
  articles: {
    sectionId: 'material-context',
    actionHref: '/materials/',
    actionLabel: 'Все полезные материалы',
    helperHref: '/documents/',
    helperLabel: 'Документы и шаблоны',
    relatedHref: '/chairperson/',
    relatedLabel: 'Маршруты председателя',
    updateHref: '/update-tos/',
    updateLabel: 'Предложить тему или уточнение'
  }
};

const ARTICLE_RELATED_RULES = [
  { pattern: /(грант|конкурс|заявк|смет)/i, href: '/grants/', label: 'Конкурсы и гранты' },
  { pattern: /(проект|благоустрой|площадк|инициатив)/i, href: '/projects/', label: 'Банк проектов и идей' },
  { pattern: /(созда|устав|границ|регистрац|прав)/i, href: '/create-tos/', label: 'Как создать ТОС' },
  { pattern: /(партн|нко|предпринимат|организац)/i, href: '/partners/', label: 'Партнёрам и организациям' },
  { pattern: /(фото|отч[её]т|публикац|соцсет|вконтакте)/i, href: '/done/', label: 'Истории и фотоотчёты' }
];

function addUnique(links, href, label) {
  if (!href || !label || links.some((link) => link.href === href)) return;
  links.push({ href, label });
}

function projectUpdateHref(tos) {
  const prefix = tos?.slug ? `tos=${encodeURIComponent(tos.slug)}&` : '';
  return `/update-tos/?${prefix}type=project#message-builder`;
}

function articleRelatedLink(item, config) {
  const text = [
    item?.category,
    item?.title,
    item?.lead,
    ...(Array.isArray(item?.content) ? item.content : [])
  ].filter(Boolean).join(' ');
  return ARTICLE_RELATED_RULES.find((rule) => rule.pattern.test(text)) || {
    href: config.relatedHref,
    label: config.relatedLabel
  };
}

function buildCollectionContextLinks(collection, item, tos, origin) {
  const config = COLLECTION_CONFIG[collection];
  if (!config) throw new Error(`Unknown collection context: ${collection}`);

  const links = [];
  if (tos?.slug && tos?.name) addUnique(links, `/tos/${tos.slug}/`, `Карточка ТОС «${tos.name}»`);

  addUnique(links, config.actionHref, config.actionLabel);
  addUnique(links, config.helperHref, config.helperLabel);

  if (origin !== 'verified') {
    addUnique(links, '/verification-guide/', 'Как портал проверяет сведения');
  }

  const related = collection === 'articles'
    ? articleRelatedLink(item, config)
    : { href: config.relatedHref, label: config.relatedLabel };

  if (origin === 'verified' || !tos || collection === 'articles') {
    addUnique(links, related.href, related.label);
  }

  const updateHref = collection === 'projects'
    ? projectUpdateHref(tos)
    : config.updateHref;
  addUnique(links, updateHref, config.updateLabel);

  return links.slice(0, 5);
}

function collectionContextSectionId(collection) {
  const config = COLLECTION_CONFIG[collection];
  if (!config) throw new Error(`Unknown collection context: ${collection}`);
  return config.sectionId;
}

function collectionContextAllowedHref(collection, href) {
  const config = COLLECTION_CONFIG[collection];
  if (!config || !href) return false;

  if (/^\/tos\/[a-z0-9-]+\/$/.test(href)) return true;
  if (href === '/verification-guide/') return true;
  if (href === config.actionHref || href === config.helperHref || href === config.relatedHref) return true;
  if (collection === 'articles') {
    const topicHrefs = new Set(ARTICLE_RELATED_RULES.map((rule) => rule.href));
    return topicHrefs.has(href) || href === config.updateHref;
  }
  if (collection === 'projects') return /^\/update-tos\/\?(?:tos=[a-z0-9-]+&)?type=project#message-builder$/.test(href);
  return href === config.updateHref;
}

module.exports = {
  buildCollectionContextLinks,
  collectionContextAllowedHref,
  collectionContextSectionId
};