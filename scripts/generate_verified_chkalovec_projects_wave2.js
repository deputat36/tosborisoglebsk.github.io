const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const DONE_PATH = path.join(ROOT, 'data', 'done.json');

const ID = 'chkalovec-parkovka-2021';
const SOURCE_URL = 'https://riavrn.ru/news/v-borisoglebske-aktivisty-mnogoetazhki-sdelali-asfaltirovannuyu-parkovku-na-30-avtomobilej/';
const SOURCE_LABEL = 'РИА «Воронеж», 23 июля 2021 года';

const NEWS_ITEM = {
  id: ID,
  status: 'published',
  content_origin: 'verified',
  date: '2021-07-23',
  updated_at: '2026-09-11',
  category: 'Реализованные проекты',
  tos_slug: 'chkalovec',
  title: 'ТОС «Чкаловец» благоустроил парковку и дорогу во дворе на Аэродромной',
  lead: 'В 2021 году активисты обустроили асфальтированную парковку на 30 автомобилей и прилегающую дорогу; площадь благоустроенной территории составила около 600 кв. м.',
  text: [
    '23 июля 2021 года РИА «Воронеж» сообщило о завершённом проекте ТОС «Чкаловец» во дворе многоэтажного дома на улице Аэродромной в Борисоглебске.',
    'На участке сделали асфальтированную парковку на 30 автомобилей и заасфальтировали дорогу рядом. Источник также сообщает об установке фонарей, устройстве клумбы и ограждения.',
    'Общая площадь благоустроенной территории составила около 600 кв. м. На проект ТОС получил грант около 790 тыс. рублей, ещё почти 180 тыс. рублей собрали жители.',
    'Управляющая компания помогла с вывозом сухостоя и покраской ограждения. Публикация фиксирует этот результат как третий проект общественников на тот момент.',
    'Историческая публикация используется только для описания конкретного проекта. Текущие персональные контакты и численность ТОС по ней не обновляются.'
  ],
  source: SOURCE_LABEL,
  source_url: SOURCE_URL
};

const PROJECT_ITEM = {
  id: ID,
  title: 'ТОС «Чкаловец»: парковка и благоустройство двора — 2021',
  type: 'Благоустройство и транспорт',
  status: 'published',
  project_kind: 'verified_actual',
  content_origin: 'verified',
  tos_slug: 'chkalovec',
  description: 'Асфальтированная парковка на 30 автомобилей, прилегающая дорога, освещение, клумба и ограждение на территории около 600 кв. м.',
  grant_logic: 'Источник сообщает грант около 790 тыс. рублей и вклад жителей почти 180 тыс. рублей. Эти суммы сохраняются как приблизительные и не складываются порталом в «точную общую стоимость».',
  based_on: `${SOURCE_LABEL}: публикация о завершённом благоустройстве, площади, вместимости парковки, составе работ и финансировании.`,
  official_result: 'Реализованный общественно полезный проект ТОС',
  grant_amount: 'около 790 000 рублей',
  implementation_status: 'Реализация подтверждена публикацией от 23 июля 2021 года: парковка и прилегающая территория благоустроены.',
  source: SOURCE_LABEL,
  source_url: SOURCE_URL,
  implementation_source: SOURCE_LABEL,
  implementation_source_url: SOURCE_URL,
  done_id: ID,
  steps: [
    'ТОС получил на благоустройство грант около 790 тыс. рублей.',
    'Жители собрали ещё почти 180 тыс. рублей.',
    'На территории около 600 кв. м заасфальтировали парковочную зону на 30 автомобилей и участок дороги.',
    'Установили фонари, сделали клумбу и ограждение.',
    'Управляющая компания помогла вывезти сухостой и покрасить ограждение.'
  ]
};

const DONE_ITEM = {
  id: ID,
  status: 'published',
  content_origin: 'verified',
  date: '2021-07-23',
  updated_at: '2026-09-11',
  tos_slug: 'chkalovec',
  type: 'Благоустройство и транспорт',
  title: 'ТОС «Чкаловец»: обустроена парковка на 30 автомобилей',
  summary: 'Во дворе дома на Аэродромной благоустроили около 600 кв. м: сделали парковку, дорогу, освещение, клумбу и ограждение.',
  before: 'На участке возникали лужи и грязь; неблагоустроенная часть двора отличалась от уже приведённых в порядок зон территории.',
  done: 'Заасфальтировали парковку на 30 автомобилей и прилегающую дорогу, установили фонари, обустроили клумбу и ограждение.',
  result: 'Около 600 кв. м дворовой территории получили твёрдое покрытие, парковочную функцию и дополнительное благоустройство.',
  participants: 'Актив ТОС «Чкаловец», жители дома и управляющая компания в пределах подтверждённой источником помощи.',
  source_label: SOURCE_LABEL,
  source_url: SOURCE_URL,
  needs_details: 'Для актуального архива полезны собственные разрешённые фотографии территории по годам и сведения о текущем состоянии покрытия, освещения и ограждения.'
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

  console.log(`Verified Chkalovec wave 2 synchronized: ${ID}`);
}

main();

module.exports = { ID, SOURCE_URL, SOURCE_LABEL, NEWS_ITEM, PROJECT_ITEM, DONE_ITEM, main, upsertById };
