const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const DONE_PATH = path.join(ROOT, 'data', 'done.json');

const ECO_ID = 'chkalovec-cvetik-semicvetik-2022';
const ECO_SOURCE_URL = 'https://riavrn.ru/news/v-borisoglebske-poyavilas-pervaya-v-okruge-ekoploshadka-dlya-razdelnogo-sbora-musora/';
const ECO_SOURCE_LABEL = 'РИА «Воронеж», 26 августа 2022 года';

const CENTER_ID = 'chkalovec-centr-prityazheniya-2024';
const CENTER_SOURCE_URL = 'https://borisoglebsk.riavrn.ru/news/v-borisoglebske-obshestvenniki-blagoustroili-mesto-dlya-kulturnogo-dosuga/';
const CENTER_SOURCE_LABEL = 'РИА «Воронеж», 4 сентября 2024 года';
const CENTER_RESULT_URL = 'https://riavrn.ru/news/u-nas-vse-poluchaetsya-potomu-chto-my-vmeste-kak-voronezhskij-tos-kardinalno-uluchshil-pridomovuyu-territoriyu/';
const CENTER_RESULT_LABEL = 'РИА «Воронеж», 8 ноября 2024 года';

const NEWS_ITEMS = [
  {
    id: ECO_ID,
    status: 'published',
    content_origin: 'verified',
    date: '2022-08-26',
    updated_at: '2026-09-10',
    category: 'Реализованные проекты',
    tos_slug: 'chkalovec',
    title: 'ТОС «Чкаловец» открыл первую в БГО экоплощадку для раздельного сбора отходов',
    lead: 'Во дворе дома №22 на улице Аэродромной появилась экоплощадка «Цветик-семицветик»: 150 кв. м благоустроенной территории и семь контейнеров для раздельного сбора.',
    text: [
      '26 августа 2022 года во дворе дома №22 на улице Аэродромной открыли экоплощадку для раздельного сбора отходов. РИА «Воронеж» назвало её первой площадкой такого типа в Борисоглебском городском округе.',
      'Территорию площадью 150 кв. м выложили плиткой и установили семь контейнеров для нескольких фракций отходов. В более поздней публикации РИА проект назван «Цветик-семицветик».',
      'ТОС «Чкаловец» получил на проект грант 994 тыс. рублей. Более 350 тыс. рублей вложили жильцы дома; источник также сообщает о спонсорской помощи без отдельной суммы.',
      'Материал фиксирует конкретный реализованный проект. Сведения о текущих персональных контактах и численности ТОС по исторической публикации автоматически не обновляются.'
    ],
    source: ECO_SOURCE_LABEL,
    source_url: ECO_SOURCE_URL
  },
  {
    id: CENTER_ID,
    status: 'published',
    content_origin: 'verified',
    date: '2024-11-08',
    updated_at: '2026-09-10',
    category: 'Реализованные проекты',
    tos_slug: 'chkalovec',
    title: 'ТОС «Чкаловец» создал центр «Связь поколений» для мероприятий жителей',
    lead: 'Закрытая беседка «Центр притяжения — связь поколений» стала местом для культурных, патриотических и обучающих мероприятий жителей дома на Аэродромной, 22.',
    text: [
      'В 2024 году ТОС «Чкаловец» реализовал проект «Центр притяжения — связь поколений» во дворе дома №22 на улице Аэродромной. Для жителей появилось некапитальное закрытое помещение, не зависящее от погодных условий.',
      'Центр оснастили звуковым оборудованием, видеонаблюдением и освещением, установили мягкую мебель, шкафы и столы. На прилегающей территории высадили хвойные деревья, розы и кустарники.',
      'Публикация РИА «Воронеж» от 8 ноября 2024 года подтверждает, что открытие центра состоялось в октябре и площадка использовалась для мероприятия ко Дню пожилого человека.',
      'Отдельная публикация РИА от 4 сентября 2024 года сообщает о финансировании: 1 млн рублей областного гранта и около 165 тыс. рублей вклада жильцов.'
    ],
    source: CENTER_RESULT_LABEL,
    source_url: CENTER_RESULT_URL
  }
];

