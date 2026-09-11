const fs = require('fs');
const path = require('path');

const DOCUMENTS_PATH = path.join(process.cwd(), 'data', 'documents.json');
const TITLE = 'Федеральный закон №33-ФЗ от 20.03.2025';
const OFFICIAL_LAW_URL = 'https://publication.pravo.gov.ru/document/0001202503200023';
const OFFICIAL_AMENDMENT_URL = 'https://publication.pravo.gov.ru/document/0001202604090002';

function main() {
  const documents = JSON.parse(fs.readFileSync(DOCUMENTS_PATH, 'utf8'));
  if (!Array.isArray(documents)) throw new Error('data/documents.json must contain an array');

  const index = documents.findIndex((item) => item && item.title === TITLE);
  if (index < 0) throw new Error(`Document not found: ${TITLE}`);

  documents[index] = {
    ...documents[index],
    status: 'Федеральная норма сверена 11.09.2026 / перед применением проверять новые изменения',
    description: 'Федеральный закон об общих принципах организации местного самоуправления в единой системе публичной власти. Для ТОС ключевой является статья 50. На 11.09.2026 актуальная справочная редакция учитывает изменения Федерального закона №85-ФЗ от 09.04.2026 и переходные сроки статей 91 и 93.',
    use_for: 'Правовая основа ТОС, сверка терминов, границ, форм осуществления ТОС, требований к собранию и конференции, содержанию устава, полномочиям органов ТОС и переходным срокам 2026–2028 годов.',
    attention: 'Первоначальный текст №33-ФЗ официально опубликован 20.03.2025. Изменения №85-ФЗ официально опубликованы 09.04.2026 (№ опубликования 0001202604090002). Муниципальные акты по вопросам организации местного самоуправления должны быть приведены в соответствие с 33-ФЗ не позднее 01.01.2027; 131-ФЗ признаётся утратившим силу с 01.01.2028. Перед юридически значимым действием проверяйте актуальную редакцию и применимые переходные положения.',
    legal_status: 'reviewed_for_current_federal_law',
    legal_checked_at: '2026-09-11',
    legal_checked_by: 'Редакционная сверка портала ТОС БГО по официальным публикациям и текущей редакции закона',
    legal_recheck_after: '2026-12-11',
    official_source_url: OFFICIAL_LAW_URL,
    legal_decision_ref: '33-ФЗ от 20.03.2025; статьи 50, 91, 93; изменения 85-ФЗ от 09.04.2026; официальные публикации 0001202503200023 и 0001202604090002'
  };

  fs.writeFileSync(DOCUMENTS_PATH, `${JSON.stringify(documents, null, 2)}\n`, 'utf8');
  console.log('Federal law 33-FZ document metadata verified for 2026-09-11');
}

main();

module.exports = { main, TITLE, OFFICIAL_LAW_URL, OFFICIAL_AMENDMENT_URL };
