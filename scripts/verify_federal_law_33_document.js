const fs = require('fs');
const path = require('path');

const DOCUMENTS_PATH = path.join(process.cwd(), 'data', 'documents.json');
const TITLE = 'Федеральный закон №33-ФЗ от 20.03.2025';
const OFFICIAL_LAW_URL = 'https://publication.pravo.gov.ru/document/0001202503200023';

function main() {
  const documents = JSON.parse(fs.readFileSync(DOCUMENTS_PATH, 'utf8'));
  if (!Array.isArray(documents)) throw new Error('data/documents.json must contain an array');

  const index = documents.findIndex((item) => item && item.title === TITLE);
  if (index < 0) throw new Error(`Document not found: ${TITLE}`);

  documents[index] = {
    ...documents[index],
    status: 'Федеральная норма сверена 10.09.2026 / перед применением проверять новые изменения',
    description: 'Федеральный закон об общих принципах организации местного самоуправления в единой системе публичной власти. Для ТОС ключевой является статья 50. На 10.09.2026 актуальная справочная редакция учитывает изменения Федерального закона №85-ФЗ от 09.04.2026.',
    use_for: 'Правовая основа ТОС, сверка терминов, границ, форм осуществления ТОС, требований к собранию и конференции, содержанию устава и полномочиям органов ТОС.',
    attention: 'Первоначальный текст №33-ФЗ официально опубликован 20.03.2025. Изменения №85-ФЗ официально опубликованы 09.04.2026 (№ опубликования 0001202604090023). Перед юридически значимым действием проверяйте, не появились ли более новые изменения и переходные положения.',
    legal_status: 'reviewed_for_current_federal_law',
    legal_checked_at: '2026-09-10',
    legal_checked_by: 'Редакционная сверка портала ТОС БГО по официальным публикациям',
    legal_recheck_after: '2026-12-10',
    official_source_url: OFFICIAL_LAW_URL,
    legal_decision_ref: '33-ФЗ от 20.03.2025; статья 50; изменения 85-ФЗ от 09.04.2026; официальные публикации 0001202503200023 и 0001202604090023'
  };

  fs.writeFileSync(DOCUMENTS_PATH, `${JSON.stringify(documents, null, 2)}\n`, 'utf8');
  console.log('Federal law 33-FZ document metadata verified for 2026-09-10');
}

main();

module.exports = { main, TITLE, OFFICIAL_LAW_URL };
