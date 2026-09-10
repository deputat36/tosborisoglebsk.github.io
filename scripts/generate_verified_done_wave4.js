const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DONE_PATH = path.join(ROOT, 'data', 'done.json');
const SOURCE_URL = 'https://riavrn.ru/news/v-borisoglebskom-sele-gubari-blagoustroili-territoriyu-u-kladbisha/';

const VERIFIED_DONE_WAVE4 = [
  {
    id: 'gubari-svecha-pamyati-2026',
    status: 'published',
    content_origin: 'verified',
    date: '2026-08-20',
    updated_at: '2026-09-10',
    tos_slug: 'gubari',
    type: 'Реализованный проект',
    title: 'ТОС «Губари»: завершён проект «Свеча памяти»',
    summary: 'РИА «Воронеж» подтвердило завершение проекта «Свеча памяти»: у центрального входа на кладбище благоустроили территорию и заасфальтировали ранее грунтовый подъезд.',
    before: 'Подъезд к центральному входу на кладбище имел грунтовое покрытие и во время дождей становился труднопроходимым.',
    done: 'В 2026 году в рамках проекта «Свеча памяти» территорию у входа благоустроили, а подъезд заасфальтировали. По данным источника, само асфальтирование заняло пять дней.',
    result: 'Создан более удобный всесезонный подъезд к кладбищу. Источник указывает грантовую поддержку 1 456 000 рублей и сообщает о победе проекта в мае 2026 года.',
    participants: 'Актив ТОС «Губари», жители села и исполнители проекта.',
    source_label: 'РИА «Воронеж», 20 августа 2026 года',
    source_url: SOURCE_URL,
    needs_details: 'Для собственного архива полезны разрешённые фотографии территории до и после работ, точная протяжённость заасфальтированного участка и сведения о дальнейшем содержании подъезда.'
  }
];

function readJson(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function upsertById(items, item) {
  const index = items.findIndex((entry) => entry && entry.id === item.id);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.push(item);
}

function main() {
  const doneItems = readJson(DONE_PATH);
  if (!Array.isArray(doneItems)) throw new Error(`${DONE_PATH} must contain an array`);

  VERIFIED_DONE_WAVE4.forEach((item) => upsertById(doneItems, item));
  writeJson(DONE_PATH, doneItems);
  console.log(`Verified done wave 4 synchronized: ${VERIFIED_DONE_WAVE4.map((item) => item.id).join(', ')}`);
}

main();

module.exports = { VERIFIED_DONE_WAVE4, main, upsertById };
