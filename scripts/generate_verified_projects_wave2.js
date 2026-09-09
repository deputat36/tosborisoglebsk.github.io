const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');

const VERIFIED_PROJECTS_WAVE2 = [
  {
    id: 'bogana-universalnaya-sportploshchadka-2023',
    title: 'ТОС «Богана»: универсальная спортивная площадка',
    type: 'Благоустройство и спорт',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'bogana',
    description: 'В 2023 году в селе Богана построили и открыли универсальную спортивную площадку площадью более 900 кв. м; реализацию проекта подтверждает публикация РИА «Воронеж».',
    grant_logic: 'Публикация о реализованном объекте сообщает о грантовой поддержке свыше 940 тыс. рублей, а также о вкладе жителей и спонсоров; это описание фактического финансирования, а не оценка заявки.',
    based_on: 'РИА «Воронеж», 4 сентября 2023 года: публикация об открытии универсальной спортивной площадки в селе Богана.',
    grant_amount: 'Более 940 тыс. рублей грантовой поддержки по данным источника',
    implementation_status: 'Реализация подтверждена: открыта универсальная спортивная площадка площадью более 900 кв. м.',
    implementation_source: 'РИА «Воронеж», 4 сентября 2023 года',
    implementation_source_url: 'https://riavrn.ru/news/v-borisoglebskom-sele-bogana-postroili-universalnuyu-sportploshadku/',
    done_id: 'result-archive-needed-bogana',
    steps: [
      'В 2023 году в селе Богана была построена универсальная спортивная площадка.',
      'Площадь объекта, по данным источника, превышает 900 кв. м.',
      '4 сентября 2023 года РИА «Воронеж» сообщило об открытии площадки и участии жителей и партнёров проекта.'
    ]
  },
  {
    id: 'kalinka-territoriya-detskogo-zdorovya-2024',
    title: 'ТОС «Калинка»: «Территория детского здоровья»',
    type: 'Благоустройство и детская инфраструктура',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'kalinka',
    description: 'В посёлке Калинино ТОС «Калинка» реализовал проект «Территория детского здоровья»: на пустыре появилась первая оборудованная детская площадка.',
    grant_logic: 'РИА «Воронеж» указывает областную грантовую поддержку свыше 800 тыс. рублей и собственный вклад жителей; эти сведения фиксируют опубликованные параметры реализованного проекта.',
    based_on: 'РИА «Воронеж», 19 декабря 2024 года: публикация о первой детской площадке в посёлке Калинино.',
    grant_amount: 'Свыше 800 тыс. рублей областной грантовой поддержки по данным источника',
    implementation_status: 'Реализация подтверждена: в посёлке Калинино оборудована первая детская площадка.',
    implementation_source: 'РИА «Воронеж», 19 декабря 2024 года',
    implementation_source_url: 'https://riavrn.ru/news/v-borisoglebskom-poselke-kalinino-na-pustyre-poyavilas-pervaya-detskaya-ploshadka/',
    done_id: 'result-archive-needed-kalinka',
    steps: [
      'ТОС «Калинка» подготовил проект «Территория детского здоровья» для создания детского пространства.',
      'На территории посёлка Калинино была оборудована первая детская площадка.',
      '19 декабря 2024 года РИА «Воронеж» опубликовало материал о реализованном объекте и его финансировании.'
    ]
  },
  {
    id: 'petrovskoe-remont-skvazhiny-2023',
    title: 'ТОС «Петровское»: ремонт водозаборной скважины №1',
    type: 'Инфраструктура и водоснабжение',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'petrovskoe',
    description: 'В 2023 году в селе Петровское завершили ремонт водозаборной скважины №1 с заменой труб, фильтров, насоса, станции управления и защиты.',
    grant_logic: 'РИА «Воронеж» сообщает о гранте свыше 460 тыс. рублей и ещё 56 тыс. рублей вклада жителей и спонсоров; это подтверждённые публикацией параметры выполненного инфраструктурного проекта.',
    based_on: 'РИА «Воронеж», 24 августа 2023 года: публикация о завершённом ремонте водозаборной скважины в селе Петровское.',
    grant_amount: 'Свыше 460 тыс. рублей гранта по данным источника',
    implementation_status: 'Реализация подтверждена: заменены 36 м труб, фильтры, насос, станция управления и защиты и другие элементы скважины №1.',
    implementation_source: 'РИА «Воронеж», 24 августа 2023 года',
    implementation_source_url: 'https://riavrn.ru/news/v-borisoglebskom-sele-petrovskoe-otremontirovali-vodozabornuyu-skvazhinu/',
    done_id: 'result-archive-needed-petrovskoe',
    steps: [
      'В рамках проекта был выполнен ремонт водозаборной скважины №1 в селе Петровское.',
      'Источник подтверждает замену 36 м труб, фильтров, насоса и оборудования управления и защиты.',
      '24 августа 2023 года РИА «Воронеж» сообщило о завершении инфраструктурных работ.'
    ]
  },
  {
    id: 'ulyanovka-sportploshchadka-2020',
    title: 'ТОС «Ульяновка»: спортивная площадка площадью 800 кв. м',
    type: 'Благоустройство и спорт',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'ulyanovka',
    description: 'В 2020 году в селе Ульяновка построили спортивную площадку площадью 800 кв. м общей стоимостью около 2,8 млн рублей.',
    grant_logic: 'Публикация РИА «Воронеж» описывает уже построенный объект и несколько источников его финансирования; здесь фиксируется подтверждённая реализация, а не предполагаемый грантовый результат.',
    based_on: 'РИА «Воронеж», 21 сентября 2020 года: публикация о построенной спортивной площадке в селе Ульяновка.',
    implementation_status: 'Реализация подтверждена: построена спортивная площадка площадью 800 кв. м общей стоимостью около 2,8 млн рублей.',
    implementation_source: 'РИА «Воронеж», 21 сентября 2020 года',
    implementation_source_url: 'https://riavrn.ru/news/v-borisoglebskom-sele-ulyanovka-postroili-sportploshchadku-za-2-8-mln-rubley/',
    done_id: 'result-archive-needed-ulyanovka',
    steps: [
      'В 2020 году в селе Ульяновка была построена спортивная площадка.',
      'Площадь объекта составляет 800 кв. м, а опубликованная общая стоимость — около 2,8 млн рублей.',
      '21 сентября 2020 года РИА «Воронеж» сообщило о завершённом спортивном объекте и источниках его финансирования.'
    ]
  }
];

function readProjects() {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('data/projects.json must contain an array');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function main() {
  const projects = readProjects();
  let changed = false;

  for (const verifiedProject of VERIFIED_PROJECTS_WAVE2) {
    const index = projects.findIndex((item) => item && item.id === verifiedProject.id);
    if (index === -1) {
      projects.push(verifiedProject);
      changed = true;
      continue;
    }

    const current = projects[index];
    const next = { ...current, ...verifiedProject };
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      projects[index] = next;
      changed = true;
    }
  }

  if (changed) fs.writeFileSync(PROJECTS_PATH, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
  console.log(`Verified projects wave 2 synchronized: ${VERIFIED_PROJECTS_WAVE2.map((item) => item.id).join(', ')}`);
}

require('./generate_verified_projects_wave3');
main();

module.exports = { VERIFIED_PROJECTS_WAVE2 };
