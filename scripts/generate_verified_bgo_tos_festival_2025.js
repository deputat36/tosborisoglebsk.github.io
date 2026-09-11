const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const NEWS_PATH = path.join(ROOT, 'data', 'news.json');

const ID = 'bgo-tos-cultural-festival-win-2025';
const SOURCE_URL = 'https://riavrn.ru/news/komanda-tos-iz-borisoglebska-pobedila-v-mezhregionalnom-tvorcheskom-festivale/';
const SOURCE_LABEL = 'РИА «Воронеж», 15 декабря 2025 года';

const NEWS_ITEM = {
  id: ID,
  status: 'published',
  content_origin: 'verified',
  date: '2025-12-15',
  updated_at: '2026-09-11',
  category: 'ТОС БГО',
  title: 'Сборная ТОС Борисоглебского округа победила на творческом фестивале',
  lead: 'Представители нескольких ТОС Борисоглебского городского округа выступили на фестивале «Культурный ТОС, объединяющий соседей» и заняли первое место в номинации о народном творчестве и самобытности районов.',
  text: [
    'Фестиваль «Культурный ТОС, объединяющий соседей» прошёл в Борисоглебске 12 декабря 2025 года. Для участников организовали экскурсию по городу, мастер-классы и конкурсную программу в Центральном дворце культуры «Звёздный».',
    'Конкурсная программа включала три направления: патриотическую песню, народное творчество и самобытность районов, а также творческие номера о жизни ТОС.',
    'Представители ТОС «Богана», «Миролюбие» и «Махровка» исполнили песню «Возле речки, возле моста» и заняли первое место в номинации «Народное творчество, самобытность районов».',
    'В номинации патриотической песни выступил представитель ТОС «Чкаловец». В сценке «Маленькие ТОСовцы за чистоту!» участвовали представители шести ТОС: «Чкаловец», «Богана», «Просторный», «Махровка», «Миролюбие» и «Уютный».',
    'Источник отмечает, что фестиваль стал для активистов не только конкурсной площадкой, но и возможностью обменяться опытом после реализации общественных проектов.',
    'Материал относится сразу к нескольким ТОС БГО, поэтому не закреплён за одной карточкой через единственный tos_slug. Это позволяет не создавать ложное впечатление, что общую победу обеспечил только один ТОС.'
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
  console.log(`Verified BGO TOS festival news synchronized: ${ID}`);
}

main();

module.exports = { ID, SOURCE_URL, SOURCE_LABEL, NEWS_ITEM, main, upsertById };
