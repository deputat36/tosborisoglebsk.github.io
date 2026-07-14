const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  LEGACY_REDIRECT_MARKER,
  PROJECT_LEGACY_REDIRECTS,
  renderLegacyProjectRedirect,
  validateTarget
} = require('./lib/project_legacy_redirects');

const ROOT = process.cwd();
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const projects = JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf8'));
const publishedIds = new Set(
  projects
    .filter((project) => project && project.id && project.status !== 'draft')
    .map((project) => String(project.id))
);

const entries = Object.entries(PROJECT_LEGACY_REDIRECTS);
assert.strictEqual(entries.length, 14, 'Expected exactly 14 documented legacy project URLs');
assert.strictEqual(new Set(entries.map(([legacyId]) => legacyId)).size, entries.length, 'Legacy IDs must be unique');

entries.forEach(([legacyId, target]) => {
  assert.match(legacyId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid legacy ID ${legacyId}`);
  assert.strictEqual(publishedIds.has(legacyId), false, `Legacy ID overlaps current project ID: ${legacyId}`);
  validateTarget(target);

  if (target !== '/projects/') {
    const targetId = target.replace(/^\/projects\//, '').replace(/\/$/, '');
    assert.ok(publishedIds.has(targetId), `Legacy target is not a published project: ${legacyId} -> ${target}`);
  }

  const html = renderLegacyProjectRedirect(target);
  assert.ok(html.includes('name="robots" content="noindex,follow"'), `${legacyId}: missing noindex`);
  assert.ok(html.includes(`http-equiv="refresh" content="0; url=${target}"`), `${legacyId}: wrong refresh target`);
  assert.ok(html.includes(`rel="canonical" href="https://tosborisoglebsk.ru${target}"`), `${legacyId}: wrong canonical`);
  assert.ok(html.includes(`href="${target}"`), `${legacyId}: missing visible target link`);
  assert.ok(html.includes(LEGACY_REDIRECT_MARKER), `${legacyId}: missing redirect marker`);
  assert.strictEqual(html.includes('Страница проекта создана автоматически из data/projects.json.'), false, `${legacyId}: redirect must not look like a generated active project`);
});

assert.throws(() => validateTarget('https://example.com/projects/'), /Invalid legacy project redirect target/);
assert.throws(() => validateTarget('/contacts/'), /Invalid legacy project redirect target/);
assert.throws(() => validateTarget('/projects/../contacts/'), /Invalid legacy project redirect target/);

console.log(`Project legacy redirects OK: ${entries.length} legacy URLs, targets valid and active IDs protected`);
