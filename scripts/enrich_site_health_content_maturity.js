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

  health.audit_scope = unique([
    ...(health.audit_scope || []),
    'происхождение публикаций и разделение содержательных материалов, стартовых заготовок и редакционных запросов'
  ]);

  health.content_maturity = {
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

  health.findings = (health.findings || []).filter((item) => item.area !== 'Контент');
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
    .filter((item) => !/превращать рабочие заготовки|замене стартовых заготовок/i.test(item));
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
