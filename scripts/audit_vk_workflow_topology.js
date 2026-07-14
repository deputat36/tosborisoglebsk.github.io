const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const PRIMARY_WORKFLOW = 'update-vk-news.yml';
const LEGACY_WORKFLOW = 'import-vk-posts.yml';
const PRIMARY_IMPORTER = path.join(ROOT, 'scripts', 'import_vk_news.js');
const LEGACY_IMPORTER = path.join(ROOT, 'scripts', 'import_vk_posts.js');
const LEGACY_DATA = path.join(ROOT, 'data', 'vk_posts.json');
const DOC_PATH = path.join(ROOT, 'docs', 'VK-IMPORT-OWNERSHIP-2026-07-14.md');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(text, tokens, errors, context) {
  for (const token of tokens) {
    if (!text.includes(token)) errors.push(`${context}: missing token ${token}`);
  }
}

function workflowEntriesFromDirectory(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      text: read(path.join(directory, entry.name))
    }));
}

function isScheduledVkWorkflow(text) {
  return /^\s*schedule\s*:/m.test(text) && /(VK_TOKEN|import_vk_(?:news|posts)\.js|VK news|VK posts)/i.test(text);
}

function validatePrimaryWorkflow(text) {
  const errors = [];
  requireTokens(text, [
    'name: Update VK news',
    'workflow_dispatch:',
    'schedule:',
    "cron: '0 */6 * * *'",
    'contents: write',
    'group: update-vk-news-release',
    'cancel-in-progress: true',
    'ref: release-2025-12-22',
    "node-version: '24'",
    'VK_TOKEN: ${{ secrets.VK_TOKEN }}',
    'VK_OWNER_ID: ${{ vars.VK_OWNER_ID }}',
    'VK_DOMAIN: ${{ vars.VK_DOMAIN }}',
    'VK_HASHTAGS: ${{ vars.VK_HASHTAGS }}',
    'VK_COUNT: ${{ vars.VK_COUNT }}',
    'NEWS_LIMIT: ${{ vars.NEWS_LIMIT }}',
    'node scripts/audit_vk_workflow_topology.js --self-test',
    'node scripts/audit_vk_workflow_topology.js',
    'node scripts/import_vk_news.js',
    'node scripts/migrate_content_origins.js',
    'node scripts/generate_content_origin_report.js',
    'node scripts/generate_news_pages.js',
    'node scripts/generate_material_pages.js',
    'node scripts/generate_sitemap.js',
    'node scripts/audit_content_origins.js',
    'node scripts/audit_site_links.js',
    'node scripts/audit_seo.js',
    "commit_message: 'Auto update trusted news from VK'",
    'branch: release-2025-12-22',
    'data/news.json',
    'data/content_origin_report.json',
    'news/*/index.html',
    'materials/*/index.html',
    'sitemap.xml'
  ], errors, PRIMARY_WORKFLOW);

  const scheduleCount = (text.match(/^\s*schedule\s*:/gm) || []).length;
  if (scheduleCount !== 1) errors.push(`${PRIMARY_WORKFLOW}: expected one schedule trigger, found ${scheduleCount}`);
  if (text.includes('secrets.VK_DOMAIN')) errors.push(`${PRIMARY_WORKFLOW}: VK_DOMAIN must be a repository variable, not a secret`);
  if (text.includes('scripts/import_vk_posts.js')) errors.push(`${PRIMARY_WORKFLOW}: legacy importer reference is forbidden`);
  if (text.includes('data/vk_posts.json')) errors.push(`${PRIMARY_WORKFLOW}: legacy data target is forbidden`);

  const topologyAuditIndex = text.indexOf('node scripts/audit_vk_workflow_topology.js');
  const importIndex = text.indexOf('node scripts/import_vk_news.js');
  if (topologyAuditIndex < 0 || importIndex < 0 || topologyAuditIndex > importIndex) {
    errors.push(`${PRIMARY_WORKFLOW}: topology audit must run before the network import`);
  }

  return errors;
}

