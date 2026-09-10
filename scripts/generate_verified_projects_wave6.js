const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const SOURCE_URL = 'https://riavrn.ru/news/v-borisoglebskom-sele-gubari-blagoustroili-territoriyu-u-kladbisha/';
const SOURCE_LABEL = 'РИА «Воронеж», 20 августа 2026 года';

const VERIFIED_PROJECTS_WAVE6 = [
  {
    id: 'gubari-svecha-pamyati-2026',
    title: 'ТОС «Губари»: проект «Свеча памяти»',
    type: 'Благоустройство и доступность',
    status: 'published',
    project_kind: 'verified_actual',
    content_origin: 'verified',
    tos_slug: 'gubari',
    description: 'В августе 2026 года в селе Губари завершили проект ТОС «Свеча памяти»: территорию у центрального входа на кладбище благоустроили, а ранее грунтовый подъезд заасфальтировали.',
    grant_logic: 'РИА «Воронеж» сообщает, что проект получил грантовую поддержку в размере 1 456 000 рублей и что жители выиграли грант в мае 2026 года.',
    based_on: 'Публикация РИА «Воронеж» от 20 августа 2026 года прямо подтверждает завершение благоустройства территории у входа на кладбище и асфальтирование подъезда.',
    official_result: 'Завершено благоустройство территории у центрального входа на кладбище',
    grant_amount: '1 456 000 рублей',
    implementation_status: 'Реализация подтверждена: подъезд к кладбищу заасфальтирован; по данным источника, работы по асфальтированию выполнили за пять дней.',
    source: SOURCE_LABEL,
    source_url: SOURCE_URL,
    implementation_source: SOURCE_LABEL,
    implementation_source_url: SOURCE_URL,
    done_id: 'gubari-svecha-pamyati-2026',
    steps: [
      'В мае 2026 года жители Губарей выиграли грант на реализацию проекта «Свеча памяти».',
      'Главной задачей проекта было сделать удобный подъезд к центральному входу на кладбище вместо грунтового участка, который становился труднопроходимым во время дождей.',
      'К 20 августа 2026 года благоустройство было завершено; подъезд заасфальтировали, а само асфальтирование, по данным источника, заняло пять дней.'
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

  for (const verifiedProject of VERIFIED_PROJECTS_WAVE6) {
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
  console.log(`Verified projects wave 6 synchronized: ${VERIFIED_PROJECTS_WAVE6.map((item) => item.id).join(', ')}`);
}

main();

module.exports = { VERIFIED_PROJECTS_WAVE6 };
