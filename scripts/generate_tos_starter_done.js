const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const DONE_PATH = path.join(ROOT, 'data', 'done.json');
const DATE = '2026-06-16';

function readJson(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function doneId(tos) {
  return `result-archive-needed-${tos.slug}`;
}

function makeDone(tos) {
  const territory = tos.location || 'Борисоглебский городской округ';
  const boundaries = tos.boundaries || 'границы территории уточняются';
  return {
    id: doneId(tos),
    status: 'published',
    content_origin: 'request',
    date: DATE,
    tos_slug: tos.slug,
    type: 'Архив результата уточняется',
    title: `ТОС «${tos.name}»: собираем истории сделанного`,
    summary: `Для ТОС «${tos.name}» открыт рабочий материал для сбора историй результата: реализованных проектов, субботников, благоустройства, праздников, помощи жителям и других полезных дел на территории.`,
    before: `Территория: ${territory}. Границы: ${boundaries}. Для полноценного архива нужно собрать сведения о том, какие задачи жители уже решали вместе и какие результаты можно показать на портале.`,
    done: 'Материал создан как заготовка для сбора подтверждённых сведений. После получения информации сюда можно добавить конкретные проекты, даты, участников, фотографии и описание результата.',
    result: 'Карточка ТОС получит архив сделанного, который поможет показать опыт территории, подготовить новые заявки и сохранить историю работы актива.',
    participants: `Председатель, актив и жители ТОС «${tos.name}».`,
    source_label: 'Рабочая заготовка редакции портала ТОС БГО',
    source_url: `/tos/${tos.slug}/`,
    needs_details: 'Нужны конкретные факты: что сделано, год, место, кто участвовал, какие были партнёры, фото до/после и короткий комментарий председателя или актива.'
  };
}

function upsertById(items, item) {
  const index = items.findIndex((entry) => entry && entry.id === item.id);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.push(item);
}

function main() {
  const toses = readJson(TOSES_PATH).filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const done = readJson(DONE_PATH);
  let synchronized = 0;

  for (const tos of toses) {
    const starterId = doneId(tos);
    const existingStarter = done.find((item) => item && item.id === starterId);
    const hasFactualResult = done.some((item) => item && item.status !== 'draft' && item.tos_slug === tos.slug && item.id !== starterId && item.content_origin !== 'request');

    if (existingStarter || !hasFactualResult) {
      upsertById(done, makeDone(tos));
      synchronized += 1;
    }
  }

  writeJson(DONE_PATH, done);
  console.log(`Starter TOS result requests synchronized: ${synchronized}`);
}

main();
