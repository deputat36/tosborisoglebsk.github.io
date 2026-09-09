const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');

const VERIFIED_PROJECTS_WAVE3 = [
  {
    id: 'severnyy-39-detskaya-ploshchadka-2021',
    title: 'ТОС «Северный 39»: второй этап детской площадки',
    type: 'Благоустройство и детская инфраструктура',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'severnyy-39',
    description: 'В 2021 году ТОС «Северный 39» продолжил благоустройство детской площадки: на ней установили новое игровое и спортивное оборудование.',
    grant_logic: 'РИА «Воронеж» указывает грант 414 тыс. рублей на этап 2021 года и сообщает о предыдущем гранте 400 тыс. рублей в 2018 году; здесь фиксируется фактически реализованный второй этап.',
    based_on: 'РИА «Воронеж», 21 сентября 2021 года: публикация об установленном оборудовании и двух грантовых этапах благоустройства площадки.',
    grant_amount: '414 тыс. рублей гранта на этап 2021 года по данным источника',
    implementation_status: 'Реализация подтверждена: на детской площадке установлено новое игровое и спортивное оборудование.',
    implementation_source: 'РИА «Воронеж», 21 сентября 2021 года',
    implementation_source_url: 'https://riavrn.ru/news/na-detskoj-ploshadke-v-mikrorajone-borisoglebska-ustanovili-novoe-igrovoe-oborudovanie/',
    done_id: 'severnyy-39-playground',
    steps: [
      'В 2018 году территория получила первый грант на развитие детской площадки.',
      'В 2021 году второй грантовый этап позволил установить новое игровое и спортивное оборудование.',
      '21 сентября 2021 года РИА «Воронеж» сообщило о выполненных работах и размере гранта второго этапа.'
    ]
  },
  {
    id: 'tretyaki-vodonapornaya-bashnya-2024',
    title: 'ТОС «Третьяки»: новая водонапорная башня',
    type: 'Инфраструктура и водоснабжение',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'tretyaki',
    description: 'В 2024 году в селе Третьяки установили новую водонапорную башню — очередной инфраструктурный проект местного ТОС.',
    grant_logic: 'РИА «Воронеж» сообщает об областном гранте 820 тыс. рублей и более 100 тыс. рублей вклада жителей и спонсоров; это параметры уже реализованного объекта.',
    based_on: 'РИА «Воронеж», 9 сентября 2024 года: публикация об установленной новой водонапорной башне в селе Третьяки.',
    grant_amount: '820 тыс. рублей областного гранта по данным источника',
    implementation_status: 'Реализация подтверждена: в селе установлена новая водонапорная башня.',
    implementation_source: 'РИА «Воронеж», 9 сентября 2024 года',
    implementation_source_url: 'https://riavrn.ru/news/v-borisoglebskom-sele-tretyaki-ustanovili-vodonapornuyu-bashnyu/',
    done_id: 'tretyaki-seven-projects',
    steps: [
      'Проект был направлен на обновление важного объекта системы водоснабжения села.',
      'В 2024 году в Третьяках установили новую водонапорную башню.',
      '9 сентября 2024 года РИА «Воронеж» подтвердило завершение объекта и параметры его финансирования.'
    ]
  },
  {
    id: 'tancyrey-vyezdnaya-stela-2021',
    title: 'ТОС «Танцырей»: въездная стела с символами села',
    type: 'Благоустройство и идентичность территории',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'tancyrey',
    description: 'В октябре 2021 года в Танцырее установили въездную стелу высотой около 5 м, оформленную с использованием местных символов.',
    grant_logic: 'РИА «Воронеж» сообщает об областном гранте 173 тыс. рублей и ещё примерно 50 тыс. рублей средств жителей и спонсоров; это финансирование уже установленного объекта.',
    based_on: 'РИА «Воронеж», 28 октября 2021 года: публикация об установленной въездной стеле в селе Танцырей.',
    grant_amount: '173 тыс. рублей областного гранта по данным источника',
    implementation_status: 'Реализация подтверждена: 25 октября 2021 года установлена въездная стела высотой около 5 м.',
    implementation_source: 'РИА «Воронеж», 28 октября 2021 года',
    implementation_source_url: 'https://borisoglebsk.riavrn.ru/news/vuezdnuyu-stelu-ustanovili-obshestvenniki-v-borisoglebskom-sele-tancyrej/',
    done_id: 'tancyrey-playgrounds-rest-places',
    steps: [
      'Инициатива была направлена на создание заметной въездной группы с символами села.',
      '25 октября 2021 года в Танцырее установили стелу высотой около 5 м.',
      '28 октября 2021 года РИА «Воронеж» опубликовало сведения о завершённом проекте и его финансировании.'
    ]
  },
  {
    id: 'mahrovka-vyezdnaya-stela-2023',
    title: 'ТОС «Махровка»: въездная стела после доработки проекта',
    type: 'Благоустройство и идентичность территории',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'mahrovka',
    description: 'В 2023 году в Махровке установили новую въездную стелу после того, как доработанный проект получил поддержку с третьей конкурсной попытки.',
    grant_logic: 'РИА «Воронеж» указывает грант 499 тыс. рублей, 150 тыс. рублей спонсорского вклада и 50 тыс. рублей средств жителей; эти суммы относятся к уже реализованной въездной группе.',
    based_on: 'РИА «Воронеж», 7 ноября 2023 года: публикация об установленной въездной стеле и истории доработки проекта.',
    grant_amount: '499 тыс. рублей гранта по данным источника',
    implementation_status: 'Реализация подтверждена: в 2023 году в Махровке установлена новая въездная стела.',
    implementation_source: 'РИА «Воронеж», 7 ноября 2023 года',
    implementation_source_url: 'https://riavrn.ru/news/vuezdnuyu-stelu-ustanovili-v-borisoglebskom-sele-mahrovka/',
    done_id: 'mahrovka-project-experience',
    steps: [
      'Проект въездной группы дважды подавался на конкурс и был доработан перед следующей попыткой.',
      'После получения поддержки в 2023 году в Махровке установили новую въездную стелу.',
      '7 ноября 2023 года РИА «Воронеж» подтвердило завершённый объект и структуру его финансирования.'
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

  for (const verifiedProject of VERIFIED_PROJECTS_WAVE3) {
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
  console.log(`Verified projects wave 3 synchronized: ${VERIFIED_PROJECTS_WAVE3.map((item) => item.id).join(', ')}`);
}

require('./generate_verified_projects_wave4');
main();

module.exports = { VERIFIED_PROJECTS_WAVE3 };
