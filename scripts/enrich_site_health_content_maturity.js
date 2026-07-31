const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const HEALTH_PATH = path.join(ROOT, 'data', 'site_health.json');
const ORIGIN_PATH = path.join(ROOT, 'data', 'content_origin_report.json');
const AUDIT_PATH = path.join(ROOT, 'data', 'tos_content_audit.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function syncScore(health, summary) {
  if (!health.score_breakdown?.penalties) return;
  health.score_breakdown.penalties.high_priority_tos = Number(summary.high_priority || 0) * 3;
  health.score_breakdown.penalties.needs_review_tos = Number(summary.needs_review_count || 0) * 4;
  health.score_breakdown.penalties.missing_public_phone = Number(summary.without_phone || 0) * 2;
  const totalPenalty = Object.values(health.score_breakdown.penalties)
    .reduce((sum, value) => sum + Number(value || 0), 0);
  health.health_score = Math.max(0, Math.min(100, Number(health.score_breakdown.base || 100) - totalPenalty));
}

function syncPriorityTos(health, auditItems) {
  const existing = new Map((health.priority_tos || []).map((item) => [item.slug, item]));
  health.priority_tos = (auditItems || [])
    .filter((item) => item.priority === 'Высокий')
    .map((item) => ({
      slug: item.slug,
      name: item.name,
      location: item.location,
      score: item.score,
      missing: item.missing,
      verification: item.verification?.label || item.verification?.status || '',
      ...(existing.get(item.slug)?.readiness ? { readiness: existing.get(item.slug).readiness } : {})
    }));
}

function main() {
  if (!fs.existsSync(HEALTH_PATH)) throw new Error('Missing data/site_health.json');
  if (!fs.existsSync(ORIGIN_PATH)) throw new Error('Missing data/content_origin_report.json');
  if (!fs.existsSync(AUDIT_PATH)) throw new Error('Missing data/tos_content_audit.json');

  const health = readJson(HEALTH_PATH);
  const origin = readJson(ORIGIN_PATH);
  const audit = readJson(AUDIT_PATH);
  const coverage = origin.tos_coverage || {};
  const summary = audit.summary || {};
  const totalTos = Number(coverage.total_tos || summary.total_tos || 0);
  const withVerified = Number(coverage.with_verified_content || 0);
  const withEditorial = Number(coverage.with_editorial_content || 0);
  const requestOrStarterOnly = Number(coverage.with_only_starter_or_request || 0);
  const withoutAny = Number(coverage.without_any_content || 0);
  const withSubstantive = withVerified + withEditorial;
  const requestOnlyNews = Number(summary.request_only_news || 0);
  const requestOnlyDone = Number(summary.request_only_done || 0);
  const requestOnlyNeeds = Number(summary.request_only_needs || 0);
  const requestOnlyProjects = Number(summary.request_only_projects || 0);

  health.catalog = summary;
  syncScore(health, summary);
  syncPriorityTos(health, audit.items);
  health.audit_scope = unique([
    ...(health.audit_scope || []),
    'происхождение публикаций и разделение содержательных материалов, стартовых заготовок и редакционных запросов'
  ]);

  health.content_maturity = {
    generated_at: summary.generated_at || origin.generated_at || new Date().toISOString(),
    total_tos: totalTos,
    with_substantive_content: withSubstantive,
    with_verified_content: withVerified,
    with_editorial_content: withEditorial,
    with_only_starter_or_request: requestOrStarterOnly,
    without_any_content: withoutAny,
    request_only_by_section: {
      news: requestOnlyNews,
      done: requestOnlyDone,
      needs: requestOnlyNeeds,
      projects: requestOnlyProjects
    },
    editorial_request_records: summary.editorial_requests || {},
    definitions: origin.definitions || {}
  };

  health.findings = (health.findings || []).filter((item) => !['Контент', 'Зрелость контента', 'Редакционные запросы'].includes(item.area));
  health.findings.push({
    level: requestOrStarterOnly || withoutAny ? 'risk' : 'good',
    area: 'Зрелость контента',
    finding: `Содержательные материалы есть у ${withSubstantive} из ${totalTos} ТОС; только стартовые заготовки или запросы — у ${requestOrStarterOnly}; без материалов — у ${withoutAny}.`
  });
  health.findings.push({
    level: requestOnlyNews || requestOnlyDone || requestOnlyNeeds || requestOnlyProjects ? 'next' : 'good',
    area: 'Редакционные запросы',
    finding: `Запрос вместо содержательной записи: новости — ${requestOnlyNews}, результаты — ${requestOnlyDone}, потребности — ${requestOnlyNeeds}, проекты — ${requestOnlyProjects}.`
  });

  const actions = (health.recommended_actions || [])
    .filter((item) => !/превращать рабочие заготовки|замене стартовых заготовок|Заменить редакционные запросы|Собрать подтверждённые истории результата вместо заготовок|Проверить и оформить реальные актуальные потребности|Оформить проектные идеи с понятным статусом|Собрать первые содержательные материалы/i.test(item));
  if (requestOnlyNews) actions.push(`Заменить редакционные запросы содержательными новостями или фотоотчётами для ${requestOnlyNews} ТОС.`);
  if (requestOnlyDone) actions.push(`Собрать подтверждённые истории результата вместо заготовок для ${requestOnlyDone} ТОС.`);
  if (requestOnlyNeeds) actions.push(`Проверить и оформить реальные актуальные потребности для ${requestOnlyNeeds} ТОС, где пока есть только запрос сведений.`);
  if (requestOnlyProjects) actions.push(`Оформить проектные идеи с понятным статусом для ${requestOnlyProjects} ТОС, где пока есть только запрос.`);
  if (!requestOnlyNews && !requestOnlyDone && !requestOnlyNeeds && !requestOnlyProjects && withoutAny) {
    actions.push(`Собрать первые содержательные материалы для ${withoutAny} ТОС без публикаций.`);
  }
  health.recommended_actions = unique(actions);

  writeJson(HEALTH_PATH, health);
  console.log(`Site health content maturity enriched: substantive ${withSubstantive}/${totalTos}, request/starter only ${requestOrStarterOnly}, empty ${withoutAny}`);
}

main();