function validateImporter(text) {
  const errors = [];
  requireTokens(text, [
    "const NEWS_PATH = path.join(ROOT, 'data', 'news.json');",
    "const VK_TOKEN = process.env.VK_TOKEN || '';",
    "const VK_API_VERSION = process.env.VK_API_VERSION || '5.199';",
    'hasAllowedHashtag(post.text)',
    '.filter((post) => !post.is_pinned)',
    'existingById.set(item.id',
    "status: 'published'",
    "source: 'ВКонтакте'",
    'source_url:',
    'writeJson(NEWS_PATH, merged)',
    'generateNewsPage(item)',
    'updateSitemap(merged)'
  ], errors, 'scripts/import_vk_news.js');

  if (text.includes('vk_posts.json')) errors.push('scripts/import_vk_news.js: legacy data target is forbidden');
  if (!text.includes('HASHTAGS.some')) errors.push('scripts/import_vk_news.js: service hashtag allowlist is required');
  return errors;
}

function validateTopology(entries) {
  const errors = [];
  const scheduled = entries.filter((entry) => isScheduledVkWorkflow(entry.text));
  if (scheduled.length !== 1) {
    errors.push(`expected exactly one scheduled VK workflow, found ${scheduled.length}: ${scheduled.map((entry) => entry.name).join(', ') || '(none)'}`);
  } else if (scheduled[0].name !== PRIMARY_WORKFLOW) {
    errors.push(`scheduled VK workflow must be ${PRIMARY_WORKFLOW}, found ${scheduled[0].name}`);
  }

  const importOwners = entries.filter((entry) => entry.text.includes('scripts/import_vk_news.js'));
  if (importOwners.length !== 1 || importOwners[0]?.name !== PRIMARY_WORKFLOW) {
    errors.push(`scripts/import_vk_news.js must have one workflow owner: ${PRIMARY_WORKFLOW}`);
  }

  for (const entry of entries) {
    if (entry.text.includes('scripts/import_vk_posts.js')) errors.push(`${entry.name}: legacy importer reference is forbidden`);
    if (entry.text.includes('data/vk_posts.json')) errors.push(`${entry.name}: legacy data target is forbidden`);
  }

  return errors;
}

function runSelfTest() {
  const validEntries = [
    { name: PRIMARY_WORKFLOW, text: "schedule:\n  - cron: '0 */6 * * *'\nenv:\n  VK_TOKEN: value\nrun: node scripts/import_vk_news.js" }
  ];
  const validErrors = validateTopology(validEntries);
  if (validErrors.length) throw new Error(`valid topology rejected: ${validErrors.join('; ')}`);

  const duplicateErrors = validateTopology([
    ...validEntries,
    { name: 'duplicate-vk.yml', text: 'schedule:\nenv:\n  VK_TOKEN: value\nrun: node scripts/import_vk_news.js' }
  ]);
  if (!duplicateErrors.some((error) => error.includes('exactly one scheduled VK workflow'))) {
    throw new Error('duplicate scheduled VK workflow was not rejected');
  }

  const legacyErrors = validateTopology([
    ...validEntries,
    { name: 'legacy.yml', text: 'run: node scripts/import_vk_posts.js\nfile_pattern: data/vk_posts.json' }
  ]);
  if (!legacyErrors.some((error) => error.includes('legacy importer reference is forbidden'))) {
    throw new Error('legacy importer reference was not rejected');
  }
  if (!legacyErrors.some((error) => error.includes('legacy data target is forbidden'))) {
    throw new Error('legacy data target was not rejected');
  }

  const importerErrors = validateImporter("const NEWS_PATH = path.join(ROOT, 'data', 'news.json');");
  if (!importerErrors.some((error) => error.includes('service hashtag allowlist is required'))) {
    throw new Error('importer without hashtag allowlist was not rejected');
  }

  console.log('VK workflow topology self-test OK');
}

