const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const NEEDS_PATH = path.join(ROOT, 'data', 'needs.json');
const PROJECTS_PATH = path.join(ROOT, 'data', 'projects.json');
const DATE = '2026-06-16';
const CONTACT = 'Ирина Алексеевна Сотниченко, +7 (910) 249-82-84, https://vk.ru/tosbgo';

function readJson(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function arr(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function missingFor(tos) {
  const missing = [];
  if (!arr(tos.phones).length) missing.push('телефон для публикации');
  if (!arr(tos.emails).length) missing.push('email для связи');
  if (!arr(tos.social_links).length) missing.push('ссылка на группу или страницу ТОС');
  if (!String(tos.logo || '').trim()) missing.push('логотип');
  return missing;
}

function priorityFor(tos) {
  const missing = missingFor(tos);
  if (missing.includes('телефон для публикации') || missing.includes('ссылка на группу или страницу ТОС')) return 'Высокий';
  if (missing.length) return 'Средний';
  return 'Низкий';
}

function needId(tos) {
  return `update-data-${tos.slug}-2026`;
}

function projectId(tos) {
  return `public-stand-and-ideas-${tos.slug}`;
}

function makeNeed(tos) {
  const missing = missingFor(tos);
  const missingText = missing.length ? missing.join(', ') : 'подтверждение актуальности сведений';
  return {
    id: needId(tos),
    status: 'published',
    date: DATE,
    tos_slug: tos.slug,
    title: `Нужно уточнить данные и материалы ТОС «${tos.name}»`,
    description: `Для карточки ТОС «${tos.name}» нужно собрать или подтвердить сведения: ${missingText}. Также полезно прислать 3–5 фотографий территории, новость о работе ТОС, сведения о реализованных проектах и актуальных потребностях жителей.`,
    need_type: 'Актуализация карточки ТОС',
    priority: priorityFor(tos),
    contact: CONTACT,
    source: 'Автоматический аудит каталога ТОС',
    source_url: 'https://vk.ru/tosbgo'
  };
}

function makeProject(tos) {
  return {
    id: projectId(tos),
    title: `Информационный стенд и сбор инициатив ТОС «${tos.name}»`,
    type: 'Коммуникации и публичность',
    status: 'published',
    tos_slug: tos.slug,
    description: `Стартовая проектная идея для ТОС «${tos.name}»: оформить понятную точку информирования жителей о границах ТОС, контактах председателя, новостях, планах, QR-коде на карточку территории и способах предложить инициативу.`,
    grant_logic: 'Проект повышает открытость ТОС, помогает вовлекать жителей, собирать предложения, информировать людей без постоянного доступа к соцсетям и фиксировать работу территории.',
    based_on: 'Сформировано как базовая проектная идея для карточки ТОС, чтобы у каждой территории была точка старта для обсуждения инициатив и публичности.',
    steps: [
      'Проверить и подтвердить актуальные данные карточки ТОС.',
      'Выбрать место для информирования жителей: стенд, доска объявлений, подъезд, общественное место или онлайн-группа.',
      'Подготовить краткий текст: название ТОС, границы, председатель, контакты, ссылка или QR-код на карточку.',
      'Собрать от жителей 3–5 первоочередных предложений по территории.',
      'Опубликовать новость о запуске сбора инициатив и передать материал на портал ТОС БГО.',
      'Обновлять информацию после собраний, субботников, проектов и важных решений.'
    ]
  };
}

function upsertById(items, item) {
  const index = items.findIndex((entry) => entry && entry.id === item.id);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.push(item);
}

function main() {
  const toses = readJson(TOSES_PATH).filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const needs = readJson(NEEDS_PATH);
  const projects = readJson(PROJECTS_PATH);

  let needCount = 0;
  let projectCount = 0;

  for (const tos of toses) {
    if (!needs.some((need) => need && need.tos_slug === tos.slug)) {
      upsertById(needs, makeNeed(tos));
      needCount += 1;
    }
    if (!projects.some((project) => project && project.tos_slug === tos.slug)) {
      upsertById(projects, makeProject(tos));
      projectCount += 1;
    }
  }

  writeJson(NEEDS_PATH, needs);
  writeJson(PROJECTS_PATH, projects);

  console.log(`Starter TOS needs generated or updated: ${needCount}`);
  console.log(`Starter TOS projects generated or updated: ${projectCount}`);
}

main();
