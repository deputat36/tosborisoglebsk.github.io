const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');

const VERIFIED_NEWS_WAVE13 = [
  {
    id: 'mechta-spring-competition-2021',
    status: 'published',
    content_origin: 'verified',
    date: '2021-10-27',
    updated_at: '2026-09-07',
    category: 'Архив конкурсов',
    tos_slug: 'mechta',
    title: 'ТОС «Мечта»: проект благоустройства родника победил в конкурсе 2021 года',
    lead: '«Блокнот Борисоглебск» включил ТОС «Мечта» из села Чигорак в перечень победителей областного конкурса общественно полезных инициатив 2021 года.',
    text: [
      '27 октября 2021 года «Блокнот Борисоглебск» сообщил, что 22 ТОС Борисоглебского городского округа стали победителями областного конкурса общественно полезных инициатив 2021 года.',
      'В опубликованном перечне для ТОС «Мечта» из села Чигорак указан проект благоустройства родника.',
      'Источник подтверждает конкурсный результат и название инициативы, но не содержит достаточных данных, чтобы автоматически считать благоустройство завершённым. Поэтому материал фиксирует именно победу проекта в конкурсе.',
      'Публикация не используется для подтверждения актуального председателя, контактов, численности жителей, границ или иных паспортных полей карточки ТОС. Текст и фотографии источника на портал не копируются.'
    ],
    source: '«Блокнот Борисоглебск», 27 октября 2021 года',
    source_url: 'https://bloknotborisoglebsk.ru/news/v-sele-pod-borisoglebskom-postavili-novyy-vezdnoy--1407840'
  },
  {
    id: 'prostornyy-cultural-festival-2025',
    status: 'published',
    content_origin: 'verified',
    date: '2025-12-15',
    updated_at: '2026-09-07',
    category: 'События ТОС',
    tos_slug: 'prostornyy',
    title: 'Представители ТОС «Просторный» участвовали в фестивале ТОС в Борисоглебске',
    lead: 'РИА «Воронеж» подтвердило участие представителей ТОС «Просторный» в общей творческой постановке команды Борисоглебского округа на фестивале «Культурный ТОС, объединяющий соседей».',
    text: [
      '15 декабря 2025 года РИА «Воронеж» сообщило об итогах фестиваля «Культурный ТОС, объединяющий соседей», который прошёл в Борисоглебске 12 декабря. Сборная команда ТОС Борисоглебского городского округа стала победителем фестиваля.',
      'В отдельной музыкальной номинации победили представители ТОСов «Богана», «Миролюбие» и «Махровка». Этот результат не приписывается ТОС «Просторный».',
      'Представители ТОС «Просторный» участвовали в постановке «Маленькие ТОСовцы за чистоту!» вместе с представителями ТОСов «Чкаловец», «Богана», «Махровка», «Миролюбие» и «Уютный».',
      'Источник подтверждает участие представителей ТОС в общем культурном событии, но не используется для верификации председателя, контактов, границ, численности или иных паспортных полей карточки. Текст и фотографии РИА «Воронеж» на портал не копируются.'
    ],
    source: 'РИА «Воронеж», 15 декабря 2025 года',
    source_url: 'https://riavrn.ru/news/komanda-tos-iz-borisoglebska-pobedila-v-mezhregionalnom-tvorcheskom-festivale/'
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

  VERIFIED_NEWS_WAVE13.forEach((item) => upsertById(news, item));
  writeJson(NEWS_PATH, news);
  console.log(`Wave 13 verified news synchronized: ${VERIFIED_NEWS_WAVE13.map((item) => item.id).join(', ')}`);
}

require('./generate_verified_news_wave14');
main();

module.exports = { VERIFIED_NEWS_WAVE13, main, upsertById };
