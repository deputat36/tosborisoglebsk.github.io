const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const SOURCE_URL = 'https://riavrn.ru/news/v-borisoglebskom-sele-gubari-blagoustroili-territoriyu-u-kladbisha/';

const VERIFIED_NEWS_WAVE14 = [
  {
    id: 'gubari-svecha-pamyati-2026',
    status: 'published',
    content_origin: 'verified',
    date: '2026-08-20',
    updated_at: '2026-09-10',
    category: 'Реализованные проекты',
    tos_slug: 'gubari',
    title: 'В Губарях завершили проект ТОС «Свеча памяти»',
    lead: 'В селе Губари благоустроили территорию у центрального входа на кладбище и заасфальтировали подъезд в рамках проекта ТОС «Свеча памяти».',
    text: [
      '20 августа 2026 года РИА «Воронеж» сообщило о завершении благоустройства территории у входа на кладбище в селе Губари Борисоглебского городского округа.',
      'Работы выполнили в рамках проекта территориального общественного самоуправления «Свеча памяти». По данным источника, проект получил грантовую поддержку в размере 1 млн 456 тыс. рублей, а грант жители выиграли в мае 2026 года.',
      'Главной задачей проекта было создать удобный подъезд к кладбищу. Ранее дорога к центральному входу имела грунтовое покрытие и во время дождей становилась труднопроходимой; в ходе проекта участок заасфальтировали.',
      'РИА «Воронеж» также сообщает, что асфальтирование подъезда удалось выполнить за пять дней. Публикация используется как подтверждение конкретного результата проекта, но не как основание для изменения председателя, контактов, границ или иных паспортных данных ТОС.'
    ],
    source: 'РИА «Воронеж», 20 августа 2026 года',
    source_url: SOURCE_URL,
    project_id: 'gubari-svecha-pamyati-2026',
    done_id: 'gubari-svecha-pamyati-2026'
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
  const news = readJson(NEWS_PATH);
  if (!Array.isArray(news)) throw new Error(`${NEWS_PATH} must contain an array`);
  VERIFIED_NEWS_WAVE14.forEach((item) => upsertById(news, item));
  writeJson(NEWS_PATH, news);
  console.log(`Wave 14 verified news synchronized: ${VERIFIED_NEWS_WAVE14.map((item) => item.id).join(', ')}`);
}

main();

module.exports = { VERIFIED_NEWS_WAVE14, main, upsertById };
