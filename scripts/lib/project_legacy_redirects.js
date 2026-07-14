const SITE_URL = 'https://tosborisoglebsk.ru';
const LEGACY_REDIRECT_MARKER = 'Старая страница проекта перенаправлена генератором из scripts/lib/project_legacy_redirects.js.';

const PROJECT_LEGACY_REDIRECTS = Object.freeze({
  'archive-memory': '/projects/history-route-memory/',
  'eco-place': '/projects/eco-platform/',
  'green-route': '/projects/',
  'green-yard': '/projects/green-yard-flowerbeds/',
  'history-route': '/projects/history-route-memory/',
  lighting: '/projects/lighting-safe-way/',
  memorial: '/projects/memorial-renovation/',
  'notice-board': '/projects/information-stand-tos/',
  playground: '/projects/child-sport-playground/',
  'public-space': '/projects/center-of-attraction/',
  'safe-path': '/projects/safe-path-or-sidewalk/',
  'village-stage': '/projects/rural-cultural-space/',
  'volunteer-day': '/projects/',
  'yard-navigation': '/projects/information-stand-tos/'
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function validateTarget(target) {
  if (!/^\/projects\/(?:[a-z0-9-]+\/)?$/.test(String(target || ''))) {
    throw new Error(`Invalid legacy project redirect target: ${target}`);
  }
}

function renderLegacyProjectRedirect(target) {
  validateTarget(target);
  const escapedTarget = escapeHtml(target);
  const canonical = `${SITE_URL}${target}`;

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Страница проекта перемещена | ТОС БГО</title><meta name="description" content="Старая ссылка на проект ТОС сохранена и перенаправляет на актуальную страницу банка проектов."/><meta name="robots" content="noindex,follow"/><meta http-equiv="refresh" content="0; url=${escapedTarget}"/><link rel="canonical" href="${escapeHtml(canonical)}"/><link rel="icon" href="/favicon.svg" type="image/svg+xml"/><link rel="stylesheet" href="/assets/css/styles.css"/></head><body><a class="skip-link" href="#main">Перейти к содержимому</a><main id="main"><section class="hero"><div class="container hero-card"><h1>Страница проекта перемещена</h1><p class="lead">Открываем актуальную страницу. Если переход не сработал автоматически, используйте кнопку ниже.</p><div class="hero-actions"><a class="btn primary" href="${escapedTarget}">Перейти к проекту</a><a class="btn" href="/projects/">Все проекты</a></div><p class="tiny">${LEGACY_REDIRECT_MARKER}</p></div></section></main></body></html>`;
}

module.exports = {
  LEGACY_REDIRECT_MARKER,
  PROJECT_LEGACY_REDIRECTS,
  renderLegacyProjectRedirect,
  validateTarget
};
