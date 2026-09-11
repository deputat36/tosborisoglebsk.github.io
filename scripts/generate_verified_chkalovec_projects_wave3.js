const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const DONE_PATH = path.join(ROOT, 'data', 'done.json');

const ID = 'chkalovec-russkie-tradicii-2023';
const SOURCE_URL = 'https://borisoglebsk.riavrn.ru/news/u-nas-vse-poluchaetsya-potomu-chto-my-vmeste-kak-voronezhskij-tos-kardinalno-uluchshil-pridomovuyu-territoriyu/';
const SOURCE_LABEL = 'РИА «Воронеж», 8 ноября 2024 года';

const NEWS_ITEM = {
  id: ID,
  status: 'published',
  content_origin: 'verified',
  date: '2024-11-08',
  updated_at: '2026-09-11',
  category: 'Реализованные проекты',
  tos_slug: 'chkalovec',
  title: 'ТОС «Чкаловец» реализовал культурный проект «Русские традиции — в каждый ТОС»',
  lead: 'РИА «Воронеж» подтверждает, что в 2023 году активисты ТОС «Чкаловец» реализовали проект «Русские традиции — в каждый ТОС» и приобрели звуковое оборудование и костюмы для мероприятий.',
  text: [
    'В обзорном материале от 8 ноября 2024 года РИА «Воронеж» отдельно фиксирует проект ТОС «Чкаловец», реализованный в 2023 году под названием «Русские традиции — в каждый ТОС».',
    'В рамках проекта активисты приобрели необходимое звуковое оборудование и костюмы для проведения мероприятий.',
    'Источник описывает проект как часть последовательной работы ТОС по развитию дворовой территории и общественной жизни жителей дома на улице Аэродромной.',
    'Отдельная сумма гранта, стоимость оборудования и количество костюмов в публикации не указаны. Портал не дополняет эти сведения предположениями.',
    'Исторический материал используется для фиксации конкретного результата 2023 года и не применяется для автоматического обновления текущих персональных данных ТОС.'
  ],
  source: SOURCE_LABEL,
  source_url: SOURCE_URL
};

const PROJECT_ITEM = {
  id: ID,
  title: 'ТОС «Чкаловец»: «Русские традиции — в каждый ТОС» — 2023',
  type: 'Культура и местные традиции',
  status: 'published',
  project_kind: 'verified_actual',
  content_origin: 'verified',
  tos_slug: 'chkalovec',
  description: 'Культурный проект ТОС «Чкаловец», в рамках которого для проведения мероприятий приобрели звуковое оборудование и сценические костюмы.',
  grant_logic: 'Источник подтверждает реализацию проекта и приобретение оборудования и костюмов, но не указывает отдельную сумму финансирования. Портал не восстанавливает смету по косвенным данным.',
  based_on: `${SOURCE_LABEL}: ретроспективный материал о проектах ТОС «Чкаловец», прямо указывающий реализацию проекта в 2023 году.`,
  official_result: 'Реализованный общественно полезный культурный проект ТОС',
  implementation_status: 'Реализация подтверждена источником: в 2023 году закуплены звуковое оборудование и костюмы для мероприятий.',
  source: SOURCE_LABEL,
  source_url: SOURCE_URL,
  implementation_source: SOURCE_LABEL,
  implementation_source_url: SOURCE_URL,
  done_id: ID,
  steps: [
    'ТОС подготовил культурный проект «Русские традиции — в каждый ТОС».',
    'В 2023 году проект был реализован.',
    'Для мероприятий приобрели необходимое звуковое оборудование.',
    'Для проведения культурных программ приобрели костюмы.',
    'Проект вошёл в последовательную линейку инициатив ТОС «Чкаловец», подтверждённую ретроспективным материалом РИА «Воронеж».'
  ]
};

const DONE_ITEM = {
  id: ID,
  status: 'published',
  content_origin: 'verified',
  date: '2024-11-08',
  updated_at: '2026-09-11',
  tos_slug: 'chkalovec',
  type: 'Культура и местные традиции',
  title: 'ТОС «Чкаловец»: реализован проект «Русские традиции — в каждый ТОС»',
  summary: 'В 2023 году ТОС реализовал культурный проект и приобрёл звуковое оборудование и костюмы для проведения мероприятий.',
  before: 'Для регулярных культурных и общественных мероприятий требовалось собственное оснащение.',
  done: 'Приобрели необходимое звуковое оборудование и костюмы для проведения мероприятий.',
  result: 'У ТОС появилась материальная база для собственных культурных программ и мероприятий жителей.',
  participants: 'Актив ТОС «Чкаловец» и жители, участвующие в общественных и культурных мероприятиях.',
  source_label: SOURCE_LABEL,
  source_url: SOURCE_URL,
  needs_details: 'Для расширения архива полезны конкурсная заявка, точная смета, перечень приобретённого оборудования, количество костюмов и разрешённые фотографии мероприятий.'
};

function readArray(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`${path.relative(ROOT, filePath)} must contain an array`);
  return value;
}

function upsertById(items, item) {
  const index = items.findIndex((entry) => entry && entry.id === item.id);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.push(item);
}

function main() {
  const news = readArray(NEWS_PATH);
  const projects = readArray(PROJECTS_PATH);
  const done = readArray(DONE_PATH);

  upsertById(news, NEWS_ITEM);
  upsertById(projects, PROJECT_ITEM);
  upsertById(done, DONE_ITEM);

  fs.writeFileSync(NEWS_PATH, `${JSON.stringify(news, null, 2)}\n`, 'utf8');
  fs.writeFileSync(PROJECTS_PATH, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
  fs.writeFileSync(DONE_PATH, `${JSON.stringify(done, null, 2)}\n`, 'utf8');

  console.log(`Verified Chkalovec wave 3 synchronized: ${ID}`);
}

main();

module.exports = { ID, SOURCE_URL, SOURCE_LABEL, NEWS_ITEM, PROJECT_ITEM, DONE_ITEM, main, upsertById };
