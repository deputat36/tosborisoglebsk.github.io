const assert = require('assert');
const { auditStatusDocument } = require('./audit_status_document');

const siteHealth = {
  health_score: 72,
  pages: {
    total: 361,
    public: 305,
    noindex: 56,
    seo_warnings_count: 0,
    broken_internal_links_count: 0
  },
  catalog: {
    total_tos: 24,
    high_priority: 4,
    verified_count: 0,
    partial_count: 22,
    needs_review_count: 2,
    average_score: 88
  }
};

const technicalReport = {
  summary: {
    html_pages: 363,
    public_pages: 305,
    pages_with_issues: 0,
    issue_severity: { high: 0, medium: 0, low: 0 },
    asset_files: 68,
    over_budget_assets: 0,
    total_css_bytes: 35902,
    total_js_bytes: 355440
  }
};

const contentOrigin = {
  totals: { total: 146, verified: 1, editorial: 64, starter: 24, request: 57 },
  tos_coverage: {
    total_tos: 24,
    with_verified_content: 3,
    with_editorial_content: 6,
    with_only_starter_or_request: 15,
    without_any_content: 0
  }
};

const personalData = {
  portal_status: 'pre_legal_readiness',
  decisions: Array.from({ length: 8 }, (_, index) => ({ id: `decision-${index}`, status: 'pending' }))
};

const validDocument = `# Состояние проекта

Обновлено: 15 июля 2026 года.

Документ описывает фактическое состояние основной ветки \`release-2025-12-22\`.
PR #220 закрыт без слияния.

## Актуальные метрики основной ветки

- управляемых HTML-страниц: 361;
- публичных страниц: 305;
- служебных страниц \`noindex\`: 56;
- битых внутренних ссылок и якорей: 0;
- базовых SEO-предупреждений: 0;
- карточек ТОС: 24;
- карточек высокого приоритета: 4;
- карточек со статусом \`verified\`: 0;
- карточек со статусом \`partial\`: 22;
- карточек \`needs_review\`: 2;
- средняя заполненность карточек: 88%;
- общая оценка \`site_health\`: 72/100.

Технический accessibility/performance-аудит проверяет 363 HTML-файла.
- публичных страниц: 305;
- страниц с замечаниями: 0;
- high / medium / low: 0 / 0 / 0;
- публичных runtime-ресурсов: 68;
- ресурсов сверх бюджета: 0;
- общий CSS: 35 902 байта;
- общий JavaScript: 355 440 байт.

Разница между 361 и 363 страницами связана с областями обхода.

## Завершённые технические циклы в основной ветке

- всего материалов: 146;
- \`verified\`: 1;
- \`editorial\`: 64;
- \`starter\`: 24;
- \`request\`: 57;
- подтверждённый контент есть у 3 из 24 ТОСов;
- у 15 из 24 ТОСов есть только стартовые идеи или запросы;
- карточек без какого-либо контента: 0.

Портал работает в режиме \`pre_legal_readiness\`.
Реестр фиксирует восемь обязательных решений; все они остаются \`pending\`.
`;

const validErrors = auditStatusDocument({
  documentText: validDocument,
  siteHealth,
  technicalReport,
  contentOrigin,
  personalData
});
assert.deepStrictEqual(validErrors, [], `Valid fixture failed:\n${validErrors.join('\n')}`);

const staleRuntime = validDocument.replace('публичных runtime-ресурсов: 68;', 'публичных runtime-ресурсов: 70;');
const staleRuntimeErrors = auditStatusDocument({
  documentText: staleRuntime,
  siteHealth,
  technicalReport,
  contentOrigin,
  personalData
});
assert(staleRuntimeErrors.some((error) => error.includes('runtime assets')), 'Stale runtime count must be rejected.');

const staleCoverage = validDocument.replace('подтверждённый контент есть у 3 из 24 ТОСов;', 'подтверждённый контент есть у 1 из 24 ТОСов;');
const staleCoverageErrors = auditStatusDocument({
  documentText: staleCoverage,
  siteHealth,
  technicalReport,
  contentOrigin,
  personalData
});
assert(staleCoverageErrors.some((error) => error.includes('verified TOS coverage')), 'Stale content coverage must be rejected.');

const stalePr = `${validDocument}\nРабочий draft PR: #220\n`;
const stalePrErrors = auditStatusDocument({
  documentText: stalePr,
  siteHealth,
  technicalReport,
  contentOrigin,
  personalData
});
assert(stalePrErrors.some((error) => error.includes('Stale status claim')), 'Stale PR claim must be rejected.');

const mismatchedTechnical = {
  summary: { ...technicalReport.summary, public_pages: 304 }
};
const mismatchErrors = auditStatusDocument({
  documentText: validDocument,
  siteHealth,
  technicalReport: mismatchedTechnical,
  contentOrigin,
  personalData
});
assert(mismatchErrors.some((error) => error.includes('Source mismatch')), 'Source mismatch must be rejected.');

console.log('Status document audit self-test OK');
