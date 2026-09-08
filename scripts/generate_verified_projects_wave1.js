const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');

const VERIFIED_PROJECTS = [
  {
    id: 'mirolyubie-igray-i-pobezhday-2026',
    title: 'ТОС «Миролюбие»: проект «Играй и побеждай»',
    type: 'Благоустройство и спорт',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'mirolyubie',
    description: 'Проект ТОС «Миролюбие» «Играй и побеждай» стал победителем конкурса общественно полезных проектов ТОС 2026 года, а к августу была благоустроена площадка для роликов, самокатов и скейтбордов площадью 960 кв. м.',
    grant_logic: 'Официальный протокол конкурса подтверждает статус победителя и сумму гранта 1 489 360 рублей; это поле фиксирует подтверждённый грантовый результат, а не оценку критериев заявки.',
    based_on: 'Официальный перечень победителей АНО «Образ Будущего» от 22 мая 2026 года и публикация РИА «Воронеж» от 20 августа 2026 года о завершённой площадке.',
    official_result: 'Победитель конкурса общественно полезных проектов ТОС 2026 года',
    grant_amount: '1 489 360 рублей',
    implementation_status: 'Реализация подтверждена вторичным источником: благоустроена площадка площадью 960 кв. м.',
    source: 'АНО «Образ Будущего», официальный перечень победителей, 22 мая 2026 года',
    source_url: 'https://obraz36.ru/site_data/s273/2026/2026/%D0%9F%D0%BE%D0%B1%D0%B5%D0%B4%D0%B8%D1%82%D0%B5%D0%BB%D0%B8%20%D0%A2%D0%9E%D0%A1%202026.pdf',
    implementation_source: 'РИА «Воронеж», 20 августа 2026 года',
    implementation_source_url: 'https://riavrn.ru/news/v-borisoglebskom-poselke-mirolyubie-blagoustroili-ploshadku-dlya-kataniya-na-rolikah/',
    done_id: 'result-archive-needed-mirolyubie',
    steps: [
      '22 мая 2026 года официальный протокол конкурса зафиксировал победу проекта и грант 1 489 360 рублей.',
      'По данным РИА «Воронеж», работы по созданию площадки заняли около полутора месяцев, а жители участвовали в подготовке территории.',
      '20 августа 2026 года региональное СМИ сообщило о благоустроенной площадке площадью 960 кв. м для роликов, самокатов и скейтбордов.'
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

  for (const verifiedProject of VERIFIED_PROJECTS) {
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
  console.log(`Verified projects wave 1 synchronized: ${VERIFIED_PROJECTS.map((item) => item.id).join(', ')}`);
}

main();

module.exports = { VERIFIED_PROJECTS };
