(() => {
  'use strict';

  const validation = window.PublicationQueueImportValidation;
  const queueInput = document.querySelector('#queue-import-file');
  const intakeInput = document.querySelector('#intake-import-file');
  const currentStatus = document.querySelector('#current-queue-status');
  const importStatus = document.querySelector('#import-status');
  const summary = document.querySelector('#import-summary');
  const list = document.querySelector('#import-candidate-list');
  const downloadApprovedButton = document.querySelector('#download-approved-rows');
  const downloadMergedButton = document.querySelector('#download-merged-preview');
  const resetButton = document.querySelector('#reset-import');

  if (!validation || !queueInput || !intakeInput || !currentStatus || !importStatus || !summary || !list || !downloadApprovedButton || !downloadMergedButton || !resetButton) return;

  const state = {
    currentRows: [],
    queueRows: [],
    intakeRows: [],
    analysis: [],
    currentLoaded: false,
    approved: new Set(),
    duplicateOverrides: new Set()
  };

  const clean = (value) => String(value ?? '').trim();

  function setStatus(element, message, type = '') {
    element.textContent = message;
    element.className = `notice compact${type ? ` ${type}` : ''}`;
  }

  function readLocalFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Не удалось прочитать выбранный файл.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  function downloadCsv(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function approvedRows() {
    return state.analysis
      .filter((item) => item.canApprove)
      .filter((item) => state.approved.has(item.index))
      .filter((item) => !item.requiresDuplicateOverride || state.duplicateOverrides.has(item.index))
      .map((item) => item.row);
  }

  function refreshActions() {
    const approved = approvedRows();
    downloadApprovedButton.disabled = !state.currentLoaded || approved.length === 0;
    downloadMergedButton.disabled = !state.currentLoaded || approved.length === 0;

    const total = state.analysis.length;
    const valid = state.analysis.filter((item) => item.valid).length;
    const exact = state.analysis.filter((item) => item.duplicate.level === 'exact').length;
    const possible = state.analysis.filter((item) => item.duplicate.level === 'possible').length;
    summary.innerHTML = [
      `<div class="stat"><b>${total}</b><span>строк загружено</span></div>`,
      `<div class="stat"><b>${valid}</b><span>прошли схему</span></div>`,
      `<div class="stat"><b>${exact}</b><span>точных дублей</span></div>`,
      `<div class="stat"><b>${possible}</b><span>похожих строк</span></div>`,
      `<div class="stat"><b>${approved.length}</b><span>подтверждено вручную</span></div>`
    ].join('');
  }

  function detail(label, value) {
    const item = document.createElement('div');
    item.className = 'import-detail';
    const title = document.createElement('b');
    title.textContent = label;
    const text = document.createElement('span');
    text.textContent = clean(value) || 'не указано';
    item.append(title, text);
    return item;
  }

  function issueList(messages, className) {
    const root = document.createElement('ul');
    root.className = className;
    messages.forEach((message) => {
      const item = document.createElement('li');
      item.textContent = message;
      root.appendChild(item);
    });
    return root;
  }

  function renderCandidate(item) {
    const card = document.createElement('article');
    card.className = `card import-candidate${item.valid ? '' : ' is-invalid'}${item.duplicate.level === 'exact' ? ' is-duplicate' : ''}`;

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const head = document.createElement('div');
    head.className = 'import-candidate-head';
    const heading = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.className = 'tag';
    eyebrow.textContent = item.row.submission_type || 'тип не указан';
    const title = document.createElement('h3');
    title.textContent = item.row.title || `Строка ${item.index + 1}`;
    heading.append(eyebrow, title);

    const statusTag = document.createElement('span');
    if (!item.valid) {
      statusTag.className = 'tag danger';
      statusTag.textContent = 'ошибка';
    } else if (item.duplicate.level === 'exact') {
      statusTag.className = 'tag danger';
      statusTag.textContent = 'дубль';
    } else if (item.duplicate.level === 'possible') {
      statusTag.className = 'tag warn';
      statusTag.textContent = 'похожая строка';
    } else {
      statusTag.className = 'tag ok';
      statusTag.textContent = 'новая строка';
    }
    head.append(heading, statusTag);

    const details = document.createElement('div');
    details.className = 'import-details';
    details.append(
      detail('Queue ID', item.row.queue_id),
      detail('ТОС', item.row.tos_name),
      detail('Целевой файл', item.row.target_file),
      detail('Следующий шаг', item.row.next_step)
    );

    inner.append(head, details);

    if (item.errors.length) inner.appendChild(issueList(item.errors, 'import-issues danger-list'));
    if (item.intakeErrors.length) inner.appendChild(issueList(item.intakeErrors.map((message) => `Карточка приёма: ${message}`), 'import-issues danger-list'));
    if (item.duplicate.reason) inner.appendChild(issueList([item.duplicate.reason], `import-issues ${item.duplicate.level === 'exact' ? 'danger-list' : 'warn-list'}`));

    if (item.intakeRow) {
      const intake = document.createElement('div');
      intake.className = 'notice compact intake-context';
      const source = clean(item.intakeRow.source_person) || 'не указан';
      const date = clean(item.intakeRow.event_or_fact_date) || 'не указана';
      const contact = clean(item.intakeRow.source_contact) ? 'есть, остаётся только в локальной карточке' : 'не указан';
      intake.textContent = `Карточка приёма сопоставлена. Источник: ${source}. Дата: ${date}. Контакт: ${contact}.`;
      inner.appendChild(intake);
    }

    const controls = document.createElement('div');
    controls.className = 'import-review-controls';

    if (item.requiresDuplicateOverride && item.canApprove) {
      const overrideLabel = document.createElement('label');
      overrideLabel.className = 'consent-row';
      const override = document.createElement('input');
      override.type = 'checkbox';
      override.checked = state.duplicateOverrides.has(item.index);
      override.addEventListener('change', () => {
        if (override.checked) state.duplicateOverrides.add(item.index);
        else {
          state.duplicateOverrides.delete(item.index);
          state.approved.delete(item.index);
          approve.checked = false;
        }
        approve.disabled = !override.checked;
        refreshActions();
      });
      const overrideText = document.createElement('span');
      overrideText.textContent = 'Я сравнил(а) похожий материал и подтверждаю, что это не дубль.';
      overrideLabel.append(override, overrideText);
      controls.appendChild(overrideLabel);
    }

    const approveLabel = document.createElement('label');
    approveLabel.className = 'consent-row';
    const approve = document.createElement('input');
    approve.type = 'checkbox';
    approve.checked = state.approved.has(item.index);
    approve.disabled = !state.currentLoaded || !item.canApprove || (item.requiresDuplicateOverride && !state.duplicateOverrides.has(item.index));
    approve.addEventListener('change', () => {
      if (approve.checked) state.approved.add(item.index);
      else state.approved.delete(item.index);
      refreshActions();
    });
    const approveText = document.createElement('span');
    approveText.textContent = 'Проверил(а) эту строку вручную и включаю её в локальный draft-экспорт.';
    approveLabel.append(approve, approveText);
    controls.appendChild(approveLabel);

    inner.appendChild(controls);
    card.appendChild(inner);
    return card;
  }

  function refreshAnalysis() {
    state.analysis = validation.analyze(state.queueRows, state.currentRows, state.intakeRows);
    state.approved.clear();
    state.duplicateOverrides.clear();
    list.replaceChildren(...state.analysis.map(renderCandidate));
    if (!state.analysis.length) {
      const empty = document.createElement('div');
      empty.className = 'notice';
      empty.textContent = 'Выберите CSV строки очереди, созданный конструктором материалов.';
      list.appendChild(empty);
    }
    refreshActions();
  }

  async function loadCurrentQueue() {
    try {
      const response = await fetch('/data/publication_queue.csv', { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.currentRows = validation.parseDocument(await response.text(), validation.QUEUE_HEADERS);
      state.currentLoaded = true;
      setStatus(currentStatus, `Рабочая очередь загружена: ${state.currentRows.length} строк. Сравнение дублей доступно.`, 'ok-notice');
    } catch (error) {
      state.currentRows = [];
      state.currentLoaded = false;
      setStatus(currentStatus, `Не удалось загрузить рабочую очередь: ${error.message}. Экспорт заблокирован, чтобы не пропустить дубли.`, 'danger-notice');
    }
    refreshAnalysis();
  }

  async function handleQueueFile() {
    const file = queueInput.files?.[0];
    if (!file) {
      state.queueRows = [];
      setStatus(importStatus, 'CSV строки очереди не выбран.');
      refreshAnalysis();
      return;
    }
    try {
      state.queueRows = validation.parseDocument(await readLocalFile(file), validation.QUEUE_HEADERS);
      setStatus(importStatus, `Файл очереди прочитан: ${state.queueRows.length} строк. Проверьте каждую строку ниже.`, 'ok-notice');
    } catch (error) {
      state.queueRows = [];
      setStatus(importStatus, `Файл очереди отклонён: ${error.message}`, 'danger-notice');
    }
    refreshAnalysis();
  }

  async function handleIntakeFile() {
    const file = intakeInput.files?.[0];
    if (!file) {
      state.intakeRows = [];
      refreshAnalysis();
      return;
    }
    try {
      const rows = validation.parseDocument(await readLocalFile(file), validation.INTAKE_HEADERS);
      const invalid = rows.flatMap((row, index) => validation.validateIntakeRow(row).map((message) => `строка ${index + 2}: ${message}`));
      if (invalid.length) throw new Error(invalid.slice(0, 3).join(' '));
      state.intakeRows = rows;
      setStatus(importStatus, `Карточка приёма прочитана: ${rows.length} строк. Она используется только для локального контекста.`, 'ok-notice');
    } catch (error) {
      state.intakeRows = [];
      setStatus(importStatus, `Карточка приёма отклонена: ${error.message}`, 'danger-notice');
    }
    refreshAnalysis();
  }

  function resetImport() {
    queueInput.value = '';
    intakeInput.value = '';
    state.queueRows = [];
    state.intakeRows = [];
    state.approved.clear();
    state.duplicateOverrides.clear();
    setStatus(importStatus, 'Локальные файлы очищены. Рабочая очередь на сайте не изменялась.');
    refreshAnalysis();
  }

  queueInput.addEventListener('change', handleQueueFile);
  intakeInput.addEventListener('change', handleIntakeFile);
  resetButton.addEventListener('click', resetImport);

  downloadApprovedButton.addEventListener('click', () => {
    const rows = approvedRows();
    if (!rows.length || !state.currentLoaded) return;
    downloadCsv(`publication-queue-approved-${new Date().toISOString().slice(0, 10)}.csv`, validation.toCsv(validation.QUEUE_HEADERS, rows));
    setStatus(importStatus, `Скачаны только подтверждённые строки: ${rows.length}. Репозиторий не изменён.`, 'ok-notice');
  });

  downloadMergedButton.addEventListener('click', () => {
    const rows = approvedRows();
    if (!rows.length || !state.currentLoaded) return;
    const merged = [...state.currentRows, ...rows];
    downloadCsv(`publication_queue.merged-preview-${new Date().toISOString().slice(0, 10)}.csv`, validation.toCsv(validation.QUEUE_HEADERS, merged));
    setStatus(importStatus, `Скачан локальный предпросмотр объединённой очереди: ${merged.length} строк. Он не загружен на сайт.`, 'ok-notice');
  });

  refreshAnalysis();
  loadCurrentQueue();
})();
