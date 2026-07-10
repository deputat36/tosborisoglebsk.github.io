const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'data', 'route_review_summary.json');
const ALLOWED_STATUSES = new Set(['keep', 'review', 'merge_candidate', 'archive_candidate']);
const ALLOWED_CONSOLIDATION_STATUSES = new Set(['ready_for_link_cleanup', 'link_cleanup_done', 'keep_separate', 'blocked_by_manual_review']);

function routeToFile(route) {
  if (typeof route !== 'string' || !route.startsWith('/')) return null;
  const clean = route.split('#')[0].split('?')[0].replace(/^\/+/, '');
  if (!clean) return path.join(ROOT, 'index.html');
  const direct = path.join(ROOT, clean);
  if (route.endsWith('/')) return path.join(direct, 'index.html');
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  return path.join(direct, 'index.html');
}

function validateRoute(errors, groupId, item, kind, seenRoutes) {
  if (!item || typeof item !== 'object') {
    errors.push(`${groupId}: ${kind} must be an object`);
    return;
  }

  const route = String(item.route || '').trim();
  const role = String(item.role || '').trim();
  if (!route) errors.push(`${groupId}: ${kind}.route is required`);
  if (!role) errors.push(`${groupId}: ${kind}.role is required`);
  if (!route.startsWith('/')) errors.push(`${groupId}: ${kind}.route must start with /: ${route}`);

  if (route) {
    if (seenRoutes.has(route)) errors.push(`${groupId}: route is duplicated in registry: ${route}`);
    seenRoutes.add(route);

    const filePath = routeToFile(route);
    if (!filePath || !fs.existsSync(filePath)) {
      errors.push(`${groupId}: route target is missing: ${route}`);
    }
  }
}

function validateConsolidation(errors, label, group) {
  const proposal = group?.consolidation;
  if (!proposal || typeof proposal !== 'object') {
    errors.push(`${label}: consolidation proposal is required`);
    return;
  }

  const status = String(proposal.status || '').trim();
  const recommendation = String(proposal.recommendation || '').trim();
  const navigationChange = String(proposal.navigation_change || '').trim();
  const doNotDo = String(proposal.do_not_do || '').trim();
  const preconditions = Array.isArray(proposal.preconditions) ? proposal.preconditions : [];

  if (!ALLOWED_CONSOLIDATION_STATUSES.has(status)) {
    errors.push(`${label}: invalid consolidation status ${status || '(empty)'}`);
  }
  if (recommendation.length < 40) errors.push(`${label}: consolidation recommendation is too short`);
  if (navigationChange.length < 40) errors.push(`${label}: navigation_change is too short`);
  if (doNotDo.length < 40) errors.push(`${label}: do_not_do is too short`);
  if (preconditions.length < 2) errors.push(`${label}: at least two consolidation preconditions are required`);

  const seenPreconditions = new Set();
  preconditions.forEach((item, index) => {
    const text = String(item || '').trim();
    if (text.length < 10) errors.push(`${label}: precondition ${index + 1} is too short`);
    if (seenPreconditions.has(text)) errors.push(`${label}: duplicate consolidation precondition: ${text}`);
    seenPreconditions.add(text);
  });

  if (group?.status === 'keep' && status !== 'keep_separate') {
    errors.push(`${label}: keep group must use keep_separate consolidation status`);
  }
  if ((status === 'ready_for_link_cleanup' || status === 'link_cleanup_done') && group?.status !== 'review') {
    errors.push(`${label}: ${status} requires group status review`);
  }

  if (status === 'link_cleanup_done') {
    const completedAt = String(proposal.completed_at || '').trim();
    const evidence = String(proposal.evidence || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(completedAt)) errors.push(`${label}: completed_at must be YYYY-MM-DD for completed cleanup`);
    if (evidence.length < 30) errors.push(`${label}: evidence is required for completed cleanup`);
  } else {
    if (proposal.completed_at) errors.push(`${label}: completed_at is allowed only for link_cleanup_done`);
    if (proposal.evidence) errors.push(`${label}: evidence is allowed only for link_cleanup_done`);
  }
}

