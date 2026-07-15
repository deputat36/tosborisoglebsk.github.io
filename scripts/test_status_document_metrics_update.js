const assert = require('assert');
const { updateStatusDocument } = require('./update_status_document_metrics');

const siteHealth = {
  generated_at: '2026-07-15T11:24:36.669Z',
  health_score: 72,
  pages: { total: 361, public: 305, noindex: 56, seo_warnings_count: 0, broken_internal_links_count: 0 },
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
  generated_at: '2026-07-15T11:24:36.479Z',
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
  generated_at: '2026-07-15T11:24:32.111Z',
  totals: { total: 146, verified: 1, editorial: 64, starter: 24, request: 57 }
};
const personalData = {
  updated_at: '2026-07-14',
  portal_status: 'pre_legal_readiness',
  decisions: Array.from({ length: 8 }, (_, index) => ({ id: `decision-${index}`, status: 'pending' }))
};

const stale = `# Состояние проекта

Обновлено: 13 июля 2026 года.

## Актуальные метрики основной ветки

По \`data/site_health.json\`:

- управляемых HTML-страниц: 371;
- публичных страниц: 315;
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

Технический accessibility/performance-аудит имеет более широкую область обхода и проверяет 373 HTML-файла. В нём:

- публичных страниц: 315;
- страниц с замечаниями: 2;
- high / medium / low: 1 / 1 / 0;
- публичных runtime-ресурсов: 70;
- ресурсов сверх бюджета: 1;
- общий CSS: 35 902 байта;
- общий JavaScript: 363 317 байт.

Разница между 371 и 373 страницами связана с областями обхода.

## Завершённые технические циклы в основной ветке

### Происхождение и доверие к контенту

Текущая картина \`data/content_origin_report.json\`:

- всего материалов: 140;
- \`verified\`: 0;
- \`editorial\`: 60;
- \`starter\`: 20;
- \`request\`: 60;

### Доступность и производительность

## Готовность к работе с персональными данными

Портал работает в режиме \`old_status\`.
Реестр фиксирует семь обязательных решений; все они остаются \`pending\`.

## Сохранение старых URL проектов
`;

const updated = updateStatusDocument({ documentText: stale, siteHealth, technicalReport, contentOrigin, personalData });
assert(updated.includes('Обновлено: 15 июля 2026 года.'), 'Date must be updated from report timestamps.');
assert(updated.includes('управляемых HTML-страниц: 361;'), 'Managed page count must be updated.');
assert(updated.match(/- публичных страниц: 305;/g)?.length === 2, 'Both public page counts must be updated.');
assert(updated.includes('страниц с замечаниями: 0;'), 'Technical findings count must be updated.');
assert(updated.includes('high / medium / low: 0 / 0 / 0;'), 'Technical severities must be updated.');
assert(updated.includes('публичных runtime-ресурсов: 68;'), 'Runtime asset count must be updated.');
assert(updated.includes('ресурсов сверх бюджета: 0;'), 'Budget count must be updated.');
assert(updated.includes('общий JavaScript: 355 440 байт.'), 'JavaScript byte count must be updated.');
assert(updated.includes('всего материалов: 146;'), 'Content total must be updated.');
assert(updated.includes('режиме `pre_legal_readiness`.'), 'Personal-data status must be updated.');
assert(updated.includes('восемь обязательных решений'), 'Decision count must be updated.');

const secondPass = updateStatusDocument({ documentText: updated, siteHealth, technicalReport, contentOrigin, personalData });
assert.strictEqual(secondPass, updated, 'Second update must be idempotent.');

const ambiguous = stale.replace(
  '- управляемых HTML-страниц: 371;',
  '- управляемых HTML-страниц: 371;\n- управляемых HTML-страниц: 999;'
);
assert.throws(
  () => updateStatusDocument({
    documentText: ambiguous,
    siteHealth,
    technicalReport,
    contentOrigin,
    personalData
  }),
  /expected exactly one matching status line/,
  'Ambiguous status structure must be rejected.'
);

console.log('Status document metrics updater self-test OK');
