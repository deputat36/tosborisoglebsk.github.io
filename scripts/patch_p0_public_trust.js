const fs = require('fs');
const path = require('path');

const root = process.cwd();

const publicPages = [
  'index.html',
  'tos/index.html',
  'residents/index.html',
  'partners/index.html',
  'projects/index.html',
  'needs/index.html',
  'done/index.html',
  'calendar/index.html',
  'documents/index.html',
  'legal/index.html',
  'create-tos/index.html',
  'contacts/index.html'
];

const statusSection = `
<section class="section tight" data-portal-working-status><div class="container notice"><b>Рабочая версия каталога:</b> полнота состава ТОСов и актуальность отдельных сведений проверяются. Перед использованием контакта, даты, границ, документа, проекта или потребности смотрите статус и источник записи. <a href="/data-update/">Состояние каталога</a> · <a href="/sources/">Источники</a> · <a href="/update-tos/?type=card#message-builder">Сообщить исправление</a>.</div></section>`;

function patchPublicPage(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing public page: ${relativePath}`);
  }

  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (!html.includes('data-portal-working-status')) {
    const mainPattern = /<main\b[^>]*\bid=["']main["'][^>]*>/i;
    if (!mainPattern.test(html)) {
      throw new Error(`Cannot find #main landmark in ${relativePath}`);
    }
    html = html.replace(mainPattern, (match) => `${match}${statusSection}`);
    changed = true;
  }

  if (relativePath === 'index.html' && html.includes('реальные истории благоустройства')) {
    html = html.split('реальные истории благоустройства').join('материалы о работе территорий и запросы сведений');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`Patched public trust status: ${relativePath}`);
  } else {
    console.log(`Public trust status already present: ${relativePath}`);
  }
}

function patchMunicipalLegalStatus() {
  const documentsPath = path.join(root, 'data', 'documents.json');
  if (!fs.existsSync(documentsPath)) {
    throw new Error('Missing data/documents.json');
  }

  const documents = JSON.parse(fs.readFileSync(documentsPath, 'utf8'));
  const charter = documents.find((item) => item.title === 'Устав Борисоглебского городского округа');
  if (!charter) {
    throw new Error('BGO charter entry was not found in data/documents.json');
  }

  charter.status = 'Локальная копия редакции 2024 года / требует официальной сверки';
  charter.attention = 'Не считать гарантированно актуальной редакцией. Для официальных действий нужно найти и проверить текущую официально опубликованную редакцию Устава БГО.';
  charter.legal_applicability = 'requires_official_check';
  charter.legal_checked_at = '';
  charter.official_source_url = '';

  fs.writeFileSync(documentsPath, `${JSON.stringify(documents, null, 2)}\n`, 'utf8');
  console.log('Patched BGO charter legal status');
}

publicPages.forEach(patchPublicPage);
patchMunicipalLegalStatus();
