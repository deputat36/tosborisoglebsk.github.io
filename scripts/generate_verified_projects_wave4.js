const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');

const VERIFIED_PROJECTS_WAVE4 = [
  {
    id: 'gubari-vodonapornaya-bashnya-2021',
    title: 'ТОС «Губари»: замена водонапорной башни',
    type: 'Инфраструктура и водоснабжение',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'gubari',
    description: 'В 2021 году в селе Губари заменили водонапорную башню; позднейшая публикация РИА «Воронеж» приводит этот объект среди реализованных проектов территории.',
    grant_logic: 'Источник подтверждает факт выполненного инфраструктурного проекта, но в используемом материале портала не зафиксирована отдельная сумма финансирования именно этой башни, поэтому она не указывается.',
    based_on: 'РИА «Воронеж», 3 июля 2026 года: публикация о результатах развития села Губари, включая замену водонапорной башни в 2021 году.',
    implementation_status: 'Реализация подтверждена: в 2021 году в селе заменена водонапорная башня.',
    implementation_source: 'РИА «Воронеж», 3 июля 2026 года',
    implementation_source_url: 'https://borisoglebsk.riavrn.ru/news/komissiya-konkursa-samoe-krasivoe-selo-voronezhskoj-oblasti-posetila-borisoglebskoe-selo-gubari/',
    done_id: 'gubari-projects-archive',
    steps: [
      'ТОС и жители последовательно работали над объектами системы водоснабжения села.',
      'В 2021 году в Губарях заменили водонапорную башню.',
      '3 июля 2026 года РИА «Воронеж» включило этот результат в обзор реализованных проектов территории.'
    ]
  },
  {
    id: 'vostochnyy-obshchestvennaya-zona-2020',
    title: 'ТОС «Восточный»: благоустройство общественной зоны',
    type: 'Соседское благоустройство',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'vostochnyy',
    description: 'Весной 2020 года жители ТОС «Восточный» благоустроили общественную зону между улицами Весенней и Объездной после серии из четырёх субботников.',
    grant_logic: 'Публикация описывает работы, выполненные жителями преимущественно собственными силами и за собственные средства; грантовая сумма для этого конкретного результата не заявляется.',
    based_on: 'РИА «Воронеж», 18 мая 2020 года: публикация о благоустройстве территории микрорайона силами активистов ТОС «Восточный».',
    implementation_status: 'Реализация подтверждена: проведены четыре субботника, расчищена территория, установлены лавки, урна, спортивный комплекс и обустроена песочница.',
    implementation_source: 'РИА «Воронеж», 18 мая 2020 года',
    implementation_source_url: 'https://riavrn.ru/news/v-borisoglebske-aktivisty-svoimi-silami-blagoustroili-territoriyu-mikrorayona/',
    done_id: 'vostochnyy-cleanups-holidays',
    steps: [
      'Жители провели четыре субботника на общественной территории между улицами Весенней и Объездной.',
      'Были расчищены аллея и территория, установлены лавки, урна, спортивный комплекс и песочница.',
      '18 мая 2020 года РИА «Воронеж» сообщило о выполненном благоустройстве и участии жителей.'
    ]
  },
  {
    id: 'mayak-dvorik-detstva-2024',
    title: 'ТОС «Маяк»: детская площадка «Дворик детства»',
    type: 'Благоустройство и детская инфраструктура',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'mayak',
    description: 'Осенью 2024 года в селе Чигорак ТОС «Маяк» обустроил детскую площадку «Дворик детства» после победы проекта в областном конкурсе общественно полезных инициатив.',
    grant_logic: 'РИА «Воронеж» подтверждает сам реализованный объект и конкурсный контекст; отдельная сумма финансирования в этом project-паспорте не приводится без более точного первичного документа.',
    based_on: 'РИА «Воронеж», 20 мая 2025 года: публикация о реализованных проектах ТОС «Маяк» в селе Чигорак.',
    implementation_status: 'Реализация подтверждена: осенью 2024 года обустроена детская площадка «Дворик детства».',
    implementation_source: 'РИА «Воронеж», 20 мая 2025 года',
    implementation_source_url: 'https://riavrn.ru/news/edinstvo-i-polza-mayaka-kak-aktivisty-voronezhskogo-tosa-blagoustraivayut-svoe-selo/',
    done_id: 'chigorak-tos-cultural-work',
    steps: [
      'ТОС «Маяк» подготовил проект детской площадки для села Чигорак.',
      'После победы в областном конкурсе осенью 2024 года площадка «Дворик детства» была обустроена.',
      '20 мая 2025 года РИА «Воронеж» подтвердило этот результат в обзоре работы ТОС.'
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

  for (const verifiedProject of VERIFIED_PROJECTS_WAVE4) {
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
  console.log(`Verified projects wave 4 synchronized: ${VERIFIED_PROJECTS_WAVE4.map((item) => item.id).join(', ')}`);
}

main();

module.exports = { VERIFIED_PROJECTS_WAVE4 };
