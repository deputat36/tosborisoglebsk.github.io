const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const DONE_PATH = path.join(ROOT, 'data', 'done.json');
const ID = 'kalinka-kolodec-dusha-poselka-2023';
const SOURCE_URL = 'https://riavrn.ru/news/v-borisoglebskom-poselke-kalinino-pochistili-3-kolodca/';
const SOURCE_LABEL = 'РИА «Воронеж», 21 ноября 2023 года';

const NEWS_ITEM = {
  id: ID,
  status: 'published',
  content_origin: 'verified',
  date: '2023-11-21',
  updated_at: '2026-09-10',
  category: 'Реализованные проекты',
  tos_slug: 'kalinka',
  title: 'ТОС «Калинка» благоустроил три колодца в посёлке Калинино',
  lead: 'В рамках проекта «Колодец — душа поселка» жители очистили и благоустроили три колодца; источник подтверждает областной грант 280 тыс. рублей и 30 тыс. рублей вклада жителей.',
  text: [
    'В посёлке Калинино Борисоглебского городского округа ТОС «Калинка» реализовал проект «Колодец — душа поселка». По данным РИА «Воронеж», были очищены и благоустроены три колодца.',
    'Рабочие очистили колодцы, восстановили колодезные ворота и сделали домики сверху. Жители благоустроили прилегающую территорию, забетонировали подходы и установили лавочки.',
    'На реализацию проекта направили областной грант 280 тыс. рублей. Дополнительно жители вложили 30 тыс. рублей собственных средств.',
    'Публикация также сообщает, что ТОС «Калинка» был создан жителями посёлка Калинино в 2020 году. Эти стабильные исторические сведения используются для частичной проверки карточки ТОС; численность и персональные сведения по публикации 2023 года не считаются автоматически актуальными на 2026 год.'
  ],
  source: SOURCE_LABEL,
  source_url: SOURCE_URL
};

const PROJECT_ITEM = {
  id: ID,
  title: 'ТОС «Калинка»: «Колодец — душа поселка»',
  type: 'Благоустройство и водоснабжение',
  status: 'published',
  project_kind: 'verified_actual',
  content_origin: 'verified',
  tos_slug: 'kalinka',
  description: 'Реализованный проект по очистке и благоустройству трёх колодцев в посёлке Калинино: восстановлены ворота и верхние домики, забетонированы подходы, установлены лавочки.',
  grant_logic: 'Источник прямо сообщает сумму областного гранта и вклад жителей; суммы фиксируются как подтверждённые публикацией.',
  based_on: `${SOURCE_LABEL}: публикация о выполненных работах и финансировании проекта.`,
  official_result: 'Реализованный общественно полезный проект ТОС',
  grant_amount: '280 000 рублей',
  implementation_status: 'Реализация подтверждена публикацией: три колодца очищены и благоустроены, прилегающая территория приведена в порядок.',
  source: SOURCE_LABEL,
  source_url: SOURCE_URL,
  implementation_source: SOURCE_LABEL,
  implementation_source_url: SOURCE_URL,
  done_id: ID,
  steps: [
    'ТОС «Калинка» подготовил проект «Колодец — душа поселка» и получил областной грант.',
    'Три колодца очистили, восстановили колодезные ворота и верхние домики.',
    'Подходы к колодцам забетонировали, рядом установили лавочки.',
    'Источник указывает 280 тыс. рублей гранта и 30 тыс. рублей собственных средств жителей.'
  ]
};

const DONE_ITEM = {
  id: ID,
  status: 'published',
  content_origin: 'verified',
  date: '2023-11-21',
  updated_at: '2026-09-10',
  tos_slug: 'kalinka',
  type: 'Благоустройство и водоснабжение',
  title: 'ТОС «Калинка»: очищены и благоустроены три колодца',
  summary: 'Проект «Колодец — душа поселка» помог восстановить три старых колодца и благоустроить территорию вокруг них.',
  before: 'Колодцам было более 40 лет, они нуждались в очистке и восстановлении элементов конструкции и прилегающей территории.',
  done: 'Колодцы очистили, восстановили ворота и домики сверху, подходы забетонировали, рядом установили лавочки.',
  result: 'Жители сохранили резервные источники воды и благоустроили места общего пользования. По источнику: 280 тыс. рублей областного гранта и 30 тыс. рублей средств жителей.',
  participants: 'Актив ТОС «Калинка», жители посёлка и привлечённые рабочие.',
  source_label: SOURCE_LABEL,
  source_url: SOURCE_URL,
  needs_details: 'Для расширения архива полезны разрешённые фотографии до/после, конкурсные документы и сведения о текущем состоянии колодцев.'
};

function readArray(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`${file} must contain an array`);
  return data;
}

function upsert(items, item) {
  const index = items.findIndex((entry) => entry && entry.id === item.id);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.push(item);
}

function main() {
  const news = readArray(NEWS_PATH);
  const projects = readArray(PROJECTS_PATH);
  const done = readArray(DONE_PATH);
  upsert(news, NEWS_ITEM);
  upsert(projects, PROJECT_ITEM);
  upsert(done, DONE_ITEM);
  fs.writeFileSync(NEWS_PATH, `${JSON.stringify(news, null, 2)}\n`, 'utf8');
  fs.writeFileSync(PROJECTS_PATH, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
  fs.writeFileSync(DONE_PATH, `${JSON.stringify(done, null, 2)}\n`, 'utf8');
  console.log(`Verified Kalinka wells project synchronized: ${ID}`);
}

main();

module.exports = { ID, NEWS_ITEM, PROJECT_ITEM, DONE_ITEM, main };