const PROJECT_ITEMS = [
  {
    id: ECO_ID,
    title: 'ТОС «Чкаловец»: экоплощадка «Цветик-семицветик»',
    type: 'Экология и благоустройство',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'chkalovec',
    description: 'Первая в Борисоглебском городском округе экоплощадка для раздельного сбора отходов: 150 кв. м территории с плиточным покрытием и семью контейнерами.',
    grant_logic: 'Источник прямо сообщает сумму гранта и вклад жильцов; спонсорская помощь упомянута без отдельной суммы и поэтому не оценивается порталом.',
    based_on: `${ECO_SOURCE_LABEL}: публикация об открытии площадки и финансировании проекта.`,
    official_result: 'Реализованный общественно полезный проект ТОС',
    grant_amount: '994 000 рублей',
    implementation_status: 'Реализация подтверждена: экоплощадка открыта 26 августа 2022 года.',
    source: ECO_SOURCE_LABEL,
    source_url: ECO_SOURCE_URL,
    implementation_source: ECO_SOURCE_LABEL,
    implementation_source_url: ECO_SOURCE_URL,
    done_id: ECO_ID,
    steps: [
      'Активисты разработали проект площадки с учётом санитарных, пожарных и экологических требований.',
      'ТОС получил грант 994 тыс. рублей; жильцы вложили более 350 тыс. рублей, также привлекалась спонсорская помощь.',
      'Территорию площадью 150 кв. м выложили плиткой.',
      'Установили семь контейнеров для раздельного сбора нескольких фракций отходов.',
      '26 августа 2022 года площадку открыли для жителей.'
    ]
  },
  {
    id: CENTER_ID,
    title: 'ТОС «Чкаловец»: «Центр притяжения — связь поколений»',
    type: 'Общественное пространство и культура',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'chkalovec',
    description: 'Закрытое некапитальное пространство для культурных, патриотических и обучающих мероприятий жителей дома №22 на улице Аэродромной.',
    grant_logic: 'Публикация от 4 сентября 2024 года прямо сообщает 1 млн рублей областного гранта и около 165 тыс. рублей вклада жильцов; более поздняя публикация подтверждает открытие и использование центра.',
    based_on: `${CENTER_SOURCE_LABEL}: финансирование и оснащение; ${CENTER_RESULT_LABEL}: открытие и фактическое использование.`,
    official_result: 'Реализованный общественно полезный проект ТОС',
    grant_amount: '1 000 000 рублей',
    implementation_status: 'Реализация подтверждена: центр обустроен, открыт в 2024 году и использовался для общественных мероприятий.',
    source: CENTER_SOURCE_LABEL,
    source_url: CENTER_SOURCE_URL,
    implementation_source: CENTER_RESULT_LABEL,
    implementation_source_url: CENTER_RESULT_URL,
    done_id: CENTER_ID,
    steps: [
      'ТОС победил в конкурсе общественно полезных проектов и получил областной грант 1 млн рублей.',
      'Около 165 тыс. рублей добавили жильцы дома.',
      'Помещение оснастили звуковым оборудованием, видеонаблюдением, освещением, мебелью, шкафами и столами.',
      'Рядом выполнили озеленение; сентябрьская публикация отдельно фиксирует посадку 22 хвойных деревьев.',
      'Более поздняя публикация РИА подтверждает открытие центра и проведение в нём мероприятия ко Дню пожилого человека.'
    ]
  }
];

const DONE_ITEMS = [
  {
    id: ECO_ID,
    status: 'published',
    content_origin: 'verified',
    date: '2022-08-26',
    updated_at: '2026-09-10',
    tos_slug: 'chkalovec',
    type: 'Экология и благоустройство',
    title: 'ТОС «Чкаловец»: создана экоплощадка «Цветик-семицветик»',
    summary: 'Во дворе дома на Аэродромной, 22 появилась первая в БГО площадка для раздельного сбора отходов.',
    before: 'Жителям требовалось отдельное благоустроенное место для сортировки и раздельного накопления отходов.',
    done: 'Площадку площадью 150 кв. м выложили плиткой и установили семь контейнеров для разных фракций отходов.',
    result: 'Проект создал локальную инфраструктуру для раздельного сбора и стал первым подобным примером в Борисоглебском городском округе.',
    participants: 'Актив ТОС «Чкаловец», жители дома и партнёры проекта.',
    source_label: ECO_SOURCE_LABEL,
    source_url: ECO_SOURCE_URL,
    needs_details: 'Для актуального архива полезны собственные фотографии площадки по годам и сведения о её текущем использовании и обслуживании.'
  },
  {
    id: CENTER_ID,
    status: 'published',
    content_origin: 'verified',
    date: '2024-11-08',
    updated_at: '2026-09-10',
    tos_slug: 'chkalovec',
    type: 'Общественное пространство и культура',
    title: 'ТОС «Чкаловец»: открыт «Центр притяжения — связь поколений»',
    summary: 'У жителей появилось закрытое благоустроенное пространство для культурных, патриотических и обучающих мероприятий.',
    before: 'Для мероприятий жителям не хватало места, где можно собираться независимо от погоды.',
    done: 'Установили закрытую беседку, оснастили её звуком, видеонаблюдением, освещением и мебелью, благоустроили и озеленили прилегающую территорию.',
    result: 'Центр начал использоваться для общественных мероприятий; ноябрьская публикация РИА подтверждает проведение праздника ко Дню пожилого человека.',
    participants: 'Актив ТОС «Чкаловец», жители дома и участники общественных мероприятий.',
    source_label: CENTER_RESULT_LABEL,
    source_url: CENTER_RESULT_URL,
    needs_details: 'Для архива проекта полезны разрешённые фотографии мероприятий, конкурсная заявка, смета и сведения о текущей программе центра.'
  }
];

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

  NEWS_ITEMS.forEach((item) => upsert(news, item));
  PROJECT_ITEMS.forEach((item) => upsert(projects, item));
  DONE_ITEMS.forEach((item) => upsert(done, item));

  fs.writeFileSync(NEWS_PATH, `${JSON.stringify(news, null, 2)}\n`, 'utf8');
  fs.writeFileSync(PROJECTS_PATH, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
  fs.writeFileSync(DONE_PATH, `${JSON.stringify(done, null, 2)}\n`, 'utf8');
  console.log(`Verified Chkalovets projects synchronized: ${[ECO_ID, CENTER_ID].join(', ')}`);
}

main();

module.exports = { ECO_ID, CENTER_ID, NEWS_ITEMS, PROJECT_ITEMS, DONE_ITEMS, main };
