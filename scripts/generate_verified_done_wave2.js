const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DONE_PATH = path.join(ROOT, 'data', 'done.json');

const VERIFIED_DONE_WAVE2 = [
  {
    id: 'result-archive-needed-prostornyy',
    status: 'published',
    content_origin: 'verified',
    date: '2025-12-12',
    updated_at: '2026-09-07',
    tos_slug: 'prostornyy',
    type: 'Культурная и соседская активность',
    title: 'ТОС «Просторный»: участие в межрегиональном фестивале ТОС',
    summary: 'Представители ТОС «Просторный» участвовали в творческой постановке команды Борисоглебского городского округа на межрегиональном фестивале «Культурный ТОС, объединяющий соседей».',
    before: 'Фестиваль объединил представителей территориальных общественных самоуправлений для обмена опытом, творческого соревнования и совместной программы о жизни ТОСов.',
    done: '12 декабря 2025 года представители ТОС «Просторный» выступили в третьей номинации в сценке «Маленькие ТОСовцы за чистоту!» вместе с представителями ещё пяти ТОСов округа.',
    result: 'ТОС «Просторный» был представлен в составе команды Борисоглебского округа, которая стала победителем фестиваля. Отдельная победа в музыкальной номинации относилась к другим ТОСам и «Просторному» не приписывается.',
    participants: 'Представители ТОС «Просторный» вместе с участниками ТОСов «Чкаловец», «Богана», «Махровка», «Миролюбие» и «Уютный».',
    source_label: 'РИА «Воронеж», 15 декабря 2025 года',
    source_url: 'https://riavrn.ru/news/komanda-tos-iz-borisoglebska-pobedila-v-mezhregionalnom-tvorcheskom-festivale/',
    needs_details: 'Для полноценного собственного фотоархива полезны разрешённые фотографии участников, имена представителей ТОС и короткий комментарий о подготовке номера.'
  },
  {
    id: 'result-archive-needed-uyutnyy',
    status: 'published',
    content_origin: 'verified',
    date: '2025-12-12',
    updated_at: '2026-09-07',
    tos_slug: 'uyutnyy',
    type: 'Культурная и соседская активность',
    title: 'ТОС «Уютный»: участие в межрегиональном фестивале ТОС',
    summary: 'Представители ТОС «Уютный» участвовали в творческой постановке команды Борисоглебского городского округа на межрегиональном фестивале «Культурный ТОС, объединяющий соседей».',
    before: 'Фестиваль объединил представителей территориальных общественных самоуправлений для обмена опытом, творческого соревнования и совместной программы о жизни ТОСов.',
    done: '12 декабря 2025 года представители ТОС «Уютный» выступили в третьей номинации в сценке «Маленькие ТОСовцы за чистоту!» вместе с представителями ещё пяти ТОСов округа.',
    result: 'ТОС «Уютный» был представлен в составе команды Борисоглебского округа, которая стала победителем фестиваля. Отдельная победа в музыкальной номинации относилась к другим ТОСам и «Уютному» не приписывается.',
    participants: 'Представители ТОС «Уютный» вместе с участниками ТОСов «Чкаловец», «Богана», «Просторный», «Махровка» и «Миролюбие».',
    source_label: 'РИА «Воронеж», 15 декабря 2025 года',
    source_url: 'https://riavrn.ru/news/komanda-tos-iz-borisoglebska-pobedila-v-mezhregionalnom-tvorcheskom-festivale/',
    needs_details: 'Для полноценного собственного фотоархива полезны разрешённые фотографии участников, имена представителей ТОС и короткий комментарий о подготовке номера.'
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

  VERIFIED_DONE_WAVE2.forEach((item) => upsertById(doneItems, item));
  writeJson(DONE_PATH, doneItems);
  console.log(`Verified done wave 2 synchronized: ${VERIFIED_DONE_WAVE2.map((item) => item.id).join(', ')}`);
}

main();

module.exports = { VERIFIED_DONE_WAVE2, main, upsertById };
