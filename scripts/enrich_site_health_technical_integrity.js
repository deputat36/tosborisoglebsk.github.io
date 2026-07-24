const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_HEALTH_PATH = path.join(ROOT, 'data', 'site_health.json');
const LINK_REPORT_PATH = path.join(ROOT, 'data', 'public_link_integrity.json');
const PAGE_INDEX_PATH = path.join(ROOT, 'data', 'page_index.json');
const VISUAL_MATRIX_PATH = path.join(ROOT, 'data', 'css_regression_matrix.csv');
const VISUAL_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml');
const LINK_WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'public-link-integrity.yml');

const BROWSER_SUITES = [
  { id: 'public-interactions', label: 'Основные интерактивные сценарии, включая поиск своего ТОС', file: 'scripts/test_public_browser_interactions.js' },
  { id: 'card-navigation', label: 'Переходы из публичных карточек', file: 'scripts/test_public_card_navigation.js' },
  { id: 'keyboard-accessibility', label: 'Клавиатурная доступность', file: 'scripts/test_keyboard_accessibility.js' },
  { id: 'places-tos-navigation', label: 'Переходы территория ↔ ТОС', file: 'scripts/test_places_tos_navigation.js' },
  { id: 'tos-activity-summary', label: 'Сводки материалов в карточках ТОС', file: 'scripts/test_tos_activity_summary.js' },
  { id: 'tos-contact-fallback', label: 'Связь через редакцию при отсутствии контакта', file: 'scripts/test_tos_contact_fallback.js' }
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function countCsvRows(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter((line, index) => index > 0 && line.trim()).length;
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
}

function main() {
  [SITE_HEALTH_PATH, LINK_REPORT_PATH, PAGE_INDEX_PATH, VISUAL_MATRIX_PATH, VISUAL_WORKFLOW_PATH, LINK_WORKFLOW_PATH].forEach(requireFile);

  const siteHealth = readJson(SITE_HEALTH_PATH);
  const linkReport = readJson(LINK_REPORT_PATH);
  const pageIndex = readJson(PAGE_INDEX_PATH);
  const visualWorkflow = fs.readFileSync(VISUAL_WORKFLOW_PATH, 'utf8');
  const linkWorkflow = fs.readFileSync(LINK_WORKFLOW_PATH, 'utf8');
  const indexedPages = Array.isArray(pageIndex.pages) ? pageIndex.pages.length : 0;

  if (linkReport.failed !== 0) throw new Error(`Cannot publish failed link integrity report: ${linkReport.failed}`);
  if (linkReport.pages_indexed !== indexedPages) {
    throw new Error(`Link report page count ${linkReport.pages_indexed} does not match page index ${indexedPages}`);
  }

  const indexPatchStep = visualWorkflow.indexOf('node scripts/patch_page_index_labels.js');
  const indexGenerateStep = visualWorkflow.indexOf('node scripts/generate_page_index.js');
  if (indexPatchStep < 0 || indexGenerateStep < 0 || indexPatchStep > indexGenerateStep) {
    throw new Error('Visual workflow must patch page-index labels before generating the public index');
  }

  const browserSuites = BROWSER_SUITES.map((suite) => {
    const exists = fs.existsSync(path.join(ROOT, suite.file));
    const referenced = visualWorkflow.includes(suite.file);
    return { ...suite, enabled: exists && referenced };
  });
  const disabledSuites = browserSuites.filter((suite) => !suite.enabled);
  if (disabledSuites.length) throw new Error(`Browser suites are not connected: ${disabledSuites.map((suite) => suite.id).join(', ')}`);

  const visualCases = countCsvRows(VISUAL_MATRIX_PATH);
  const httpWorkflowEnabled = linkWorkflow.includes('node scripts/test_public_link_integrity.js')
    && linkWorkflow.includes('contents: read')
    && linkWorkflow.includes('python3 -m http.server 4173 --bind 127.0.0.1');
  if (!httpWorkflowEnabled) throw new Error('Public link integrity workflow contract is incomplete');

  siteHealth.technical_integrity = {
    generated_at: linkReport.generated_at,
    status: 'passed',
    status_label: 'Проверка пройдена',
    method: 'Локальный HTTP-обход текущей сгенерированной версии',
    report_url: '/data/public_link_integrity.json',
    pages_indexed: linkReport.pages_indexed,
    pages_checked: linkReport.pages_checked,
    links_discovered: linkReport.links_discovered,
    internal_links_checked: linkReport.internal_links_checked,
    unique_internal_targets: linkReport.unique_internal_targets,
    external_links_ignored: linkReport.external_links_ignored,
    protocol_links_ignored: linkReport.protocol_links_ignored,
    failed: linkReport.failed,
    automation: {
      http_link_workflow_enabled: true,
      browser_suites_enabled: browserSuites.length,
      browser_suites: browserSuites,
      visual_cases: visualCases,
      visual_baseline_scope: 'Проверяется в pull request; результат конкретного запуска хранится в GitHub Actions artifact.'
    },
    validation_context: {
      source: process.env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'local',
      workflow: process.env.GITHUB_WORKFLOW || '',
      run_id: process.env.GITHUB_RUN_ID || '',
      run_number: process.env.GITHUB_RUN_NUMBER || '',
      commit_sha: process.env.GITHUB_SHA || ''
    },
    confirms: [
      'индексируемые страницы текущей сборки открываются по локальному HTTP',
      'внутренние ссылки ведут на существующие цели',
      'указанные якоря присутствуют на целевых HTML-страницах',
      'опасные javascript-ссылки и некорректные URL не обнаружены'
    ],
    does_not_confirm: [
      'актуальность председателей, телефонов, границ и других сведений о ТОС',
      'официальный статус документов, проектов, мероприятий и результатов',
      'доступность внешних сайтов, телефонов, email и социальных сетей',
      'ручные настройки GitHub Pages в интерфейсе Settings → Pages'
    ]
  };

  siteHealth.audit_scope = [...new Set([
    ...(siteHealth.audit_scope || []),
    'локальный HTTP-обход индексируемых страниц, внутренних ссылок и якорей',
    'контракт браузерных и визуальных проверок pull request'
  ])];

  siteHealth.findings = (siteHealth.findings || []).filter((item) => item.area !== 'Навигационная целостность');
  siteHealth.findings.splice(1, 0, {
    level: 'good',
    area: 'Навигационная целостность',
    finding: `HTTP-проверка прошла: ${linkReport.pages_checked} страниц, ${linkReport.internal_links_checked} внутренних переходов, ${linkReport.unique_internal_targets} уникальных целей, ошибок — 0.`
  });

  fs.writeFileSync(SITE_HEALTH_PATH, `${JSON.stringify(siteHealth, null, 2)}\n`, 'utf8');
  console.log(`Site health technical integrity enriched: ${linkReport.pages_checked} pages, ${linkReport.internal_links_checked} links, ${visualCases} visual cases`);
}

main();
