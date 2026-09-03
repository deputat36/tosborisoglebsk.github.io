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
  updated_at: '2026-08-20',
  category: 'Конкурсы',
  tos_slug: 'mirolyubie',
  title: 'ТОС «Миролюбие» реализовал проект «Играй и побеждай» в 2026 году',
  lead: 'Официальный протокол подтверждает грант 1 489 360 рублей, а публикация РИА «Воронеж» от 20 августа 2026 года — завершение площадки площадью 960 кв. м.',
  text: [
    'Официальный перечень победителей, опубликованный 22 мая 2026 года, подтверждает победу ТОС «Миролюбие» с проектом «Играй и побеждай» и точную сумму гранта 1 489 360 рублей.',
    '20 августа 2026 года РИА «Воронеж» сообщило со ссылкой на председателя ТОС, что проект реализован: в посёлке Миролюбие благоустроена многофункциональная площадка для катания на роликах, самокатах и скейтбордах общей площадью 960 кв. м.',
    'По данным РИА «Воронеж», работы заняли около полутора месяцев. В расчистке территории участвовали взрослые и дети: собирали мусор, убирали кусты и ветки перед благоустройством площадки.',
    'В публикации СМИ сумма гранта округлена до 1 млн 489 тыс. рублей. На портале сохранена точная сумма 1 489 360 рублей из первичного официального перечня победителей. Текст и фотографии СМИ на портал не копируются.'
  ],
  source: 'Официальный протокол победителей конкурса общественно полезных проектов ТОС 2026 года',
  source_url: 'https://obraz36.ru/site_data/s273/2026/2026/%D0%9F%D0%BE%D0%B1%D0%B5%D0%B4%D0%B8%D1%82%D0%B5%D0%BB%D0%B8%20%D0%A2%D0%9E%D0%A1%202026.pdf',
  implementation_source: 'РИА «Воронеж», 20 августа 2026 года',
  implementation_source_url: 'https://riavrn.ru/news/v-borisoglebskom-poselke-mirolyubie-blagoustroili-ploshadku-dlya-kataniya-na-rolikah/'
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
