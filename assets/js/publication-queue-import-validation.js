(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./publication-queue-contract.js'));
  } else {
    root.PublicationQueueImportValidation = factory(root.PublicationQueueContract);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (contract) {
  'use strict';

  if (!contract) throw new Error('PublicationQueueContract is required.');

  const QUEUE_HEADERS = contract.QUEUE_HEADERS;
  const INTAKE_HEADERS = [
    'submission_type',
    'tos_name',
    'title',
    'short_summary',
    'event_or_fact_date',
    'source_person',
    'source_contact',
    'source_document_or_link',
    'publication_permission',
    'media_attached',
    'personal_data_present',
    'target_section',
    'status',
    'next_step'
  ];

  const SUBMISSION_TYPES = contract.SUBMISSION_TYPES;
  const TARGET_FILES = contract.TARGET_FILES;
  const TARGET_SECTIONS = new Set([
    '/news/ и data/news.json',
    '/projects/ и data/projects.json',
    '/needs/ и data/needs.json',
    '/done/ и data/done.json',
    '/tos/ и data/toses.json',
    '/media-intake/ и data/media_intake_register.csv'
  ]);
  const FORMULA_PREFIX = /^[=+\-@]/;

  const clean = contract.clean;

  function parseCsv(text) {
    const source = String(text ?? '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      const next = source[index + 1];

      if (character === '"' && quoted && next === '"') {
        value += '"';
        index += 1;
        continue;
      }
      if (character === '"') {
        quoted = !quoted;
        continue;
      }
      if (character === ',' && !quoted) {
        row.push(value);
        value = '';
        continue;
      }
      if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && next === '\n') index += 1;
        row.push(value);
        if (row.some((cell) => clean(cell))) rows.push(row);
        row = [];
        value = '';
        continue;
      }
      value += character;
    }

    if (quoted) throw new Error('CSV содержит незакрытое поле в кавычках.');
    if (value || row.length) {
      row.push(value);
      if (row.some((cell) => clean(cell))) rows.push(row);
    }
    return rows;
  }

  function sameHeaders(actual, expected) {
    return actual.length === expected.length && actual.every((header, index) => clean(header) === expected[index]);
  }

  function parseDocument(text, expectedHeaders) {
    const rows = parseCsv(text);
    if (!rows.length) throw new Error('CSV не содержит строк.');
    const headers = rows[0].map(clean);
    if (!sameHeaders(headers, expectedHeaders)) {
      throw new Error(`Схема CSV не совпадает. Ожидались поля: ${expectedHeaders.join(', ')}`);
    }

    return rows.slice(1).map((cells, rowIndex) => {
      if (cells.length !== headers.length) {
        throw new Error(`Строка ${rowIndex + 2}: ожидалось ${headers.length} ячеек, найдено ${cells.length}.`);
      }
      return Object.fromEntries(headers.map((header, index) => [header, clean(cells[index])]));
    });
  }

  function normalizeText(value) {
    return clean(value)
      .toLocaleLowerCase('ru')
      .replace(/[«»„“”"']/g, '')
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function contentFingerprint(row) {
    return [row.submission_type, normalizeText(row.tos_name), normalizeText(row.title)].join('|');
  }

  function titleTokens(value) {
    return new Set(normalizeText(value).split(' ').filter((token) => token.length > 2));
  }

  function titleSimilarity(left, right) {
    const a = titleTokens(left);
    const b = titleTokens(right);
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter((token) => b.has(token)).length;
    const union = new Set([...a, ...b]).size;
    return union ? intersection / union : 0;
  }

  function hasFormulaValue(row) {
    return Object.values(row).some((value) => FORMULA_PREFIX.test(clean(value)));
  }

  function validateQueueRow(row) {
    const errors = [];
    if (!contract.INCOMING_ID_PATTERN.test(clean(row.queue_id))) {
      errors.push('Некорректный временный queue_id входящего материала.');
    }
    if (!SUBMISSION_TYPES.has(clean(row.submission_type))) errors.push('Неизвестный тип материала.');
    if (!clean(row.title)) errors.push('Не указан заголовок.');
    if (clean(row.source_checked) !== 'нет') errors.push('Проверка источника должна оставаться незакрытой.');
    if (clean(row.permission_checked) !== 'нет') errors.push('Проверка разрешения должна оставаться незакрытой.');
    if (clean(row.personal_data_checked) !== 'нет') errors.push('Проверка персональных данных должна оставаться незакрытой.');
    if (!['нет', 'не применимо'].includes(clean(row.media_checked))) errors.push('Некорректный статус проверки медиа.');
    if (!TARGET_FILES.has(clean(row.target_file))) errors.push('Неизвестный целевой файл.');
    if (clean(row.status) !== 'draft') errors.push('Импорт разрешён только для статуса draft.');
    if (clean(row.owner)) errors.push('Ответственный не должен назначаться автоматически.');
    if (!clean(row.blocker)) errors.push('Не указан блокер обязательных проверок.');
    if (!clean(row.next_step)) errors.push('Не указан следующий шаг.');
    if (hasFormulaValue(row)) errors.push('Найдена потенциальная CSV-формула.');
    return errors;
  }

  function validateIntakeRow(row) {
    const errors = [];
    if (!SUBMISSION_TYPES.has(clean(row.submission_type))) errors.push('Неизвестный тип материала.');
    if (!clean(row.title)) errors.push('Не указан заголовок.');
    if (clean(row.publication_permission) !== 'не подтверждено') errors.push('Разрешение не должно считаться подтверждённым.');
    if (!['да', 'нет'].includes(clean(row.media_attached))) errors.push('Некорректная отметка о медиа.');
    if (clean(row.personal_data_present) !== 'не проверено') errors.push('Персональные данные должны оставаться непроверенными.');
    if (!TARGET_SECTIONS.has(clean(row.target_section))) errors.push('Неизвестный целевой раздел.');
    if (clean(row.status) !== 'draft') errors.push('Карточка приёма должна иметь статус draft.');
    if (!clean(row.next_step)) errors.push('Не указан следующий шаг.');
    if (hasFormulaValue(row)) errors.push('Найдена потенциальная CSV-формула.');
    return errors;
  }

  function classifyDuplicate(candidate, currentRows, candidateRows, candidateIndex) {
    const idMatch = currentRows.find((row) => clean(row.queue_id) === clean(candidate.queue_id));
    if (idMatch) return { level: 'exact', reason: 'queue_id уже есть в рабочей очереди' };

    const previousIdMatch = candidateRows.find((row, index) => index < candidateIndex && clean(row.queue_id) === clean(candidate.queue_id));
    if (previousIdMatch) return { level: 'exact', reason: 'временный queue_id повторяется внутри импортируемого файла' };

    const fingerprint = contentFingerprint(candidate);
    const contentMatch = currentRows.find((row) => contentFingerprint(row) === fingerprint);
    if (contentMatch) return { level: 'exact', reason: 'такой тип, ТОС и заголовок уже есть в рабочей очереди' };

    const previousCandidate = candidateRows.find((row, index) => index < candidateIndex && contentFingerprint(row) === fingerprint);
    if (previousCandidate) return { level: 'exact', reason: 'строка дублируется внутри импортируемого файла' };

    const possible = currentRows.find((row) => {
      if (clean(row.submission_type) !== clean(candidate.submission_type)) return false;
      const sameTos = normalizeText(row.tos_name) === normalizeText(candidate.tos_name);
      return sameTos && titleSimilarity(row.title, candidate.title) >= 0.72;
    });
    if (possible) return { level: 'possible', reason: `похожий материал уже есть: ${clean(possible.title)}` };

    return { level: 'none', reason: '' };
  }

  function matchIntakeRow(queueRow, intakeRows) {
    const fingerprint = contentFingerprint(queueRow);
    return intakeRows.find((row) => contentFingerprint(row) === fingerprint) || null;
  }

  function analyze(queueRows, currentRows, intakeRows) {
    const candidates = Array.isArray(queueRows) ? queueRows : [];
    const current = Array.isArray(currentRows) ? currentRows : [];
    const intake = Array.isArray(intakeRows) ? intakeRows : [];

    return candidates.map((row, index) => {
      const errors = validateQueueRow(row);
      const duplicate = classifyDuplicate(row, current, candidates, index);
      const intakeRow = matchIntakeRow(row, intake);
      const intakeErrors = intakeRow ? validateIntakeRow(intakeRow) : [];
      return {
        index,
        row,
        errors,
        duplicate,
        intakeRow,
        intakeErrors,
        valid: errors.length === 0 && intakeErrors.length === 0,
        canApprove: errors.length === 0 && intakeErrors.length === 0 && duplicate.level !== 'exact',
        requiresDuplicateOverride: duplicate.level === 'possible'
      };
    });
  }

  function canonicalizeApprovedRows(rows, currentRows) {
    return contract.assignCanonicalIds(rows, currentRows);
  }

  function escapeFormula(value) {
    const text = clean(value);
    return FORMULA_PREFIX.test(text) ? `'${text}` : text;
  }

  function csvCell(value) {
    const text = escapeFormula(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCsv(headers, rows) {
    const body = (Array.isArray(rows) ? rows : []).map((row) => headers.map((header) => csvCell(row[header])).join(','));
    return `${headers.join(',')}\n${body.length ? `${body.join('\n')}\n` : ''}`;
  }

  return {
    contract,
    QUEUE_HEADERS,
    INTAKE_HEADERS,
    SUBMISSION_TYPES,
    TARGET_FILES,
    TARGET_SECTIONS,
    parseCsv,
    parseDocument,
    normalizeText,
    contentFingerprint,
    titleSimilarity,
    validateQueueRow,
    validateIntakeRow,
    analyze,
    canonicalizeApprovedRows,
    escapeFormula,
    toCsv
  };
});