function assertPageMarkers(errors, prefix, route, required, forbidden = []) {
  const filePath = routeToFile(route);
  if (!filePath || !fs.existsSync(filePath)) {
    errors.push(`${prefix}: missing route ${route}`);
    return;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  required.forEach((marker) => {
    if (!html.includes(marker)) errors.push(`${prefix}: ${route} missing marker ${marker}`);
  });
  forbidden.forEach((marker) => {
    if (html.includes(marker)) errors.push(`${prefix}: ${route} must not contain marker ${marker}`);
  });
}

function validateEditorWorkflowCleanup(errors) {
  assertPageMarkers(errors, 'editor-workflow cleanup', '/workbench-routes/', [
    'href="/workbench/"',
    'Роль страницы:',
    'короткие сценарии'
  ]);
  assertPageMarkers(errors, 'editor-workflow cleanup', '/collection-board/', [
    'href="/workbench/"',
    'Роль страницы:',
    'локальная доска',
    'data/outreach_register.csv'
  ]);
  assertPageMarkers(errors, 'editor-workflow cleanup', '/editorial-workflow/', [
    'href="/workbench/"',
    'Роль страницы:',
    'подробная инструкция',
    '/collection-board/'
  ]);
}

function validateDataUpdateCleanup(errors) {
  assertPageMarkers(errors, 'data-update cleanup', '/data-update/', [
    'Публичная сводка актуализации',
    'не принимает сведения',
    'href="/update-tos/?type=card#message-builder"',
    'Публичная передача и редакционная проверка — разные этапы'
  ]);

  assertPageMarkers(errors, 'data-update cleanup', '/data-requests/', [
    'name="robots" content="noindex,nofollow"',
    'Для редактора — этап 1 из 3',
    'href="/workbench/"',
    'href="/reply-review/"',
    'href="/update-tos/?type=card#message-builder"',
    'Подготовленный текст сам по себе не означает, что запрос отправлен'
  ]);

  assertPageMarkers(errors, 'data-update cleanup', '/reply-review/', [
    'name="robots" content="noindex,nofollow"',
    'Для редактора — этап 2 из 3',
    'href="/workbench/"',
    'href="/data-requests/"',
    'href="/update-tos/?type=card#message-builder"',
    'Эта страница не является публичной формой передачи сведений'
  ]);

  assertPageMarkers(errors, 'data-update cleanup', '/update-tos/', [
    'Передача материалов',
    'id="message-builder"'
  ], [
    'href="/data-requests/"',
    'href="/reply-review/"'
  ]);
}

function main() {
  if (!fs.existsSync(REGISTRY_PATH)) throw new Error(`Missing route registry: ${REGISTRY_PATH}`);

  const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const errors = [];
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const seenIds = new Set();
  const seenRoutes = new Set();
  const declaredConsolidationStatuses = new Set(Array.isArray(data.allowed_consolidation_statuses) ? data.allowed_consolidation_statuses : []);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.updated_at || ''))) errors.push('updated_at must be YYYY-MM-DD');
  if (!String(data.purpose || '').trim()) errors.push('purpose is required');
  if (!String(data.principle || '').trim()) errors.push('principle is required');
  if (groups.length < 1) errors.push('groups must contain at least one route group');

  ALLOWED_CONSOLIDATION_STATUSES.forEach((status) => {
    if (!declaredConsolidationStatuses.has(status)) errors.push(`allowed_consolidation_statuses missing ${status}`);
  });
  declaredConsolidationStatuses.forEach((status) => {
    if (!ALLOWED_CONSOLIDATION_STATUSES.has(status)) errors.push(`unsupported declared consolidation status ${status}`);
  });

  groups.forEach((group, index) => {
    const id = String(group?.id || '').trim();
    const label = id || `group-${index + 1}`;
    if (!id) errors.push(`${label}: id is required`);
    if (seenIds.has(id)) errors.push(`${label}: duplicate group id`);
    seenIds.add(id);
    if (!String(group?.title || '').trim()) errors.push(`${label}: title is required`);
    if (!ALLOWED_STATUSES.has(group?.status)) errors.push(`${label}: invalid status ${group?.status || '(empty)'}`);
    if (!String(group?.decision || '').trim()) errors.push(`${label}: decision is required`);

    validateRoute(errors, label, group?.main, 'main', seenRoutes);

    const related = Array.isArray(group?.related) ? group.related : [];
    if (!related.length) errors.push(`${label}: related routes are required`);
    related.forEach((item, relatedIndex) => validateRoute(errors, label, item, `related[${relatedIndex}]`, seenRoutes));
    validateConsolidation(errors, label, group);
  });

  validateEditorWorkflowCleanup(errors);
  validateDataUpdateCleanup(errors);

  const pagePath = path.join(ROOT, 'route-cleanup', 'index.html');
  const scriptPath = path.join(ROOT, 'assets', 'js', 'route-cleanup.js');
  if (!fs.existsSync(pagePath)) errors.push('route-cleanup/index.html is missing');
  if (!fs.existsSync(scriptPath)) errors.push('assets/js/route-cleanup.js is missing');

  if (fs.existsSync(pagePath)) {
    const html = fs.readFileSync(pagePath, 'utf8');
    if (!/name=["']robots["'][^>]+noindex/i.test(html)) errors.push('/route-cleanup/ must stay noindex');
    if (!html.includes('/data/route_review_summary.json')) errors.push('/route-cleanup/ must link to its JSON registry');
    if (!html.includes('/assets/js/route-cleanup.js')) errors.push('/route-cleanup/ must load its renderer');
    ALLOWED_CONSOLIDATION_STATUSES.forEach((status) => {
      if (!html.includes(status)) errors.push(`/route-cleanup/ must explain consolidation status ${status}`);
    });
  }

  if (fs.existsSync(scriptPath)) {
    const script = fs.readFileSync(scriptPath, 'utf8');
    if (!script.includes('consolidation')) errors.push('route cleanup renderer must display consolidation proposals');
    if (!script.includes('navigation_change')) errors.push('route cleanup renderer must display navigation_change');
    if (!script.includes('do_not_do')) errors.push('route cleanup renderer must display do_not_do');
    if (!script.includes('completed_at')) errors.push('route cleanup renderer must display completed_at');
    if (!script.includes('evidence')) errors.push('route cleanup renderer must display completion evidence');
  }

  if (errors.length) throw new Error(`Route governance audit failed:\n${errors.join('\n')}`);

  const proposalCounts = groups.reduce((acc, group) => {
    const status = group?.consolidation?.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  console.log(`Route governance OK: ${groups.length} groups, ${seenRoutes.size} unique routes, proposals ${JSON.stringify(proposalCounts)}, completed cleanup evidence protected`);
}

main();
