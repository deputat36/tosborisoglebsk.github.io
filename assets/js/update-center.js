(() => {
  'use strict';

  const STORAGE_KEY = 'tos-update-center-draft-v2';
  const scenarios = window.TOS_UPDATE_SCENARIOS || {};
  const labels = window.TOS_UPDATE_LABELS || {};
  let currentScenario = 'card';
  let tosItems = [];

  const form = document.querySelector('#update-form');
  const fieldsRoot = document.querySelector('#dynamic-fields');
  const preview = document.querySelector('#message-preview');
  const tosSelect = document.querySelector('#tos-select');
  const status = document.querySelector('#copy-status');
  const scenarioGrid = document.querySelector('#scenario-grid');

  if (!form || !fieldsRoot || !preview || !tosSelect || !scenarioGrid || !scenarios.card) return;

  const clean = (value) => String(value ?? '').trim();

  function loadDraft() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
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
        confirmed: Boolean(form.elements.confirmed?.checked)
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

    const control = definition.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
    control.className = 'input';
    control.name = definition.name;
    control.required = Boolean(definition.required);
    control.placeholder = definition.placeholder || '';
    if (definition.type !== 'textarea') control.type = definition.type || 'text';
    label.appendChild(control);
    return label;
  }

  function restoreDraftValues() {
    const draft = loadDraft();
    const saved = draft.scenarioValues?.[currentScenario] || (draft.scenario === currentScenario ? draft.values : {}) || {};
    Object.entries(saved).forEach(([name, value]) => {
      if (form.elements[name]) form.elements[name].value = value;
    });
    if (form.elements.confirmed) form.elements.confirmed.checked = Boolean(draft.confirmed);
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
      lines.push(`ТОС: ${data.tos_custom}`);
    }

    scenario.fields.forEach((field) => {
      const value = data[field.name];
      if (value) lines.push(`${labels[field.name] || field.label}: ${value}`);
    });

    if (data.contact) lines.push(`Контакт для уточнения: ${data.contact}`);
    lines.push('', 'Материал передан для проверки редакцией портала ТОС БГО.');
    return lines.join('\n');
  }

  function missingRequired() {
    return scenarios[currentScenario].fields.filter((field) => field.required && !clean(form.elements[field.name]?.value));
  }

  function updatePreview() {
    preview.value = buildMessage();
    const missing = missingRequired();
    const confirmed = Boolean(form.elements.confirmed?.checked);
    const requiredStatus = document.querySelector('#required-status');
    const progress = document.querySelector('#builder-progress');
    const panel = document.querySelector('.update-preview');

    if (!missing.length && confirmed) {
      requiredStatus.textContent = 'Сообщение готово';
      requiredStatus.className = 'tag ok';
      progress.textContent = 'Готово к отправке';
      panel.classList.add('is-ready');
    } else {
      requiredStatus.textContent = missing.length ? `Не заполнено: ${missing.length}` : 'Подтвердите сведения';
      requiredStatus.className = 'tag warn';
      progress.textContent = 'Шаг 2 из 3';
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
      document.querySelector('#tos-card-link').textContent = 'Каталог не загрузился. Укажите название ТОС в поле ниже.';
    }
  }

  function markErrors() {
    form.querySelectorAll('.field-error').forEach((element) => element.classList.remove('field-error'));
    missingRequired().forEach((field) => form.elements[field.name]?.classList.add('field-error'));
    if (!form.elements.confirmed.checked) form.elements.confirmed.closest('.consent-row')?.classList.add('field-error');
  }

  function readyToExport() {
    markErrors();
    if (missingRequired().length || !form.elements.confirmed.checked) {
      status.textContent = 'Заполните обязательные поля и подтвердите сведения.';
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
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
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
  const queryScenario = new URLSearchParams(location.search).get('type');
  if (queryScenario && scenarios[queryScenario]) currentScenario = queryScenario;
  else if (draft.scenario && scenarios[draft.scenario]) currentScenario = draft.scenario;
  updateScenarioButtons();
  renderFields();
  loadTos();
})();
