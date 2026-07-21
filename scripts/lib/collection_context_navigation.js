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
  }
};

function addUnique(links, href, label) {
  if (!href || !label || links.some((link) => link.href === href)) return;
  links.push({ href, label });
}

function projectUpdateHref(tos) {
  const prefix = tos?.slug ? `tos=${encodeURIComponent(tos.slug)}&` : '';
  return `/update-tos/?${prefix}type=project#message-builder`;
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
  } else {
    addUnique(links, config.relatedHref, config.relatedLabel);
  }

  if (!tos) addUnique(links, config.relatedHref, config.relatedLabel);

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
  if (collection === 'projects') return /^\/update-tos\/\?(?:tos=[a-z0-9-]+&)?type=project#message-builder$/.test(href);
  return href === config.updateHref;
}

module.exports = {
  buildCollectionContextLinks,
  collectionContextAllowedHref,
  collectionContextSectionId
};
