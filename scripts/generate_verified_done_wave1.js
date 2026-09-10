const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const DONE_PATH = path.join(ROOT, 'data', 'done.json');

const VERIFIED_DONE_WAVE1 = [
  {
    id: 'result-archive-needed-bogana',
    status: 'published',
    content_origin: 'verified',
    date: '2023-09-04',
    updated_at: '2026-09-07',
    tos_slug: 'bogana',
    type: 'Реализованный проект',
    title: 'ТОС «Богана»: построена универсальная спортивная площадка',
    summary: 'РИА «Воронеж» сообщило об открытии в селе Богана универсальной спортивной площадки площадью более 900 кв. м, созданной при участии ТОС, жителей и партнёров.',
    before: 'Жителям села требовалась современная площадка, где дети, подростки и взрослые могли бы заниматься спортом и проводить активный досуг рядом с домом.',
    done: 'В 2023 году в Богане построили и открыли универсальную спортивную площадку площадью более 900 кв. м.',
    result: 'Село получило постоянную спортивную инфраструктуру. По данным источника, проект объединил грантовую поддержку, вклад жителей и помощь спонсоров.',
    participants: 'Актив ТОС «Богана», жители села и партнёры проекта.',
    source_label: 'РИА «Воронеж», 4 сентября 2023 года',
    source_url: 'https://riavrn.ru/news/v-borisoglebskom-sele-bogana-postroili-universalnuyu-sportploshadku/',
    needs_details: 'Для дальнейшего архивного дополнения полезны собственные фотографии ТОС, точная дата открытия и комментарий жителей о текущем использовании площадки.'
  },
  {
    id: 'result-archive-needed-kalinka',
    status: 'published',
    content_origin: 'verified',
    date: '2024-12-19',
    updated_at: '2026-09-07',
    tos_slug: 'kalinka',
    type: 'Реализованный проект',
    title: 'ТОС «Калинка»: в посёлке появилась первая детская площадка',
    summary: 'РИА «Воронеж» подтвердило реализацию проекта «Территория детского здоровья»: на пустыре в посёлке Калинино появилась первая детская площадка.',
    before: 'До реализации инициативы у детей посёлка не было собственной оборудованной площадки для игр и активного отдыха.',
    done: 'ТОС реализовал проект «Территория детского здоровья» и оборудовал первую детскую площадку в посёлке Калинино.',
    result: 'У детей и семей появилось благоустроенное общественное пространство. Источник указывает областную грантовую поддержку свыше 800 тыс. рублей и собственный вклад жителей.',
    participants: 'Актив ТОС «Калинка» и жители посёлка Калинино.',
    source_label: 'РИА «Воронеж», 19 декабря 2024 года',
    source_url: 'https://riavrn.ru/news/v-borisoglebskom-poselke-kalinino-na-pustyre-poyavilas-pervaya-detskaya-ploshadka/',
    needs_details: 'Для дальнейшего архивного дополнения полезны собственные фотографии площадки, отзывы семей и сведения о её текущем состоянии.'
  },
  {
    id: 'result-archive-needed-mirolyubie',
    status: 'published',
    content_origin: 'verified',
    date: '2026-08-20',
    updated_at: '2026-09-07',
    tos_slug: 'mirolyubie',
    type: 'Реализованный проект',
    title: 'ТОС «Миролюбие»: реализован проект «Играй и побеждай»',
    summary: 'В посёлке Миролюбие завершили проект «Играй и побеждай»: благоустроили многофункциональную площадку площадью 960 кв. м для катания на роликах, самокатах и скейтбордах.',
    before: 'Жителям требовалось безопасное и удобное общественное пространство для активного отдыха детей и подростков.',
    done: 'В 2026 году благоустроили многофункциональную площадку площадью 960 кв. м; по публикации РИА «Воронеж», основные работы заняли около полутора месяцев.',
    result: 'Посёлок получил новое пространство для активного отдыха. Официальный протокол конкурса подтверждает грант 1 489 360 рублей, а региональное СМИ — завершение благоустройства.',
    participants: 'Актив ТОС «Миролюбие», жители посёлка и исполнители проекта.',
    source_label: 'РИА «Воронеж», 20 августа 2026 года; АНО «Образ Будущего», протокол победителей конкурса ТОС 2026',
    source_url: 'https://riavrn.ru/news/v-borisoglebskom-poselke-mirolyubie-blagoustroili-ploshadku-dlya-kataniya-na-rolikah/',
    needs_details: 'Для дальнейшего архивного дополнения полезны собственные фотографии после открытия и сведения о режиме использования и содержании площадки.'
  },
  {
    id: 'result-archive-needed-petrovskoe',
    status: 'published',
    content_origin: 'verified',
    date: '2023-08-24',
    updated_at: '2026-09-07',
    tos_slug: 'petrovskoe',
    type: 'Реализованный инфраструктурный проект',
    title: 'ТОС «Петровское»: отремонтирована водозаборная скважина №1',
    summary: 'РИА «Воронеж» подтвердило завершение ремонта водозаборной скважины №1 в селе Петровское с заменой оборудования и элементов системы водоснабжения.',
    before: 'Системе водоснабжения села требовался ремонт водозаборной скважины и замена изношенных элементов оборудования.',
    done: 'В ходе проекта заменили 36 м труб, фильтры, насос, станцию управления и защиты и выполнили другие необходимые работы на скважине №1.',
    result: 'Завершён инфраструктурный ремонт важного объекта водоснабжения. Источник указывает грант свыше 460 тыс. рублей и ещё 56 тыс. рублей вклада жителей и спонсоров.',
    participants: 'Актив ТОС «Петровское», жители села и партнёры проекта.',
    source_label: 'РИА «Воронеж», 24 августа 2023 года',
    source_url: 'https://riavrn.ru/news/v-borisoglebskom-sele-petrovskoe-otremontirovali-vodozabornuyu-skvazhinu/',
    needs_details: 'Для дальнейшего архивного дополнения полезны технические фотографии до и после ремонта и сведения о последующей эксплуатации скважины.'
  },
  {
    id: 'result-archive-needed-ulyanovka',
    status: 'published',
    content_origin: 'verified',
    date: '2020-09-21',
    updated_at: '2026-09-07',
    tos_slug: 'ulyanovka',
    type: 'Реализованный проект',
    title: 'ТОС «Ульяновка»: построена спортивная площадка площадью 800 кв. м',
    summary: 'РИА «Воронеж» подтвердило строительство в селе Ульяновка спортивной площадки площадью 800 кв. м общей стоимостью около 2,8 млн рублей.',
    before: 'Селу требовалась современная спортивная инфраструктура для занятий физкультурой и активного досуга жителей разных возрастов.',
    done: 'В 2020 году в Ульяновке построили спортивную площадку площадью 800 кв. м с привлечением нескольких источников финансирования и вклада жителей.',
    result: 'Село получило крупный спортивный объект. По данным источника, общая стоимость составила около 2,8 млн рублей, включая грантовые и муниципальные средства.',
    participants: 'Актив ТОС «Ульяновка», жители села, муниципальные и региональные партнёры проекта.',
    source_label: 'РИА «Воронеж», 21 сентября 2020 года',
    source_url: 'https://riavrn.ru/news/v-borisoglebskom-sele-ulyanovka-postroili-sportploshchadku-za-2-8-mln-rubley/',
    needs_details: 'Для дальнейшего архивного дополнения полезны собственные фотографии объекта и сведения о его текущем использовании и состоянии.'
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

  VERIFIED_DONE_WAVE1.forEach((item) => upsertById(doneItems, item));
  writeJson(DONE_PATH, doneItems);
  console.log(`Verified done wave 1 synchronized: ${VERIFIED_DONE_WAVE1.map((item) => item.id).join(', ')}`);
}

require('./generate_verified_done_wave4');
main();

module.exports = { VERIFIED_DONE_WAVE1, main, upsertById };
