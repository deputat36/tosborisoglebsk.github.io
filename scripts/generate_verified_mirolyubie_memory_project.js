const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const DONE_PATH = path.join(ROOT, 'data', 'done.json');
const ID = 'mirolyubie-blagodarim-pomnim-gordimsya-2022';
const SOURCE_URL = 'https://riavrn.ru/news/pamyatnik-selskim-truzhenikam-otkryli-v-borisoglebskom-poselke-mirolyubie/';
const SOURCE_LABEL = 'РИА «Воронеж», 28 ноября 2022 года';

const NEWS_ITEM = {
  id: ID,
  status: 'published',
  content_origin: 'verified',
  date: '2022-11-28',
  updated_at: '2026-09-10',
  category: 'Реализованные проекты',
  tos_slug: 'mirolyubie',
  title: 'ТОС «Миролюбие» реализовал проект «Благодарим, помним и гордимся»',
  lead: 'РИА «Воронеж» подтвердило благоустройство общественного пространства и открытие памятника сельским труженикам в посёлке Миролюбие.',
  text: [
    '26 ноября 2022 года в посёлке Миролюбие торжественно открыли памятник сельским труженикам. Памятный знак стал частью проекта ТОС «Миролюбие» «Благодарим, помним и гордимся».',
    'По данным источника, территория была благоустроена в 2021 году: появились дорожки, альпийская горка, лавочки, урны, светильники, клумбы, деревья и кованое ограждение. Проект предусматривал и установку памятника.',
    'На проект направили более 500 тыс. рублей: 251,2 тыс. рублей грантовых средств, 254,2 тыс. рублей спонсорской помощи и 30 тыс. рублей, собранных жителями.',
    'Материал используется для подтверждения конкретного проекта и его результата. Он не используется для автоматического обновления действующего председателя, контактов, границ или иных паспортных полей ТОС.'
  ],
  source: SOURCE_LABEL,
  source_url: SOURCE_URL
};

const PROJECT_ITEM = {
  id: ID,
  title: 'ТОС «Миролюбие»: «Благодарим, помним и гордимся»',
  type: 'Благоустройство и историческая память',
  status: 'published',
  project_kind: 'verified_actual',
  content_origin: 'verified',
  tos_slug: 'mirolyubie',
  description: 'Проект объединил благоустройство общественного пространства и установку памятника сельским труженикам. Территорию благоустроили в 2021 году, памятник открыли 26 ноября 2022 года.',
  grant_logic: 'Источник прямо приводит структуру финансирования реализованного проекта; суммы фиксируются как подтверждённые публикацией, а не как оценка портала.',
  based_on: `${SOURCE_LABEL}: публикация о завершённом благоустройстве и открытии памятника.`,
  official_result: 'Реализованный общественно полезный проект ТОС',
  grant_amount: '251 200 рублей',
  implementation_status: 'Реализация подтверждена: территория благоустроена, памятник сельским труженикам открыт 26 ноября 2022 года.',
  source: SOURCE_LABEL,
  source_url: SOURCE_URL,
  implementation_source: SOURCE_LABEL,
  implementation_source_url: SOURCE_URL,
  done_id: ID,
  steps: [
    'ТОС подготовил проект «Благодарим, помним и гордимся» и получил грантовую поддержку.',
    'В 2021 году благоустроили территорию: дорожки, места отдыха, освещение, озеленение и ограждение.',
    '26 ноября 2022 года открыли памятник сельским труженикам.',
    'Источник указывает 251,2 тыс. рублей гранта, 254,2 тыс. рублей спонсорского вклада и 30 тыс. рублей средств жителей.'
  ]
};

const DONE_ITEM = {
  id: ID,
  status: 'published',
  content_origin: 'verified',
  date: '2022-11-28',
  updated_at: '2026-09-10',
  tos_slug: 'mirolyubie',
  type: 'Благоустройство и историческая память',
  title: 'ТОС «Миролюбие»: благоустроена территория и открыт памятник сельским труженикам',
  summary: 'В рамках проекта «Благодарим, помним и гордимся» активисты благоустроили общественное пространство, а в ноябре 2022 года открыли памятник сельским труженикам.',
  before: 'Проект был направлен на создание благоустроенного места общественного отдыха и сохранение памяти о людях, трудившихся на благо села и страны.',
  done: 'Территорию вымостили дорожками, установили лавочки, урны и светильники, выполнили озеленение и ограждение. 26 ноября 2022 года открыли памятник сельским труженикам.',
  result: 'Посёлок получил благоустроенное общественное пространство и памятный объект. Подтверждённая источником структура финансирования: 251,2 тыс. рублей гранта, 254,2 тыс. рублей спонсоров и 30 тыс. рублей жителей.',
  participants: 'Актив ТОС «Миролюбие», жители посёлка и партнёры проекта.',
  source_label: SOURCE_LABEL,
  source_url: SOURCE_URL,
  needs_details: 'Для собственного архива ТОС полезны разрешённые фотографии этапов проекта, документы по проекту и сведения о текущем состоянии благоустроенной территории.'
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
  console.log(`Verified Mirolyubie memory project synchronized: ${ID}`);
}

main();

module.exports = { ID, NEWS_ITEM, PROJECT_ITEM, DONE_ITEM, main };
