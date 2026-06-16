const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const DATE = '2026-06-16';

function readJson(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function newsId(tos) {
  return `send-news-${tos.slug}-2026`;
}

function makeNews(tos) {
  const location = tos.location || 'Борисоглебский городской округ';
  return {
    id: newsId(tos),
    status: 'published',
    date: DATE,
    category: 'Сбор материалов',
    tos_slug: tos.slug,
    title: `ТОС «${tos.name}» приглашает присылать новости и фото`,
    lead: `Для карточки ТОС «${tos.name}» нужны новости, фотографии, сведения о проектах, потребностях и предложениях жителей.`,
    text: [
      `ТОС «${tos.name}» находится на территории: ${location}. Для наполнения карточки на портале ТОС БГО нужны реальные материалы о жизни территории.`,
      'Жители, председатель и актив могут присылать короткие новости, фото субботников, собраний, праздников, благоустройства, реализованных проектов, а также предложения по будущим инициативам.',
      'Лучший формат новости: что произошло, где и когда, кто участвовал, какой результат получили жители, кого нужно поблагодарить и какие фотографии можно опубликовать.',
      'Материалы можно направить через сообщество ВКонтакте ТОС БГО или через форму обновления карточки на сайте.'
    ],
    source: 'Редакция портала ТОС БГО',
    source_url: 'https://vk.ru/tosbgo'
  };
}

function upsertById(items, item) {
  const index = items.findIndex((entry) => entry && entry.id === item.id);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.push(item);
}

function main() {
  const toses = readJson(TOSES_PATH).filter((tos) => tos && tos.slug && tos.status !== 'draft');
  const news = readJson(NEWS_PATH);
  let created = 0;

  for (const tos of toses) {
    const hasLinkedNews = news.some((item) => item && item.status !== 'draft' && item.tos_slug === tos.slug);
    if (hasLinkedNews) continue;
    upsertById(news, makeNews(tos));
    created += 1;
  }

  writeJson(NEWS_PATH, news);
  console.log(`Starter TOS news generated or updated: ${created}`);
}

main();
