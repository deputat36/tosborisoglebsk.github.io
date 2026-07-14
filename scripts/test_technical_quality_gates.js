const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const DOC_PATH = path.join(ROOT, 'docs', 'TECHNICAL-QUALITY-GATES-2026-07-14.md');

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function page({ title, description, canonical, body = '' }) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"></head><body><h1>${title}</h1>${body}</body></html>`;
}

function run(scriptName, cwd) {
  return spawnSync(process.execPath, [path.join(SCRIPTS_DIR, scriptName)], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function expectSuccess(result, label) {
  if (result.status !== 0) throw new Error(`${label} unexpectedly failed:\n${result.stdout}\n${result.stderr}`);
}

function expectFailure(result, token, label) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0) throw new Error(`${label} unexpectedly passed`);
  if (!output.includes(token)) throw new Error(`${label} failed without expected token ${token}:\n${output}`);
}

function testAnchors() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-links-'));
  try {
    write(path.join(dir, 'index.html'), page({
      title: 'Главная тестового сайта',
      description: 'Описание главной страницы тестового сайта достаточной длины для проверки внутренних ссылок и якорей.',
      canonical: 'https://tosborisoglebsk.ru/',
      body: '<a href="/target/#section">Целевой раздел</a>'
    }));
    write(path.join(dir, 'target', 'index.html'), page({
      title: 'Целевая тестовая страница',
      description: 'Описание целевой страницы тестового сайта достаточной длины для проверки существующего якоря.',
      canonical: 'https://tosborisoglebsk.ru/target/',
      body: '<section id="section">Раздел</section>'
    }));

    expectSuccess(run('audit_site_links.js', dir), 'existing anchor');
    write(path.join(dir, 'index.html'), fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace('#section', '#missing'));
    expectFailure(run('audit_site_links.js', dir), 'якорь целевой страницы не найден', 'missing anchor');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testMetadataUniqueness() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-metadata-'));
  const duplicateTitle = 'Одинаковый заголовок публичной страницы';
  const duplicateDescription = 'Одинаковое описание публичной страницы достаточной длины для воспроизводимой проверки уникальности метаданных.';
  try {
    write(path.join(dir, 'index.html'), page({ title: duplicateTitle, description: duplicateDescription, canonical: 'https://tosborisoglebsk.ru/' }));
    write(path.join(dir, 'second', 'index.html'), page({ title: duplicateTitle, description: duplicateDescription, canonical: 'https://tosborisoglebsk.ru/second/' }));

    const duplicateResult = run('audit_public_metadata_uniqueness.js', dir);
    expectFailure(duplicateResult, 'дублируется title', 'duplicate title');
    expectFailure(duplicateResult, 'дублируется description', 'duplicate description');

    write(path.join(dir, 'second', 'index.html'), page({
      title: 'Уникальный заголовок второй страницы',
      description: 'Уникальное описание второй страницы достаточной длины, которое не совпадает с описанием главной страницы.',
      canonical: 'https://tosborisoglebsk.ru/second/'
    }));
    expectSuccess(run('audit_public_metadata_uniqueness.js', dir), 'unique public metadata');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testSiteHealthGate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tos-health-'));
  const reportPath = path.join(dir, 'data', 'site_health.json');
  try {
    write(reportPath, `${JSON.stringify({
      pages: { seo_warnings_count: 1, broken_internal_links_count: 1 },
      seo_warnings: [{ page: 'index.html' }],
      broken_internal_links: [{ page: 'index.html' }]
    }, null, 2)}\n`);
    expectFailure(run('audit_site_health_quality_gate.js', dir), 'must be zero', 'non-zero site health');

    write(reportPath, `${JSON.stringify({
      pages: { seo_warnings_count: 0, broken_internal_links_count: 0 },
      seo_warnings: [],
      broken_internal_links: []
    }, null, 2)}\n`);
    expectSuccess(run('audit_site_health_quality_gate.js', dir), 'zero site health');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function testIntegration() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};
  const projectMode = fs.readFileSync(path.join(SCRIPTS_DIR, 'audit_project_mode.js'), 'utf8');
  const projectModeFull = fs.readFileSync(path.join(SCRIPTS_DIR, 'audit_project_mode_full.js'), 'utf8');
  const linksAudit = fs.readFileSync(path.join(SCRIPTS_DIR, 'audit_site_links.js'), 'utf8');

  const expectedScripts = {
    'audit:metadata-uniqueness': 'node scripts/audit_public_metadata_uniqueness.js',
    'audit:health-quality': 'node scripts/audit_site_health_quality_gate.js',
    'test:technical-quality-gates': 'node scripts/test_technical_quality_gates.js'
  };
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (scripts[name] !== command) throw new Error(`package.json must define ${name}`);
    if (!String(scripts['audit:all'] || '').includes(`npm run ${name}`)) throw new Error(`audit:all must include ${name}`);
  }

  for (const [label, text] of [['project-mode', projectMode], ['project-mode-full', projectModeFull]]) {
    for (const file of ['scripts/test_technical_quality_gates.js', 'scripts/audit_public_metadata_uniqueness.js', 'scripts/audit_site_health_quality_gate.js']) {
      if (!text.includes(file)) throw new Error(`${label} must include ${file}`);
    }
  }

  for (const token of ['function parseHref', 'function hasAnchor', 'якорь целевой страницы не найден']) {
    if (!linksAudit.includes(token)) throw new Error(`audit_site_links.js must contain ${token}`);
  }

  if (!fs.existsSync(DOC_PATH)) throw new Error('missing technical quality gates documentation');
  const doc = fs.readFileSync(DOC_PATH, 'utf8');
  for (const token of ['якорей', 'title', 'description', 'нулевыми', 'site_health.json', 'PR №243']) {
    if (!doc.includes(token)) throw new Error(`technical quality documentation must contain ${token}`);
  }
}

function main() {
  testAnchors();
  testMetadataUniqueness();
  testSiteHealthGate();
  testIntegration();
  console.log('Technical quality gates self-test OK');
}

main();
