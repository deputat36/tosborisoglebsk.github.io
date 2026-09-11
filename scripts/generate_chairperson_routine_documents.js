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
  },
  {
    title: 'Печатный шаблон: карточка маршрутизации обращения жителя',
    type: 'Шаблон текущей работы',
    status: 'Методическая заготовка / проверять компетенцию перед отправкой',
    description: 'Рабочая карточка для выбора адресата обращения: предмет вопроса, компетенция, проверенный источник, приложения, канал отправки, контроль ответа и обратная связь жителю.',
    use_for: 'Ситуации, когда вопрос жителя нельзя решить силами ТОС и перед отправкой нужно проверить, какой орган, собственник, организация или служба действительно компетентны его рассматривать.',
    attention: 'Карточка не определяет компетенцию сама и не заменяет официальное обращение. Перед отправкой проверяйте актуальные полномочия и официальный канал адресата; не храните лишние персональные данные.',
    url: 'documents/templates/resident-request-routing/',
    date: '2026',
    legal_status: 'draft_methodical',
    legal_checked_at: '2026-09-11',
    legal_checked_by: 'Редакционная сверка портала ТОС БГО',
    legal_recheck_after: '2026-12-11',
    official_source_url: '',
    legal_decision_ref: 'Методическая форма; для вопросов ЖКХ учитывать актуальную редакцию 33-ФЗ, 23-ФЗ и 333-ФЗ'
  },
  {
    title: 'Печатный шаблон: реестр решений и поручений ТОС',
    type: 'Шаблон текущей работы',
    status: 'Методическая заготовка / адаптировать и проверить перед применением',
    description: 'Внутренний рабочий реестр: основание решения, поручение, ответственный, срок, статус, следующий шаг, подтверждение результата и контроль просрочек.',
    use_for: 'Контроль исполнения решений собрания, конференции или органа ТОС, а также поручений, возникших из обращений жителей, проектов и рабочего плана.',
    attention: 'Не заменяет протокол, официальный журнал обращений или иной обязательный документ. Первичное решение и юридически значимые приложения храните отдельно; не публикуйте лишние персональные данные.',
    url: 'documents/templates/decision-action-register/',
    date: '2026',
    legal_status: 'draft_methodical',
    legal_checked_at: '',
    legal_checked_by: '',
    legal_recheck_after: '',
    official_source_url: '',
    legal_decision_ref: ''
  },
  {
    title: 'Правовая памятка председателю ТОС: обращения и решения',
    type: 'Правовая памятка',
    status: 'Редакционная памятка / проверять нормы перед юридически значимыми действиями',
    description: 'Практический навигатор по текущей работе председателя: собственные инициативы ТОС, вопросы компетенции органов власти, собрания граждан, решения, границы, рабочий архив и персональные данные.',
    use_for: 'Быстрая проверка маршрута перед оформлением обращения, собрания, решения или общественного проекта.',
    attention: 'Материал подготовлен по состоянию на 10.09.2026 и не является юридической консультацией. Используйте первичные официальные источники, актуальный устав БГО и устав конкретного ТОС.',
    url: 'legal/chairperson-practical-checklist/',
    date: '2026',
    legal_status: 'draft_methodical',
    legal_checked_at: '2026-09-10',
    legal_checked_by: 'Редакционная сверка портала ТОС БГО',
    legal_recheck_after: '2026-12-10',
    official_source_url: 'https://publication.pravo.gov.ru/document/0001202503200023',
    legal_decision_ref: '33-ФЗ, статья 50; решение БГД №453 от 04.03.2026 — справочная сверка'
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
