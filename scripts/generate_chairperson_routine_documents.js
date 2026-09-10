const fs = require('fs');
const path = require('path');

const DOCUMENTS_PATH = path.join(process.cwd(), 'data', 'documents.json');

const ROUTINE_DOCUMENTS = [
  {
    title: 'Печатный шаблон: годовой отчёт председателя ТОС',
    type: 'Шаблон отчётности',
    status: 'Методическая заготовка / адаптировать и проверить перед применением',
    description: 'Заполняемая форма годового отчёта: главные результаты, работа с жителями, проекты, ресурсы, партнёры, публичность, нерешённые вопросы и план на следующий год.',
    use_for: 'Подготовка понятного отчёта председателя или актива ТОС перед жителями и формирование публичного архива работы территории.',
    attention: 'Это не утверждённый муниципальный бланк. Обязанность, периодичность и состав официального отчёта сверяйте с уставом конкретного ТОС и действующими решениями.',
    url: 'documents/templates/chairperson-annual-report/',
    date: '2026',
    legal_status: 'draft_methodical',
    legal_checked_at: '',
    legal_checked_by: '',
    legal_recheck_after: '',
    official_source_url: '',
    legal_decision_ref: ''
  },
  {
    title: 'Печатный шаблон: журнал обращений жителей ТОС',
    type: 'Шаблон текущей работы',
    status: 'Методическая заготовка / адаптировать и проверить перед применением',
    description: 'Внутренний рабочий журнал: тема обращения, категория, ответственный, срок, статус, компетенция, следующий шаг и результат.',
    use_for: 'Учёт вопросов и предложений жителей, контроль сроков и перевод повторяющихся проблем в проекты, обращения или вопросы для собрания.',
    attention: 'Не является официальным реестром обращений органа власти. Не собирайте лишние персональные данные и не публикуйте заполненный журнал в открытом доступе.',
    url: 'documents/templates/resident-appeals-register/',
    date: '2026',
    legal_status: 'draft_methodical',
    legal_checked_at: '',
    legal_checked_by: '',
    legal_recheck_after: '',
    official_source_url: '',
    legal_decision_ref: ''
  }
];

function readDocuments() {
  const data = JSON.parse(fs.readFileSync(DOCUMENTS_PATH, 'utf8'));
  if (!Array.isArray(data)) throw new Error('data/documents.json must contain an array');
  return data;
}

function upsertByUrl(documents, item) {
  const index = documents.findIndex((entry) => entry && entry.url === item.url);
  if (index >= 0) {
    documents[index] = { ...documents[index], ...item };
    return;
  }
  documents.push(item);
}

function main() {
  const documents = readDocuments();
  ROUTINE_DOCUMENTS.forEach((item) => upsertByUrl(documents, item));
  fs.writeFileSync(DOCUMENTS_PATH, `${JSON.stringify(documents, null, 2)}\n`, 'utf8');
  console.log(`Chairperson routine documents synchronized: ${ROUTINE_DOCUMENTS.length}`);
}

main();

module.exports = { ROUTINE_DOCUMENTS, main, upsertByUrl };
