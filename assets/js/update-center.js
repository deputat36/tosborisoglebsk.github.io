(() => {
  'use strict';

  const STORAGE_KEY = 'tos-update-center-draft-v3';
  const LEGACY_STORAGE_KEY = 'tos-update-center-draft-v2';
  const scenarios = window.TOS_UPDATE_SCENARIOS || {};
  const labels = window.TOS_UPDATE_LABELS || {};
  const quality = window.TOS_UPDATE_QUALITY;
  let currentScenario = 'card';
  let tosItems = [];

  const form = document.querySelector('#update-form');
  const fieldsRoot = document.querySelector('#dynamic-fields');
  const preview = document.querySelector('#message-preview');
  const tosSelect = document.querySelector('#tos-select');
  const status = document.querySelector('#copy-status');
  const scenarioGrid = document.querySelector('#scenario-grid');
  const qualityList = document.querySelector('#quality-list');

  if (!form || !fieldsRoot || !preview || !tosSelect || !scenarioGrid || !qualityList || !scenarios.card || !quality?.evaluate) return;

  const clean = (value) => String(value ?? '').trim();

  function readStorage(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch { return {}; }
  }

  function loadDraft() {
    const current = readStorage(STORAGE_KEY);
    return Object.keys(current).length ? current : readStorage(LEGACY_STORAGE_KEY);
  }

  function formValues() {
    const result = {};
    new FormData(form).forEach((value, key) => { result[key] = clean(value); });
    return result;
  }

  function saveDraft() {
    try {
      const previous = loadDraft();
      const scenarioValues = { ...(previous.scenarioValues || {}) };
      scenarioValues[currentScenario] = formValues();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        scenario: currentScenario,
        tos: tosSelect.value,
        scenarioValues,
        confirmed: Boolean(form.elements.confirmed?.checked),
        publicationChecked: Boolean(form.elements.publication_checked?.checked)
      }));
    } catch {
      // Конструктор продолжает работать, даже если localStorage недоступен.
    }
  }

  function createField(definition) {
    const label = document.createElement('label');
    label.className = `field-group${definition.required ? ' field-required' : ''}${definition.type === 'textarea' ? ' field-wide' : ''}`;

    const title = document.createElement('span');
    title.textContent = definition.label;
    label.appendChild(title);

    let control;
    if (definition.type === 'textarea') {
      control = document.createElement('textarea');
    } else if (definition.type === 'select') {
      control = document.createElement('select');
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = 'Выберите вариант';
      control.appendChild(emptyOption);
      (definition.options || []).forEach((optionValue) => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        control.appendChild(option);
      });
    } else {
      control = document.createElement('input');
      control.type = definition.type || 'text';
    }

    control.className = 'input';
    control.name = definition.name;
    control.required = Boolean(definition.required);
    if ('placeholder' in control) control.placeholder = definition.placeholder || '';
    label.appendChild(control);

    if (definition.placeholder && definition.type === 'select') {
      const hint = document.createElement('small');
      hint.className = 'field-hint';
      hint.textContent = definition.placeholder;
      label.appendChild(hint);
    }

    return label;
  }

  function restoreDraftValues() {
    const draft = loadDraft();
    const saved = draft.scenarioValues?.[currentScenario] || (draft.scenario === currentScenario ? draft.values : {}) || {};
    Object.entries(saved).forEach(([name, value]) => {
      if (form.elements[name] && name !== 'confirmed' && name !== 'publication_checked') form.elements[name].value = value;
    });
    if (form.elements.confirmed) form.elements.confirmed.checked = Boolean(draft.confirmed);
    if (form.elements.publication_checked) form.elements.publication_checked.checked = Boolean(draft.publicationChecked);
  }

  function selectedTos() {
    return tosItems.find((item) => item.slug === tosSelect.value) || null;
  }

  function buildMessage() {
    const scenario = scenarios[currentScenario];
    const data = formValues();
    const tos = selectedTos();
    const lines = [scenario.title];

    if (tos) {
      lines.push(`ТОС: ${tos.title || `ТОС «${tos.name}»`}`);
      lines.push(`Карточка: https://tosborisoglebsk.ru/tos/${tos.slug}/`);
    } else if (data.tos_custom) {
      lines.push(`ТОС / территория: ${data.tos_custom}`);
    }

    scenario.fields.forEach((field) => {
      const value = data[field.name];
      if (value) lines.push(`${labels[field.name] || field.label}: ${value}`);
    });

    if (data.contact) lines.push(`Контакт для уточнения: ${data.contact}`);
    lines.push('', 'Материал передан для проверки редакцией портала ТОС БГО. Публикация и статус подтверждения определяются отдельно после проверки.');
    return lines.join('\n');
  }

  function missingRequired() {
    return scenarios[currentScenario].fields.filter((field) => field.required && !clean(form.elements[field.name]?.value));
  }

  function qualityResult() {
    return quality.evaluate({
      scenarioKey: currentScenario,
      scenario: scenarios[currentScenario],
      data: formValues(),
      tosSelected: Boolean(selectedTos()),
      confirmed: Boolean(form.elements.confirmed?.checked),
      publicationChecked: Boolean(form.elements.publication_checked?.checked)
    });
  }

  function renderQuality(result) {
    const score = document.querySelector('#quality-score');
    const summary = document.querySelector('#quality-summary');
    score.textContent = `${result.passed} из ${result.total}`;
    score.className = `tag ${result.ready ? 'ok' : result.percent >= 60 ? 'warn' : ''}`.trim();
    summary.textContent = result.ready
      ? 'Обязательные проверки пройдены. Рекомендации без галочки можно уточнить до отправки.'
      : `Нужно устранить обязательных замечаний: ${result.blocking.length}.`;

    qualityList.replaceChildren(...result.checks.map((check) => {
      const item = document.createElement('li');
      item.className = `quality-item ${check.passed ? 'is-passed' : check.blocking ? 'is-blocking' : 'is-advisory'}`;

      const marker = document.createElement('span');
      marker.className = 'quality-marker';
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = check.passed ? '✓' : check.blocking ? '!' : 'i';

      const text = document.createElement('span');
      const title = document.createElement('b');
      title.textContent = check.label;
      text.appendChild(title);
      if (!check.passed && check.hint) {
        const hint = document.createElement('small');
        hint.textContent = check.hint;
        text.appendChild(hint);
      }

      item.append(marker, text);
      return item;
    }));
  }

  function updatePreview() {
    preview.value = buildMessage();
    const result = qualityResult();
    const missing = missingRequired();
    const requiredStatus = document.querySelector('#required-status');
    const progress = document.querySelector('#builder-progress');
    const panel = document.querySelector('.update-preview');

    renderQuality(result);

    if (result.ready) {
      requiredStatus.textContent = 'Сообщение готово';
      requiredStatus.className = 'tag ok';
      progress.textContent = 'Готово к отправке';
      panel.classList.add('is-ready');
    } else {
      requiredStatus.textContent = missing.length ? `Не заполнено: ${missing.length}` : 'Подтвердите две проверки';
      requiredStatus.className = 'tag warn';
      progress.textContent = missing.length ? 'Шаг 2 из 4' : 'Шаг 3 из 4';
      panel.classList.remove('is-ready');
    }
    saveDraft();
  }

  function renderFields() {
    const scenario = scenarios[currentScenario];
    fieldsRoot.replaceChildren(...scenario.fields.map(createField));
    document.querySelector('#scenario-help').textContent = scenario.help;
    restoreDraftValues();
    updatePreview();
  }

  function updateScenarioButtons() {
    document.querySelectorAll('.scenario-card').forEach((button) => {
      const active = button.dataset.scenario === currentScenario;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function updateTosLink() {
    const item = selectedTos();
    const hint = document.querySelector('#tos-card-link');
    if (!item) {
      hint.textContent = 'Выберите ТОС, чтобы ссылка на карточку добавилась автоматически.';
      return;
    }
    hint.replaceChildren();
    const link = document.createElement('a');
    link.href = `/tos/${item.slug}/`;
    link.textContent = 'Открыть текущую карточку ТОС';
    link.target = '_blank';
    link.rel = 'noopener';
    hint.appendChild(link);
  }

  async function loadTos() {
    try {
      const response = await fetch('/data/toses.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('catalog unavailable');
      tosItems = (await response.json()).filter((item) => item && item.status !== 'draft' && item.slug);
      tosItems.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
      tosItems.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.slug;
        option.textContent = `${item.title || `ТОС «${item.name}»`} — ${item.location || 'территория уточняется'}`;
        tosSelect.appendChild(option);
      });

      const queryTos = new URLSearchParams(location.search).get('tos');
      const draft = loadDraft();
      if (queryTos && tosItems.some((item) => item.slug === queryTos)) tosSelect.value = queryTos;
      else if (draft.tos && tosItems.some((item) => item.slug === draft.tos)) tosSelect.value = draft.tos;
      updateTosLink();
      updatePreview();
    } catch {
      document.querySelector('#tos-card-link').textContent = 'Каталог не загрузился. Укажите название ТОС или территорию в поле ниже.';
    }
  }

  function markErrors() {
    form.querySelectorAll('.field-error').forEach((element) => element.classList.remove('field-error'));
    missingRequired().forEach((field) => form.elements[field.name]?.classList.add('field-error'));
    if (!form.elements.confirmed.checked) form.elements.confirmed.closest('.consent-row')?.classList.add('field-error');
    if (!form.elements.publication_checked.checked) form.elements.publication_checked.closest('.consent-row')?.classList.add('field-error');
  }

  function readyToExport() {
    markErrors();
    const result = qualityResult();
    if (!result.ready) {
      status.textContent = 'Заполните обязательные поля и подтвердите две проверки перед отправкой.';
      document.querySelector('#quality-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  async function copyMessage() {
    if (!readyToExport()) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(preview.value);
      else {
        preview.removeAttribute('readonly');
        preview.select();
        document.execCommand('copy');
        preview.setAttribute('readonly', '');
      }
      status.textContent = 'Сообщение скопировано. Теперь его можно отправить редакции.';
    } catch {
      status.textContent = 'Не удалось скопировать автоматически. Выделите текст вручную.';
    }
  }

  function downloadMessage() {
    if (!readyToExport()) return;
    const blob = new Blob([preview.value], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tos-${currentScenario}-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function resetForm() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {}
    form.reset();
    tosSelect.value = '';
    currentScenario = 'card';
    updateScenarioButtons();
    renderFields();
    updateTosLink();
    status.textContent = 'Форма очищена.';
  }

  scenarioGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.scenario-card');
    if (!button || !scenarios[button.dataset.scenario]) return;
    saveDraft();
    currentScenario = button.dataset.scenario;
    updateScenarioButtons();
    renderFields();
  });

  form.addEventListener('input', updatePreview);
  form.addEventListener('change', updatePreview);
  tosSelect.addEventListener('change', () => { updateTosLink(); updatePreview(); });
  document.querySelector('#copy-message').addEventListener('click', copyMessage);
  document.querySelector('#download-message').addEventListener('click', downloadMessage);
  document.querySelector('#reset-form').addEventListener('click', resetForm);
  document.querySelector('#fill-example').addEventListener('click', () => {
    status.textContent = scenarios[currentScenario].help;
    form.querySelector('[required]')?.focus();
  });

  const draft = loadDraft();
  const params = new URLSearchParams(location.search);
  const hashScenario = location.hash.replace(/^#template-/, '').replace(/^#/, '');
  const queryScenario = params.get('type') || params.get('scenario') || (scenarios[hashScenario] ? hashScenario : '');
  if (queryScenario && scenarios[queryScenario]) currentScenario = queryScenario;
  else if (draft.scenario && scenarios[draft.scenario]) currentScenario = draft.scenario;
  updateScenarioButtons();
  renderFields();
  loadTos();
})();