function runRepositoryAudit() {
  const errors = [];
  const primaryWorkflowPath = path.join(WORKFLOWS_DIR, PRIMARY_WORKFLOW);
  const legacyWorkflowPath = path.join(WORKFLOWS_DIR, LEGACY_WORKFLOW);

  if (!fs.existsSync(primaryWorkflowPath)) errors.push(`missing primary workflow: .github/workflows/${PRIMARY_WORKFLOW}`);
  if (fs.existsSync(legacyWorkflowPath)) errors.push(`legacy workflow must be removed: .github/workflows/${LEGACY_WORKFLOW}`);
  if (!fs.existsSync(PRIMARY_IMPORTER)) errors.push('missing primary importer: scripts/import_vk_news.js');
  if (fs.existsSync(LEGACY_IMPORTER)) errors.push('legacy importer must be removed: scripts/import_vk_posts.js');
  if (fs.existsSync(LEGACY_DATA)) errors.push('legacy data file must not exist: data/vk_posts.json');

  const entries = workflowEntriesFromDirectory(WORKFLOWS_DIR);
  errors.push(...validateTopology(entries));

  if (fs.existsSync(primaryWorkflowPath)) errors.push(...validatePrimaryWorkflow(read(primaryWorkflowPath)));
  if (fs.existsSync(PRIMARY_IMPORTER)) errors.push(...validateImporter(read(PRIMARY_IMPORTER)));

  if (!fs.existsSync(DOC_PATH)) {
    errors.push('missing documentation: docs/VK-IMPORT-OWNERSHIP-2026-07-14.md');
  } else {
    requireTokens(read(DOC_PATH), [
      'Единственный scheduled VK workflow',
      '`update-vk-news.yml`',
      '`data/news.json`',
      '`data/vk_posts.json` не используется',
      'Хештег является редакционным разрешением на импорт',
      'Успешный PR-CI не доказывает'
    ], errors, 'VK import ownership documentation');
  }

  if (!fs.existsSync(PACKAGE_PATH)) {
    errors.push('missing package.json');
  } else {
    try {
      const packageJson = JSON.parse(read(PACKAGE_PATH));
      const scripts = packageJson.scripts || {};
      if (scripts['audit:vk-workflow'] !== 'node scripts/audit_vk_workflow_topology.js') {
        errors.push('package.json must define audit:vk-workflow');
      }
      if (scripts['test:vk-workflow'] !== 'node scripts/audit_vk_workflow_topology.js --self-test') {
        errors.push('package.json must define test:vk-workflow');
      }
      const auditAll = String(scripts['audit:all'] || '');
      if (!auditAll.includes('npm run test:vk-workflow')) errors.push('audit:all must include test:vk-workflow');
      if (!auditAll.includes('npm run audit:vk-workflow')) errors.push('audit:all must include audit:vk-workflow');
    } catch (error) {
      errors.push(`package.json is invalid JSON: ${error.message}`);
    }
  }

  for (const [filePath, label, tokenA, tokenB] of [
    [PROJECT_MODE_PATH, 'project-mode audit', "['VK workflow topology self-test', 'scripts/audit_vk_workflow_topology.js', ['--self-test']]", "['VK workflow topology', 'scripts/audit_vk_workflow_topology.js']"],
    [PROJECT_MODE_FULL_PATH, 'full project-mode audit', "['VK workflow topology self-test', 'scripts/audit_vk_workflow_topology.js', ['--self-test']]", "['VK workflow topology audit', 'scripts/audit_vk_workflow_topology.js']"]
  ]) {
    if (!fs.existsSync(filePath)) {
      errors.push(`missing ${label}`);
      continue;
    }
    requireTokens(read(filePath), [tokenA, tokenB], errors, label);
  }

  if (errors.length) throw new Error(`VK workflow topology audit failed:\n${errors.join('\n')}`);
  console.log(`VK workflow topology OK: ${entries.length} workflow files, one scheduled VK owner (${PRIMARY_WORKFLOW})`);
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  runRepositoryAudit();
}
