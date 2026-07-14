const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SOURCE_PATH = path.join(ROOT, 'data', 'pr220_changed_paths.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'pr220_decomposition_inventory.csv');

const CATEGORIES = {
  admin_feature_candidate: {
    risk: 'medium',
    conflicts: true,
    decision: 'separate_review_after_pr256',
    evidence: '#256',
    reason: 'Полезная функциональность старой admin-ветки требует отдельного анализа поверх новой безопасной модели.',
    paths: [
      '.github/workflows/admin-schema.yml',
      'admin/admin-dashboard.js',
      'admin/admin-done-dataset.js',
      'admin/admin-export-tools.js',
      'admin/admin-history.js',
      'data/admin_capability_inventory.csv',
      'docs/ADMIN-AUDIT-2026-07-13.md',
      'scripts/audit_admin_capabilities.js',
      'scripts/audit_admin_dataset_schema.js'
    ]
  },
  admin_surface_superseded: {
    risk: 'high',
    conflicts: true,
    decision: 'use_replacement_pr',
    evidence: '#256',
    reason: 'Старая admin-поверхность заменена отдельным пакетом безопасности; перенос файла запрещён.',
    paths: [
      'admin/admin-index-ready.html',
      'admin/admin-logo-bulk.js',
      'admin/admin-mass-all-autofill.js',
      'admin/admin-mass-autofill.js',
      'admin/admin-mass-fill-all.js',
      'admin/admin.js',
      'admin/index.html'
    ]
  },
  css_source_superseded: {
    risk: 'high',
    conflicts: true,
    decision: 'use_replacement_pr',
    evidence: '#255',
    reason: 'Старое форматирование CSS заменено fingerprint- и visual-проверенным пакетом.',
    paths: [
      'assets/css/styles.css',
      'data/css_maintenance_inventory.csv',
      'docs/CSS-MAINTENANCE.md'
    ]
  },
  independently_adopted_visual: {
    risk: 'medium',
    conflicts: false,
    decision: 'keep_current_main',
    evidence: 'main/#165',
    reason: 'Visual baseline и comparator были независимо извлечены и проверены на актуальном main.',
    paths: [
      '.github/workflows/visual-baseline.yml',
      'data/css_regression_matrix.csv',
      'docs/VISUAL-BASELINE-CAPTURE.md',
      'docs/visual-baseline/COMPARISON-2026-07-13.md',
      'docs/visual-baseline/README.md',
      'docs/visual-baseline/css-reg-001.png',
      'docs/visual-baseline/css-reg-002.png',
      'docs/visual-baseline/css-reg-003.png',
      'docs/visual-baseline/css-reg-004.png',
      'docs/visual-baseline/css-reg-005.png',
      'docs/visual-baseline/css-reg-006.png',
      'docs/visual-baseline/css-reg-007.png',
      'docs/visual-baseline/css-reg-008.png',
      'docs/visual-baseline/css-reg-009.png',
      'docs/visual-baseline/css-reg-010.png',
      'docs/visual-baseline/css-reg-011.png',
      'docs/visual-baseline/css-reg-012.png',
      'docs/visual-baseline/css-reg-013.png',
      'docs/visual-baseline/css-reg-014.png',
      'docs/visual-baseline/manifest.json',
      'scripts/audit_css_regression_matrix.js',
      'scripts/audit_visual_comparison_integration.js',
      'scripts/capture_visual_baseline.js',
      'scripts/compare_visual_baseline.js'
    ]
  },
  independently_adopted_user_journey: {
    risk: 'medium',
    conflicts: false,
    decision: 'keep_current_main',
    evidence: 'main/#9',
    reason: 'Матрица пользовательских маршрутов независимо присутствует в актуальном контуре.',
    paths: [
      'data/user_journey_matrix.csv',
      'docs/USER-JOURNEY-TESTING.md',
      'scripts/audit_user_journey_matrix.js'
    ]
  },
  independently_adopted_generator_cleanup: {
    risk: 'high',
    conflicts: false,
    decision: 'keep_current_main',
    evidence: 'main/#9',
    reason: 'Безопасная очистка производных страниц извлечена отдельным пакетом и защищена CI.',
    paths: [
      'scripts/audit_generated_page_cleanup.js',
      'scripts/cleanup_generated_collection_pages.js',
      'scripts/lib/generated_page_cleanup.js',
      'scripts/test_generated_page_cleanup.js'
    ]
  },
  obsolete_vk_import: {
    risk: 'medium',
    conflicts: false,
    decision: 'keep_removed',
    evidence: 'main/#9',
    reason: 'Старый импорт и дублирующий workflow признаны устаревшими; возвращать их нельзя.',
    paths: [
      '.github/workflows/import-vk-posts.yml',
      'scripts/import_vk_posts.js'
    ]
  },
  generated_or_derived_output: {
    risk: 'high',
    conflicts: true,
    decision: 'regenerate_from_current_main',
    evidence: 'current generators',
    reason: 'Производный файл нельзя переносить из старой ветки; он должен создаваться актуальными генераторами.',
    paths: [
      'data/accessibility_performance_report.json',
      'data/actions_diagnostics.csv',
      'data/autonomous_improvement_plan.csv',
      'data/domain_access_check.csv',
      'data/page_index.json',
      'data/site_health.json',
      'projects/archive-memory/index.html',
      'projects/eco-place/index.html',
      'projects/green-route/index.html',
      'projects/green-yard/index.html',
      'projects/history-route/index.html',
      'projects/lighting/index.html',
      'projects/memorial/index.html',
      'projects/notice-board/index.html',
      'projects/playground/index.html',
      'projects/public-space/index.html',
      'projects/safe-path/index.html',
      'projects/village-stage/index.html',
      'projects/volunteer-day/index.html',
      'projects/yard-navigation/index.html',
      'sitemap.xml'
    ]
  },
  protected_shared_core: {
    risk: 'critical',
    conflicts: true,
    decision: 'do_not_cherry_pick',
    evidence: 'current main',
    reason: 'Общий workflow, audit или generator изменился после развилки; допустим только новый малый PR от main.',
    paths: [
      '.github/workflows/generate-tos-pages.yml',
      'package.json',
      'scripts/audit_project_mode.js',
      'scripts/audit_project_mode_full.js',
      'scripts/audit_projects_integrity.js',
      'scripts/audit_seo.js',
      'scripts/audit_site_health.js',
      'scripts/audit_site_links.js',
      'scripts/generate_material_pages.js',
      'scripts/generate_project_pages.js',
      'scripts/generate_site_health_report.js',
      'scripts/lib/project_legacy_redirects.js'
    ]
  },
  stale_status_or_documentation: {
    risk: 'medium',
    conflicts: true,
    decision: 'rewrite_from_current_state',
    evidence: 'current main',
    reason: 'Статус и отчёты старой ветки описывают уже изменившееся состояние проекта.',
    paths: [
      'actions-check/index.html',
      'docs/AUDIT-2026-07-13.md',
      'docs/AUTONOMOUS-WORK-PLAN.md',
      'docs/DECISIONS.md',
      'docs/STATUS.md',
      'site-health/index.html'
    ]
  },
  small_candidate_requires_recheck: {
    risk: 'medium',
    conflicts: true,
    decision: 'verify_then_separate_pr',
    evidence: 'none',
    reason: 'Небольшое изменение может быть полезным, но требует сравнения с текущим main и отдельного CI.',
    paths: [
      'assets/js/home-stats.js',
      'data-requests/priority-tos/index.html',
      'data-requests/tos-registry-request/index.html',
      'llms.txt',
      'scripts/audit_actions_check_content.js',
      'scripts/audit_homepage_content.js',
      'scripts/audit_priority_tos_readiness.js',
      'scripts/audit_route_governance.js'
    ]
  }
};

const RISK_OVERRIDES = {
  '.github/workflows/admin-schema.yml': 'high',
  'scripts/audit_admin_capabilities.js': 'high',
  'scripts/audit_admin_dataset_schema.js': 'high'
};

const HEADERS = [
  'path',
  'category',
  'risk',
  'direct_cherry_pick_allowed',
  'conflicts_with_current_main',
  'decision',
  'replacement_or_evidence',
  'reason'
];

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildRows(source) {
  const assignments = new Map();
  for (const [category, config] of Object.entries(CATEGORIES)) {
    for (const filePath of config.paths) {
      if (assignments.has(filePath)) throw new Error(`Duplicate category assignment: ${filePath}`);
      assignments.set(filePath, { category, ...config });
    }
  }

  const expectedPaths = Array.isArray(source.paths) ? source.paths : [];
  const expectedSet = new Set(expectedPaths);
  for (const filePath of assignments.keys()) {
    if (!expectedSet.has(filePath)) throw new Error(`Policy contains path outside PR 220 snapshot: ${filePath}`);
  }

  return expectedPaths.map((filePath) => {
    const config = assignments.get(filePath);
    if (!config) throw new Error(`Missing decomposition decision: ${filePath}`);
    return {
      path: filePath,
      category: config.category,
      risk: RISK_OVERRIDES[filePath] || config.risk,
      direct_cherry_pick_allowed: 'false',
      conflicts_with_current_main: String(Boolean(config.conflicts)),
      decision: config.decision,
      replacement_or_evidence: config.evidence,
      reason: config.reason
    };
  });
}

function renderCsv(rows) {
  const lines = [HEADERS.join(',')];
  for (const row of rows) lines.push(HEADERS.map((header) => escapeCsv(row[header])).join(','));
  return `${lines.join('\n')}\n`;
}

function main() {
  if (!fs.existsSync(SOURCE_PATH)) throw new Error('Missing data/pr220_changed_paths.json');
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const rows = buildRows(source);
  fs.writeFileSync(OUTPUT_PATH, renderCsv(rows), 'utf8');

  const counts = rows.reduce((result, row) => {
    result[row.category] = (result[row.category] || 0) + 1;
    return result;
  }, {});
  console.log(`PR 220 decomposition inventory generated: ${rows.length} paths`);
  console.log(JSON.stringify(counts));
}

module.exports = { CATEGORIES, HEADERS, buildRows, renderCsv, OUTPUT_PATH };

if (require.main === module) main();
