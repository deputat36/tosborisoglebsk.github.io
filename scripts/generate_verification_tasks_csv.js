const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'data', 'tos_content_audit.json');
const OUT = path.join(ROOT, 'data', 'verification_tasks.csv');
const SITE_URL = 'https://tosborisoglebsk.ru';

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function priorityRank(priority) {
  if (priority === 'Высокий') return 1;
  if (priority === 'Средний') return 2;
  return 3;
}

function buildTaskText(item) {
  const missing = (item.missing || []).join(', ') || 'критичных пропусков нет';
  return `Проверить карточку ТОС «${item.name}»: ${missing}. Уточнить только сведения, которые можно публиковать открыто.`;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.log('No tos_content_audit.json found, skip verification tasks CSV.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const items = Array.isArray(data.items) ? data.items : [];

  const rows = items
    .filter((item) => item.priority === 'Высокий' || (item.missing || []).length || item.verification?.status !== 'verified')
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (a.score || 0) - (b.score || 0) || String(a.name).localeCompare(String(b.name), 'ru'))
    .map((item) => ({
      priority: item.priority || '',
      name: item.name || '',
      slug: item.slug || '',
      location: item.location || '',
      chairperson: item.chairperson || '',
      score: item.score ?? '',
      verification: item.verification?.label || item.verification?.status || '',
      missing: item.missing || [],
      recommendations: item.recommendations || [],
      card_url: `${SITE_URL}/tos/${item.slug}/`,
      update_url: `${SITE_URL}/update-tos/`,
      task: buildTaskText(item)
    }));

  const header = [
    'Приоритет',
    'ТОС',
    'Slug',
    'Территория',
    'Председатель / контактное лицо',
    'Заполненность',
    'Статус проверки',
    'Что уточнить',
    'Рекомендации',
    'Карточка',
    'Форма обновления',
    'Задача'
  ];

  const lines = [header.map(csvCell).join(';')];
  for (const row of rows) {
    lines.push([
      row.priority,
      row.name,
      row.slug,
      row.location,
      row.chairperson,
      row.score,
      row.verification,
      row.missing,
      row.recommendations,
      row.card_url,
      row.update_url,
      row.task
    ].map(csvCell).join(';'));
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `\uFEFF${lines.join('\n')}\n`, 'utf8');
  console.log(`Generated verification tasks CSV: ${rows.length} rows.`);
}

main();
