const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');

const ID = 'gubari-v-rabochiy-polden-2026';
const SOURCE_URL = 'https://borisoglebsk.riavrn.ru/news/proekt-v-rabochij-polden-zapustili-v-borisoglebskom-sele-gubari/';
const SOURCE_LABEL = 'РИА «Воронеж», 26 июня 2026 года';

const NEWS_ITEM = {
  id: ID,
  status: 'published',
  content_origin: 'verified',
  date: '2026-06-26',
  updated_at: '2026-09-11',
  category: 'Жизнь территории',
  tos_slug: 'gubari',
  title: 'В Губарях запустили еженедельный проект «В рабочий полдень»',
  lead: 'Раз в неделю через уличные колонки жители села узнают главные местные новости, слышат поздравления юбиляров и рассказы о земляках, внесших вклад в жизнь Губарей.',
  text: [
    '26 июня 2026 года РИА «Воронеж» сообщило о запуске в селе Губари проекта «В рабочий полдень». Программа выходит еженедельно по пятницам через уличные колонки.',
    'Суть проекта — коротко рассказывать жителям о главных новостях села, поздравлять юбиляров и отмечать земляков, внесших вклад в местную жизнь.',
    'Подборку новостей готовит и зачитывает художественный руководитель Губаревского дома культуры. Один из выпусков был посвящён Дню медицинского работника, другой — выпускникам школы.',
    'Источник связывает запуск проекта с сельской территорией и работой Губаревского дома культуры; ТОС «Губари» организатором в публикации не назван. Поэтому портал размещает материал как подтверждённую новость территории, связанную с карточкой Губарей, а не как реализованный проект ТОС.',
    'Такое разграничение позволяет собирать полезную хронику территории и одновременно не приписывать ТОС действия, которые первичный источник ему не приписывает.'
  ],
  source: SOURCE_LABEL,
  source_url: SOURCE_URL
};

function readArray(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`${path.relative(ROOT, filePath)} must contain an array`);
  return value;
}

function upsertById(items, item) {
  const index = items.findIndex((entry) => entry && entry.id === item.id);
  if (index >= 0) items[index] = { ...items[index], ...item };
  else items.push(item);
}

function main() {
  const news = readArray(NEWS_PATH);
  upsertById(news, NEWS_ITEM);
  fs.writeFileSync(NEWS_PATH, `${JSON.stringify(news, null, 2)}\n`, 'utf8');
  console.log(`Verified Gubari territory news synchronized: ${ID}`);
}

main();

module.exports = { ID, SOURCE_URL, SOURCE_LABEL, NEWS_ITEM, main, upsertById };
