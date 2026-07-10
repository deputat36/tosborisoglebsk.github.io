const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'data', 'route_review_summary.json');
const ALLOWED_STATUSES = new Set(['keep', 'review', 'merge_candidate', 'archive_candidate']);

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

function main() {
  if (!fs.existsSync(REGISTRY_PATH)) throw new Error(`Missing route registry: ${REGISTRY_PATH}`);

  const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const errors = [];
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const seenIds = new Set();
  const seenRoutes = new Set();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.updated_at || ''))) errors.push('updated_at must be YYYY-MM-DD');
  if (!String(data.purpose || '').trim()) errors.push('purpose is required');
  if (!String(data.principle || '').trim()) errors.push('principle is required');
  if (groups.length < 1) errors.push('groups must contain at least one route group');

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
  });

  const pagePath = path.join(ROOT, 'route-cleanup', 'index.html');
  const scriptPath = path.join(ROOT, 'assets', 'js', 'route-cleanup.js');
  if (!fs.existsSync(pagePath)) errors.push('route-cleanup/index.html is missing');
  if (!fs.existsSync(scriptPath)) errors.push('assets/js/route-cleanup.js is missing');

  if (fs.existsSync(pagePath)) {
    const html = fs.readFileSync(pagePath, 'utf8');
    if (!/name=["']robots["'][^>]+noindex/i.test(html)) errors.push('/route-cleanup/ must stay noindex');
    if (!html.includes('/data/route_review_summary.json')) errors.push('/route-cleanup/ must link to its JSON registry');
    if (!html.includes('/assets/js/route-cleanup.js')) errors.push('/route-cleanup/ must load its renderer');
  }

  if (errors.length) throw new Error(`Route governance audit failed:\n${errors.join('\n')}`);

  console.log(`Route governance OK: ${groups.length} groups, ${seenRoutes.size} unique routes`);
}

main();
