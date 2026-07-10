const fs = require('fs');
const path = require('path');
const { inferContentOrigin } = require('./lib/content_origin');

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'content_origin_report.json');
const COLLECTIONS = ['news', 'projects', 'needs', 'done'];

function readJson(relativePath, fallback = []) {
  const filePath = path.join(ROOT, relativePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function emptyCounts() {
  return { total: 0, verified: 0, editorial: 0, starter: 0, request: 0 };
}

function main() {
  const toses = readJson('data/toses.json').filter((item) => item && item.slug && item.status !== 'draft');
  const report = {
    generated_at: new Date().toISOString(),
    definitions: {
      verified: 'Материал имеет явный проверяемый источник; дополнительные детали всё равно могут требовать подтверждения.',
      editorial: 'Материал подготовлен редакцией и не считается автоматически подтверждённым.',
      starter: 'Стартовая идея для обсуждения, а не утверждённый или реализуемый проект.',
      request: 'Запрос сведений или заготовка для сбора материала, а не подтверждение события, потребности или результата.'
    },
    collections: {},
    totals: emptyCounts(),
    tos_coverage: {
      total_tos: toses.length,
      with_verified_content: 0,
      with_editorial_content: 0,
      with_only_starter_or_request: 0,
      without_any_content: 0
    }
  };

  const coverage = new Map(toses.map((tos) => [tos.slug, new Set()]));

  COLLECTIONS.forEach((collection) => {
    const items = readJson(`data/${collection}.json`).filter((item) => item && item.status !== 'draft');
    const counts = emptyCounts();

    items.forEach((item) => {
      const origin = inferContentOrigin(item, collection);
      counts.total += 1;
      counts[origin] += 1;
      report.totals.total += 1;
      report.totals[origin] += 1;
      if (item.tos_slug && coverage.has(item.tos_slug)) coverage.get(item.tos_slug).add(origin);
    });

    report.collections[collection] = counts;
  });

  coverage.forEach((origins) => {
    if (origins.has('verified')) report.tos_coverage.with_verified_content += 1;
    else if (origins.has('editorial')) report.tos_coverage.with_editorial_content += 1;
    else if (origins.has('starter') || origins.has('request')) report.tos_coverage.with_only_starter_or_request += 1;
    else report.tos_coverage.without_any_content += 1;
  });

  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Generated content origin report: ${report.totals.total} records`);
}

main();
