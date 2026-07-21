(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PublicationQueueContract = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const QUEUE_HEADERS = [
    'queue_id',
    'submission_type',
    'tos_name',
    'title',
    'source_checked',
    'permission_checked',
    'personal_data_checked',
    'media_checked',
    'target_file',
    'status',
    'blocker',
    'owner',
    'next_step'
  ];

  const SUBMISSION_TYPES = new Set(['news', 'project', 'need', 'done', 'card_update', 'media']);
  const TARGET_FILES = new Set([
    'data/news.json',
    'data/projects.json',
    'data/needs.json',
    'data/done.json',
    'data/toses.json',
    'data/media_intake_register.csv'
  ]);
  const CHECK_VALUES = new Set(['да', 'нет', 'не применимо']);
  const STATUSES = new Set(['draft', 'checking', 'ready', 'published', 'rejected']);
  const CANONICAL_ID_PATTERN = /^queue-(\d{3})$/;
  const INCOMING_ID_PATTERN = /^incoming-\d{8}-\d{6}(?:-[a-z0-9]+)?$/i;
  const MAX_QUEUE_NUMBER = 999;

  const STATUS_DETAILS = Object.freeze({
    draft: {
      label: 'Черновик',
      description: 'Материал принят, но обязательные поля или проверки ещё не завершены.'
    },
    checking: {
      label: 'На проверке',
      description: 'Редакция проверяет источник, разрешения, персональные данные и медиа.'
    },
    ready: {
      label: 'Готов к публикации',
      description: 'Все обязательные проверки закрыты, назначен ответственный и указан целевой файл.'
    },
    published: {
      label: 'Опубликован',
      description: 'Материал опубликован и должен пройти послепубликационный контроль.'
    },
    rejected: {
      label: 'Отклонён',
      description: 'Публикация остановлена с зафиксированной причиной и следующим действием.'
    }
  });

  const clean = (value) => String(value ?? '').trim();

  function parseCanonicalNumber(value) {
    const match = clean(value).match(CANONICAL_ID_PATTERN);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  function formatCanonicalId(number) {
    const value = Number(number);
    if (!Number.isInteger(value) || value < 1 || value > MAX_QUEUE_NUMBER) {
      throw new Error(`Номер очереди должен быть целым числом от 1 до ${MAX_QUEUE_NUMBER}.`);
    }
    return `queue-${String(value).padStart(3, '0')}`;
  }

  function nextCanonicalNumber(rows) {
    const values = (Array.isArray(rows) ? rows : [])
      .map((row) => parseCanonicalNumber(row?.queue_id))
      .filter((value) => Number.isInteger(value));
    const next = (values.length ? Math.max(...values) : 0) + 1;
    if (next > MAX_QUEUE_NUMBER) throw new Error('В редакционной очереди закончился диапазон queue-001…queue-999.');
    return next;
  }

  function assignCanonicalIds(rows, currentRows) {
    const candidates = Array.isArray(rows) ? rows : [];
    let next = nextCanonicalNumber(currentRows);
    if (next + candidates.length - 1 > MAX_QUEUE_NUMBER) {
      throw new Error('Недостаточно свободных канонических идентификаторов очереди.');
    }
    return candidates.map((row) => ({ ...row, queue_id: formatCanonicalId(next++) }));
  }

  function readyRequirementErrors(row) {
    const errors = [];
    const status = clean(row?.status);
    if (!['ready', 'published'].includes(status)) return errors;
    if (!clean(row?.title)) errors.push(`status ${status} requires title`);
    if (!clean(row?.owner)) errors.push(`status ${status} requires owner`);
    if (clean(row?.source_checked) !== 'да') errors.push(`status ${status} requires source_checked да`);
    if (clean(row?.permission_checked) === 'нет') errors.push(`status ${status} cannot have permission_checked нет`);
    if (!['да', 'не применимо'].includes(clean(row?.personal_data_checked))) {
      errors.push(`status ${status} requires personal_data_checked да or не применимо`);
    }
    if (clean(row?.media_checked) === 'нет') errors.push(`status ${status} cannot have media_checked нет`);
    if (clean(row?.blocker)) errors.push(`status ${status} requires empty blocker`);
    return errors;
  }

  function validateCanonicalRow(row) {
    const errors = [];
    const queueId = clean(row?.queue_id);
    const submissionType = clean(row?.submission_type);
    const status = clean(row?.status);

    if (!queueId) errors.push('missing queue_id');
    else if (!CANONICAL_ID_PATTERN.test(queueId)) errors.push(`invalid queue_id ${queueId}`);
    if (!SUBMISSION_TYPES.has(submissionType)) errors.push(`unsupported submission_type ${submissionType}`);
    ['source_checked', 'permission_checked', 'personal_data_checked', 'media_checked'].forEach((field) => {
      const value = clean(row?.[field]);
      if (!CHECK_VALUES.has(value)) errors.push(`unsupported ${field} ${value}`);
    });
    if (!TARGET_FILES.has(clean(row?.target_file))) errors.push(`unsupported target_file ${clean(row?.target_file)}`);
    if (!STATUSES.has(status)) errors.push(`unsupported status ${status}`);
    if (!clean(row?.next_step)) errors.push('missing next_step');
    if (['draft', 'checking', 'rejected'].includes(status) && !clean(row?.blocker)) {
      errors.push(`status ${status} requires blocker`);
    }
    if (submissionType === 'media' && clean(row?.media_checked) === 'не применимо') {
      errors.push('media submission cannot have media_checked не применимо');
    }
    errors.push(...readyRequirementErrors(row));
    return errors;
  }

  return {
    QUEUE_HEADERS,
    SUBMISSION_TYPES,
    TARGET_FILES,
    CHECK_VALUES,
    STATUSES,
    CANONICAL_ID_PATTERN,
    INCOMING_ID_PATTERN,
    MAX_QUEUE_NUMBER,
    STATUS_DETAILS,
    clean,
    parseCanonicalNumber,
    formatCanonicalId,
    nextCanonicalNumber,
    assignCanonicalIds,
    readyRequirementErrors,
    validateCanonicalRow
  };
});
