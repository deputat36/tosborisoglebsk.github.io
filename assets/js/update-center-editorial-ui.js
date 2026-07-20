(() => {
  'use strict';

  const exporter = window.TOS_UPDATE_EDITORIAL_EXPORT;
  const scenarios = window.TOS_UPDATE_SCENARIOS || {};
  const form = document.querySelector('#update-form');
  const tosSelect = document.querySelector('#tos-select');
  const status = document.querySelector('#copy-status');
  const intakeButton = document.querySelector('#download-intake-csv');
  const queueButton = document.querySelector('#download-queue-csv');

  if (!exporter?.buildPackage || !form || !tosSelect || !status || !intakeButton || !queueButton) return;

  const clean = (value) => String(value ?? '').trim();

  function formValues() {
    const result = {};
    new FormData(form).forEach((value, key) => { result[key] = clean(value); });
    return result;
  }

  function scenarioKey() {
    return document.querySelector('.scenario-card.is-active')?.dataset.scenario || 'card';
  }

  function tosName(data) {
    if (tosSelect.value) {
      const label = clean(tosSelect.selectedOptions?.[0]?.textContent);
      return label.split(' — ')[0];
    }
    return clean(data.tos_custom);
  }

  function readyForEditorialExport() {
    const requiredStatus = document.querySelector('#required-status');
    const ready = requiredStatus?.classList.contains('ok') && clean(document.querySelector('#message-preview')?.value);
    if (ready) return true;

    status.textContent = 'Сначала заполните обязательные поля и пройдите проверку готовности.';
    document.querySelector('#quality-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  function currentPackage() {
    const key = scenarioKey();
    const data = formValues();
    return exporter.buildPackage({
      scenarioKey: key,
      scenario: scenarios[key] || {},
      data,
      tosName: tosName(data),
      generatedAt: new Date()
    });
  }

  function downloadCsv(csv, filename) {
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadIntake() {
    if (!readyForEditorialExport()) return;
    const packet = currentPackage();
    downloadCsv(packet.intakeCsv, `${packet.fileStem}-content-intake.csv`);
    status.textContent = 'Карточка приёма скачана как локальный draft. Перед публикацией её должен проверить редактор.';
  }

  function downloadQueue() {
    if (!readyForEditorialExport()) return;
    const packet = currentPackage();
    downloadCsv(packet.queueCsv, `${packet.fileStem}-publication-queue.csv`);
    status.textContent = 'Строка очереди скачана как локальный draft. Она не добавлена в реестр автоматически.';
  }

  intakeButton.addEventListener('click', downloadIntake);
  queueButton.addEventListener('click', downloadQueue);
})();
