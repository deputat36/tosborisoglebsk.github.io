(function initGitHubPagesManualCheck(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GitHubPagesManualCheck = api;
  if (root && root.document) {
    const start = () => api.mount(root.document);
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createGitHubPagesManualCheckApi() {
  'use strict';

  const HEADERS = Object.freeze([
    'item_id',
    'field',
    'label',
    'where_to_check',
    'expected_value',
    'observed_value',
    'status',
    'evidence_ref'
  ]);

  const EXPECTED_ITEMS = Object.freeze([
    ['pages-check-01', 'source_branch'],
    ['pages-check-02', 'publish_folder'],
    ['pages-check-03', 'custom_domain'],
    ['pages-check-04', 'https_enforcement'],
    ['pages-check-05', 'deployment_status'],
    ['pages-check-06', 'deployment_url'],
    ['pages-check-07', 'checked_at'],
    ['pages-check-08', 'evidence_ref']
  ]);

  const ALLOWED_STATUSES = Object.freeze([
    'not_checked',
    'confirmed',
    'passed',
    'success',
    'warning',
    'failed',
    'mismatch',
    'blocked'
  ]);

  const POSITIVE_STATUSES = new Set(['confirmed', 'passed', 'success']);
  const PROBLEM_STATUSES = new Set(['warning', 'failed', 'mismatch', 'blocked']);
  const STORAGE_KEY = 'tos-github-pages-manual-check-v1';
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const URL_RE = /^https?:\/\//i;
  const SECRET_RE = /(ghp_[a-z0-9]+|github_pat_[a-z0-9_]+|access[_-]?token|token=|password=|secret=)/i;

  const clean = (value) => String(value == null ? '' : value).trim();

  function parseCsvMatrix(text) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const source = String(text || '').replace(/^\uFEFF/, '');

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          field += '"';
          index += 1;
        } else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field.replace(/\r$/, ''));
        if (row.some((cell) => clean(cell))) rows.push(row);
        row = [];
        field = '';
      } else field += char;
    }

    row.push(field.replace(/\r$/, ''));
    if (row.some((cell) => clean(cell))) rows.push(row);
    return rows;
  }

  function parseCsv(text) {
    const matrix = parseCsvMatrix(text);
    const [headers, ...items] = matrix;
    if (!headers || headers.join(',') !== HEADERS.join(',')) {
      throw new Error(`Неожиданные заголовки CSV: ${(headers || []).join(',')}`);
    }
    return items.map((cells) => Object.fromEntries(HEADERS.map((header, index) => [header, cells[index] || ''])));
  }

  function csvEscape(value) {
    const text = String(value == null ? '' : value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function serializeCsv(rows) {
    const lines = [HEADERS.join(',')];
    for (const row of rows || []) lines.push(HEADERS.map((header) => csvEscape(row[header])).join(','));
    return `${lines.join('\r\n')}\r\n`;
  }

  function isIsoDate(value) {
    const text = clean(value);
    if (!ISO_DATE_RE.test(text)) return false;
    const date = new Date(`${text}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
  }

  function rowIssues(row, index) {
    const issues = [];
    const expected = EXPECTED_ITEMS[index];
    const status = clean(row && row.status);
    const observed = clean(row && row.observed_value);
    const evidence = clean(row && row.evidence_ref);

    if (!expected) issues.push('лишняя строка');
    else {
      if (clean(row.item_id) !== expected[0]) issues.push(`ожидается item_id ${expected[0]}`);
      if (clean(row.field) !== expected[1]) issues.push(`ожидается field ${expected[1]}`);
    }
    if (!clean(row && row.label)) issues.push('нет названия пункта');
    if (!clean(row && row.where_to_check)) issues.push('нет места проверки');
    if (!clean(row && row.expected_value)) issues.push('нет ожидаемого значения');
    if (!ALLOWED_STATUSES.includes(status)) issues.push(`недопустимый статус ${status || 'пусто'}`);

    if (status === 'not_checked') {
      if (observed) issues.push('для not_checked фактическое значение должно быть пустым');
      if (evidence) issues.push('для not_checked ссылка должна быть пустой');
    } else {
      if (!observed) issues.push('укажите фактическое значение');
      if (!evidence) issues.push('укажите безопасную ссылку или обезличенный код');
    }

    if (clean(row && row.field) === 'checked_at' && observed && !isIsoDate(observed)) {
      issues.push('дата проверки должна быть YYYY-MM-DD');
    }
    if (clean(row && row.field) === 'deployment_url' && observed && !URL_RE.test(observed)) {
      issues.push('URL публикации должен начинаться с http:// или https://');
    }
    if (SECRET_RE.test(observed) || SECRET_RE.test(evidence)) {
      issues.push('обнаружен признак токена, пароля или секрета');
    }
    return issues;
  }

  function validateRows(rows) {
    const items = Array.isArray(rows) ? rows : [];
    const rowErrors = items.map((row, index) => rowIssues(row, index));
    const errors = [];
    if (items.length !== EXPECTED_ITEMS.length) errors.push(`должно быть ${EXPECTED_ITEMS.length} строк, найдено ${items.length}`);
    const ids = items.map((row) => clean(row.item_id)).filter(Boolean);
    if (new Set(ids).size !== ids.length) errors.push('повторяются item_id');
    rowErrors.forEach((messages, index) => messages.forEach((message) => errors.push(`строка ${index + 1}: ${message}`)));
    return { valid: errors.length === 0, errors, rowErrors };
  }

  function summarize(rows) {
    const items = Array.isArray(rows) ? rows : [];
    const validation = validateRows(items);
    const checked = items.filter((row) => clean(row.status) !== 'not_checked').length;
    const positive = items.filter((row) => POSITIVE_STATUSES.has(clean(row.status))).length;
    const problems = items.filter((row) => PROBLEM_STATUSES.has(clean(row.status))).length;
    const complete = checked === EXPECTED_ITEMS.length && validation.valid;
    const passed = complete && positive === EXPECTED_ITEMS.length;
    const status = passed ? 'passed' : problems > 0 ? 'warning' : 'pending';
    return {
      total: EXPECTED_ITEMS.length,
      checked,
      positive,
      problems,
      complete,
      passed,
      status,
      validation
    };
  }

  function fieldMap(rows) {
    return new Map((rows || []).map((row) => [clean(row.field), row]));
  }

  function buildActionsDiagnosticRow(rows) {
    const summary = summarize(rows);
    const byField = fieldMap(rows);
    const observed = (field) => clean(byField.get(field) && byField.get(field).observed_value) || 'не проверено';
    const evidence = [];
    for (const row of rows || []) {
      const value = clean(row.evidence_ref);
      if (value && !evidence.includes(value)) evidence.push(value);
    }
    const explicitEvidence = clean(byField.get('evidence_ref') && byField.get('evidence_ref').observed_value);
    if (explicitEvidence && !evidence.includes(explicitEvidence)) evidence.push(explicitEvidence);

    const result = [
      `source: ${observed('source_branch')}`,
      `folder: ${observed('publish_folder')}`,
      `domain: ${observed('custom_domain')}`,
      `HTTPS: ${observed('https_enforcement')}`,
      `deployment: ${observed('deployment_status')}`,
      `URL: ${observed('deployment_url')}`
    ].join('; ');

    const nextAction = summary.status === 'passed'
      ? 'Повторять ручную проверку после изменения Pages settings или способа публикации'
      : summary.status === 'warning'
        ? 'Исправить отмеченные несоответствия и повторить ручную проверку Settings > Pages'
        : 'Завершить ручную проверку Settings > Pages и заполнить недостающие пункты';

    return {
      check_id: 'actions-013',
      group: 'manual-check',
      subject: 'GitHub Pages deployment',
      result,
      evidence: evidence.join('; '),
      status: summary.status,
      next_action: nextAction,
      checked_at: isIsoDate(observed('checked_at')) ? observed('checked_at') : ''
    };
  }

  function serializeActionsDiagnosticRow(rows) {
    const item = buildActionsDiagnosticRow(rows);
    return ['check_id', 'group', 'subject', 'result', 'evidence', 'status', 'next_action', 'checked_at']
      .map((header) => csvEscape(item[header])).join(',');
  }

  function mergeDraft(templateRows, draftRows) {
    const draftById = new Map((Array.isArray(draftRows) ? draftRows : []).map((row) => [clean(row.item_id), row]));
    return (templateRows || []).map((row) => {
      const draft = draftById.get(clean(row.item_id));
      if (!draft) return { ...row };
      return {
        ...row,
        observed_value: clean(draft.observed_value),
        status: ALLOWED_STATUSES.includes(clean(draft.status)) ? clean(draft.status) : 'not_checked',
        evidence_ref: clean(draft.evidence_ref)
      };
    });
  }

  function downloadText(documentRef, filename, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const link = documentRef.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  function mount(documentRef) {
    const root = documentRef.querySelector('[data-pages-manual-workspace]');
    if (!root) return;

    const itemsRoot = root.querySelector('#pages-manual-items');
    const progress = root.querySelector('#pages-manual-progress');
    const summaryNode = root.querySelector('#pages-manual-summary');
    const preview = root.querySelector('#pages-manual-actions-row');
    const statusNode = root.querySelector('#pages-manual-status');
    const downloadCsvButton = root.querySelector('#pages-manual-download-csv');
    const downloadDiagnosticButton = root.querySelector('#pages-manual-download-diagnostic');
    const copyDiagnosticButton = root.querySelector('#pages-manual-copy-diagnostic');
    const resetButton = root.querySelector('#pages-manual-reset');
    if (!itemsRoot || !progress || !summaryNode || !preview) return;

    let templateRows = [];
    let rows = [];

    function loadDraft() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch { return []; }
    }

    function saveDraft() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); }
      catch { /* Мастер продолжает работать без localStorage. */ }
    }

    function updateRow(index, field, value) {
      rows[index] = { ...rows[index], [field]: value };
      saveDraft();
      updateSummary();
    }

    function createControl(labelText, control) {
      const label = documentRef.createElement('label');
      label.className = 'field-group field-wide';
      const title = documentRef.createElement('span');
      title.textContent = labelText;
      label.append(title, control);
      return label;
    }

    function renderRows() {
      itemsRoot.replaceChildren();
      rows.forEach((row, index) => {
        const card = documentRef.createElement('article');
        card.className = 'card';
        card.dataset.pagesManualItem = row.item_id;
        const inner = documentRef.createElement('div');
        inner.className = 'card-inner';
        const heading = documentRef.createElement('h3');
        heading.textContent = `${index + 1}. ${row.label}`;
        const help = documentRef.createElement('p');
        help.className = 'tiny';
        help.textContent = `Где проверить: ${row.where_to_check}. Ожидается: ${row.expected_value}.`;
        const grid = documentRef.createElement('div');
        grid.className = 'form-grid';

        const observed = documentRef.createElement('input');
        observed.className = 'input';
        observed.type = row.field === 'checked_at' ? 'date' : 'text';
        observed.value = row.observed_value || '';
        observed.autocomplete = 'off';
        observed.addEventListener('input', () => updateRow(index, 'observed_value', observed.value));

        const select = documentRef.createElement('select');
        select.className = 'input';
        for (const value of ALLOWED_STATUSES) {
          const option = documentRef.createElement('option');
          option.value = value;
          option.textContent = value;
          select.appendChild(option);
        }
        select.value = row.status || 'not_checked';
        select.addEventListener('change', () => updateRow(index, 'status', select.value));

        const evidence = documentRef.createElement('input');
        evidence.className = 'input';
        evidence.type = 'text';
        evidence.value = row.evidence_ref || '';
        evidence.autocomplete = 'off';
        evidence.placeholder = 'Публичный URL или обезличенный код';
        evidence.addEventListener('input', () => updateRow(index, 'evidence_ref', evidence.value));

        const errors = documentRef.createElement('p');
        errors.className = 'field-hint';
        errors.dataset.pagesManualErrors = '';

        grid.append(
          createControl('Фактическое значение', observed),
          createControl('Статус пункта', select),
          createControl('Безопасная ссылка или код', evidence)
        );
        inner.append(heading, help, grid, errors);
        card.appendChild(inner);
        itemsRoot.appendChild(card);
      });
    }

    function updateSummary() {
      const summary = summarize(rows);
      progress.textContent = `${summary.checked} из ${summary.total}`;
      progress.className = `tag ${summary.passed ? 'ok' : summary.problems ? 'danger' : 'warn'}`;
      summaryNode.className = `notice${summary.passed ? ' ok' : ''}`;
      summaryNode.textContent = summary.passed
        ? 'Все восемь пунктов заполнены положительными статусами. Строка actions-013 может иметь статус passed.'
        : summary.problems
          ? `Есть проблемные статусы: ${summary.problems}. Строка actions-013 будет иметь статус warning.`
          : `Проверено ${summary.checked} из ${summary.total}. Строка actions-013 будет иметь статус pending.`;

      const diagnostic = serializeActionsDiagnosticRow(rows);
      preview.value = diagnostic;
      const canExportDiagnostic = summary.checked > 0 && summary.validation.valid;
      if (downloadDiagnosticButton) downloadDiagnosticButton.disabled = !canExportDiagnostic;
      if (copyDiagnosticButton) copyDiagnosticButton.disabled = !canExportDiagnostic;
      if (downloadCsvButton) downloadCsvButton.disabled = !rows.length;

      rows.forEach((row, index) => {
        const card = itemsRoot.querySelector(`[data-pages-manual-item="${row.item_id}"]`);
        const errorNode = card && card.querySelector('[data-pages-manual-errors]');
        const issues = summary.validation.rowErrors[index] || [];
        if (errorNode) errorNode.textContent = issues.length ? issues.join('; ') : 'Пункт заполнен без структурных ошибок.';
        card?.classList.toggle('field-error', issues.length > 0);
      });
      if (statusNode) statusNode.textContent = summary.validation.valid
        ? 'Черновик хранится только в этом браузере. Перед коммитом проверьте, что ссылки не раскрывают закрытые данные.'
        : `Исправьте ошибки: ${summary.validation.errors.slice(0, 3).join('; ')}`;
    }

    async function copyDiagnostic() {
      const text = preview.value;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
        else {
          preview.removeAttribute('readonly');
          preview.select();
          documentRef.execCommand('copy');
          preview.setAttribute('readonly', '');
        }
        if (statusNode) statusNode.textContent = 'Строка actions-013 скопирована.';
      } catch {
        if (statusNode) statusNode.textContent = 'Не удалось скопировать автоматически. Выделите строку вручную.';
      }
    }

    downloadCsvButton?.addEventListener('click', () => {
      downloadText(documentRef, 'github_pages_manual_check_completed.csv', `\uFEFF${serializeCsv(rows)}`, 'text/csv;charset=utf-8');
    });
    downloadDiagnosticButton?.addEventListener('click', () => {
      downloadText(documentRef, 'actions-013.csv', `\uFEFF${serializeActionsDiagnosticRow(rows)}\r\n`, 'text/csv;charset=utf-8');
    });
    copyDiagnosticButton?.addEventListener('click', copyDiagnostic);
    resetButton?.addEventListener('click', () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      rows = templateRows.map((row) => ({ ...row }));
      renderRows();
      updateSummary();
      if (statusNode) statusNode.textContent = 'Локальный черновик сброшен. Репозиторный шаблон не изменён.';
    });

    fetch('/data/github_pages_manual_check_template.csv', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => {
        templateRows = parseCsv(text);
        rows = mergeDraft(templateRows, loadDraft());
        renderRows();
        updateSummary();
      })
      .catch((error) => {
        summaryNode.textContent = `Не удалось загрузить шаблон: ${error.message}`;
        progress.textContent = 'Ошибка';
        progress.className = 'tag danger';
        if (statusNode) statusNode.textContent = 'Скачайте исходный CSV по ссылке выше и заполните его локально.';
      });
  }

  return Object.freeze({
    ALLOWED_STATUSES,
    EXPECTED_ITEMS,
    HEADERS,
    STORAGE_KEY,
    buildActionsDiagnosticRow,
    isIsoDate,
    mergeDraft,
    mount,
    parseCsv,
    parseCsvMatrix,
    rowIssues,
    serializeActionsDiagnosticRow,
    serializeCsv,
    summarize,
    validateRows
  });
}));
