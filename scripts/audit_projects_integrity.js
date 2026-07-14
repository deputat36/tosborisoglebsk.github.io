const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');
const {
  LEGACY_REDIRECT_MARKER,
  PROJECT_LEGACY_REDIRECTS
} = require('./lib/project_legacy_redirects');

const ROOT = process.cwd();
const projectsPath = path.join(ROOT, 'data', 'projects.json');
const projectsDirectory = path.join(ROOT, 'projects');
const sitemapPath = path.join(ROOT, 'sitemap.xml');
const generatorPath = path.join(ROOT, 'scripts', 'generate_project_pages.js');
const testPath = path.join(ROOT, 'scripts', 'test_project_legacy_redirects.js');
const docPath = path.join(ROOT, 'docs', 'PROJECT-LEGACY-REDIRECTS-2026-07-14.md');
const packagePath = path.join(ROOT, 'package.json');
const projectModePath = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const projectModeFullPath = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedStatuses = new Set(['published', 'draft', 'archived']);
const generatedPageMarker = 'Страница проекта создана автоматически из data/projects.json.';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function read(filePath, errors, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing ${label}: ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(text, tokens, errors, context) {
  tokens.forEach((token) => {
    if (!text.includes(token)) errors.push(`${context} must contain ${token}`);
  });
}

function main() {
  if (!fs.existsSync(projectsPath)) {
    throw new Error(`Missing file: ${projectsPath}`);
  }

  const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const errors = [];

  if (!Array.isArray(projects)) {
    throw new Error('Projects integrity audit failed:\ndata/projects.json must be an array');
  }

  const seenIds = new Set();
  const seenTitles = new Set();

  projects.forEach((project, index) => {
    const line = `project ${index + 1}`;

    if (!isObject(project)) {
      errors.push(`${line}: item must be an object`);
      return;
    }

    const id = project.id || '';
    const title = project.title || '';
    const type = project.type || '';
    const status = project.status || '';
    const description = project.description || '';
    const grantLogic = project.grant_logic || '';
    const basedOn = project.based_on || '';
    const steps = project.steps;

    if (!id) errors.push(`${line}: missing id`);
    if (id && !idPattern.test(id)) errors.push(`${line}: invalid id ${id}`);
    if (id && seenIds.has(id)) errors.push(`${line}: duplicate id ${id}`);
    if (id) seenIds.add(id);

    if (!title) errors.push(`${line}: missing title`);
    if (title && title.length < 8) errors.push(`${line}: title is too short`);
    if (title && seenTitles.has(title)) errors.push(`${line}: duplicate title ${title}`);
    if (title) seenTitles.add(title);

    if (!type) errors.push(`${line}: missing type`);
    if (!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
    if (!description) errors.push(`${line}: missing description`);
    if (description && description.length < 50) errors.push(`${line}: description is too short`);
    if (!grantLogic) errors.push(`${line}: missing grant_logic`);
    if (grantLogic && grantLogic.length < 40) errors.push(`${line}: grant_logic is too short`);
    if (!basedOn) errors.push(`${line}: missing based_on`);

    if (!Array.isArray(steps) || steps.length < 3) {
      errors.push(`${line}: steps must contain at least 3 items`);
    } else {
      steps.forEach((step, stepIndex) => {
        if (typeof step !== 'string' || step.trim().length < 15) {
          errors.push(`${line}: step ${stepIndex + 1} is too short`);
        }
      });
    }

    if (status === 'published' && id && !repoPathExists(`/projects/${id}/`)) {
      errors.push(`${line}: missing generated page /projects/${id}/`);
    }
  });

  const generatedIds = new Set(
    projects
      .filter((project) => project && project.id && project.status !== 'draft')
      .map((project) => project.id)
  );
  const legacyIds = new Set(Object.keys(PROJECT_LEGACY_REDIRECTS));

  if (legacyIds.size !== 14) errors.push(`expected 14 legacy project redirects, found ${legacyIds.size}`);
  legacyIds.forEach((legacyId) => {
    if (generatedIds.has(legacyId)) errors.push(`legacy ID overlaps an active project: ${legacyId}`);
  });

  if (fs.existsSync(projectsDirectory)) {
    for (const entry of fs.readdirSync(projectsDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory() || generatedIds.has(entry.name) || legacyIds.has(entry.name)) continue;
      const indexPath = path.join(projectsDirectory, entry.name, 'index.html');
      if (!fs.existsSync(indexPath)) continue;
      const html = fs.readFileSync(indexPath, 'utf8');
      if (html.includes(generatedPageMarker)) {
        errors.push(`stale generated page is not present in data/projects.json: /projects/${entry.name}/`);
      }
    }
  }

  const sitemap = read(sitemapPath, errors, 'sitemap');
  for (const [legacyId, target] of Object.entries(PROJECT_LEGACY_REDIRECTS)) {
    const indexPath = path.join(projectsDirectory, legacyId, 'index.html');
    if (!fs.existsSync(indexPath)) {
      errors.push(`missing legacy project redirect: /projects/${legacyId}/`);
      continue;
    }
    const html = fs.readFileSync(indexPath, 'utf8');
    if (!html.includes('name="robots" content="noindex,follow"')) {
      errors.push(`legacy project redirect must be noindex: /projects/${legacyId}/`);
    }
    if (!html.includes(`http-equiv="refresh" content="0; url=${target}"`)) {
      errors.push(`legacy project redirect has wrong target: /projects/${legacyId}/ -> ${target}`);
    }
    if (!html.includes(`rel="canonical" href="https://tosborisoglebsk.ru${target}"`)) {
      errors.push(`legacy project redirect has wrong canonical: /projects/${legacyId}/`);
    }
    if (!html.includes(LEGACY_REDIRECT_MARKER)) {
      errors.push(`legacy project redirect is missing marker: /projects/${legacyId}/`);
    }
    if (html.includes(generatedPageMarker)) {
      errors.push(`legacy redirect must not look like an active generated project: /projects/${legacyId}/`);
    }
    if (!repoPathExists(target)) {
      errors.push(`legacy project redirect target is missing: ${target}`);
    }
    if (sitemap.includes(`https://tosborisoglebsk.ru/projects/${legacyId}/`)) {
      errors.push(`legacy project redirect must not be present in sitemap: /projects/${legacyId}/`);
    }
  }

  const generator = read(generatorPath, errors, 'project generator');
  const selfTest = read(testPath, errors, 'legacy redirects self-test');
  const documentation = read(docPath, errors, 'legacy redirects documentation');
  const packageText = read(packagePath, errors, 'package.json');
  const projectMode = read(projectModePath, errors, 'project-mode audit');
  const projectModeFull = read(projectModeFullPath, errors, 'full project-mode audit');

  requireTokens(generator, [
    "require('./lib/project_legacy_redirects')",
    'removeStaleGeneratedPages(projects)',
    'html.includes(GENERATED_PAGE_MARKER)',
    'renderLegacyProjectRedirect(target)',
    'writeLegacyRedirectPages()',
    'Generated legacy project redirects'
  ], errors, 'project generator');
  requireTokens(selfTest, [
    'Expected exactly 14 documented legacy project URLs',
    'Legacy ID overlaps current project ID',
    'Legacy target is not a published project',
    "validateTarget('/contacts/')",
    'noindex,follow'
  ], errors, 'legacy redirects self-test');
  requireTokens(documentation, [
    '14 старых URL',
    'noindex,follow',
    'не удаляются без marker',
    'не входят в sitemap',
    'workflow после слияния'
  ], errors, 'legacy redirects documentation');

  let packageJson = null;
  try {
    packageJson = JSON.parse(packageText);
  } catch (error) {
    errors.push(`package.json is invalid JSON: ${error.message}`);
  }
  if (packageJson) {
    const scripts = packageJson.scripts || {};
    if (scripts['test:project-legacy-redirects'] !== 'node scripts/test_project_legacy_redirects.js') {
      errors.push('package.json must define test:project-legacy-redirects');
    }
    if (!String(scripts['audit:all'] || '').includes('npm run test:project-legacy-redirects')) {
      errors.push('audit:all must include test:project-legacy-redirects');
    }
  }

  requireTokens(projectMode, [
    "['Project legacy redirects self-test', 'scripts/test_project_legacy_redirects.js']"
  ], errors, 'project-mode audit');
  requireTokens(projectModeFull, [
    "['Project legacy redirects self-test', 'scripts/test_project_legacy_redirects.js']"
  ], errors, 'full project-mode audit');

  if (errors.length) {
    throw new Error(`Projects integrity audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Projects integrity OK: ${projects.length} projects, ${legacyIds.size} legacy redirects, stale generated pages 0`);
}

main();
