const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');
const DATE = '2026-06-16';

const VERIFIED_NEWS = {
  id: 'mirolyubie-project-winner-2026',
  status: 'published',
  content_origin: 'verified',
  date: '2026-06-24',
  category: 'Конкурсы',
  tos_slug: 'mirolyubie',
  title: 'Проект ТОС «Миролюбие» победил в конкурсе ТОС 2026 года',
  lead: 'Официальный протокол подтверждает победу проекта «Играй и побеждай» и грант 1 489 360 рублей.',
  text: [
    'Официальный перечень победителей опубликован 22 мая 2026 года. В строке Борисоглебского городского округа указаны ТОС «Миролюбие», проект «Играй и побеждай» и сумма 1 489 360 рублей.',
    'Ранее проект был представлен на очной защите инициатив ТОС. По опубликованному описанию он связан с созданием безопасных условий для катания на роликах, самокатах и скейтбордах.',
    'Дата начала работ, календарный план, текущий статус реализации и фотографии проекта пока не подтверждены. Эти сведения будут добавлены после прямого подтверждения ТОС и проверки разрешений на публикацию.',
    'До получения подтверждения портал не утверждает, что работы уже начались или завершены.'
  ],
  source: 'Официальный протокол победителей конкурса общественно полезных проектов ТОС 2026 года',
  source_url: 'https://obraz36.ru/site_data/s273/2026/2026/%D0%9F%D0%BE%D0%B1%D0%B5%D0%B4%D0%B8%D1%82%D0%B5%D0%BB%D0%B8%20%D0%A2%D0%9E%D0%A1%202026.pdf'
};

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
    content_origin: 'request',
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
  let synchronized = 0;

  upsertById(news, VERIFIED_NEWS);

  for (const tos of toses) {
    const starterId = newsId(tos);
    const existingStarter = news.find((item) => item && item.id === starterId);
    const hasFactualNews = news.some((item) => item && item.status !== 'draft' && item.tos_slug === tos.slug && item.id !== starterId && item.content_origin !== 'request');

    if (existingStarter || !hasFactualNews) {
      upsertById(news, makeNews(tos));
      synchronized += 1;
    }
  }

  writeJson(NEWS_PATH, news);
  console.log(`Verified news synchronized: ${VERIFIED_NEWS.id}`);
  console.log(`Starter TOS news synchronized: ${synchronized}`);
}

main();
