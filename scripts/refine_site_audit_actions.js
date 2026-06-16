const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_AUDIT_PATH = path.join(ROOT, 'data', 'site_audit.json');

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  const audit = readJson(SITE_AUDIT_PATH, {});
  const summary = audit.summary || {};
  const actions = [];

  if (Number(summary.stale_count || 0) > 0) actions.push('повторно проверить карточки с устаревшей датой');
  if (Number(summary.high_priority || 0) > 0) actions.push('уточнить контакты и ключевые сведения ТОСов с высоким приоритетом');
  if (Number(summary.without_phone || 0) > 0) actions.push('получить телефоны для публикации у карточек без контакта');
  if (Number(summary.without_social || 0) > 0) actions.push('добавить группы, страницы или чаты ТОСов, где они есть');
  if (Number(summary.without_news || 0) > 0) actions.push('добавить новости для ТОСов без публикаций');
  if (Number(summary.without_done || 0) > 0) actions.push('собрать истории результата для ТОСов без раздела «Сделано»');
  if (Number(summary.without_needs || 0) > 0) actions.push('подготовить актуальные потребности территорий');
  if (Number(summary.without_projects || 0) > 0) actions.push('добавить проектные идеи или инициативы');
  if (Number(summary.verified_count || 0) < Number(summary.total_tos || 0)) actions.push('указать источник и дату проверки сведений по карточкам ТОС');
  actions.push('загрузить реальные логотипы ТОСов и фотографии территорий по мере поступления');
  actions.push('заменять стартовые заготовки на подтверждённые новости, проекты и фотоотчёты');

  audit.next_actions = [...new Set(actions)];
  writeJson(SITE_AUDIT_PATH, audit);
  console.log(`Site audit next actions refined: ${audit.next_actions.length}`);
}

main();
