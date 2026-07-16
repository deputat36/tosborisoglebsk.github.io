(() => {
  'use strict';

  const api = window.OutreachExecution;
  const root = document.querySelector('#outreach-execution-root');
  if (!api || !root) return;

  const STORAGE_KEY = 'tos-outreach-execution-v1';
  const groupLabels = {
    registry: 'Полный реестр',
    priority_card: 'Приоритетная карточка',
    candidate_registry: 'Кандидат реестра',
    project_result: 'Проект 2026'
  };
  let items = [];
  let sources = { priority: [], candidates: [], projects: [] };
  let selectedId = '';

  const clean = (value) => String(value == null ? '' : value).trim();
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveStore(store) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    catch { /* Работа продолжается без localStorage. */ }
  }

  function currentItem() {
    return items.find((item) => item.outreach_id === selectedId) || items[0] || null;
  }

  function currentDraft() {
    const item = currentItem();
    if (!item) return {};
    return loadStore().drafts?.[item.outreach_id] || {};
  }

  function storeDraft(draft) {
    const item = currentItem();
    if (!item) return;
    const store = loadStore();
    store.selected = item.outreach_id;
    store.drafts = { ...(store.drafts || {}), [item.outreach_id]: draft };
    saveStore(store);
  }

  function formDraft() {
    const form = root.querySelector('#outreach-execution-form');
    if (!form) return {};
    const data = Object.fromEntries(new FormData(form).entries());
    return {
      channel: clean(data.channel),
      contact: clean(data.contact),
      owner: clean(data.owner),
      sent_date: clean(data.sent_date),
      follow_up_date: clean(data.follow_up_date),
      evidence_ref: clean(data.evidence_ref),
      note: clean(data.note),
      actual_sent: Boolean(form.elements.actual_sent?.checked)
    };
  }

  function requestText(item) {
    return api.buildRequestText(item, sources);
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  async function copyText(text, statusText) {
    const status = root.querySelector('#outreach-execution-status');
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      if (status) status.textContent = statusText;
    } catch {
      if (status) status.textContent = 'Не удалось скопировать автоматически. Используйте поле с текстом запроса.';
    }
  }

  function renderStatus() {
    const item = currentItem();
    const draft = formDraft();
    const result = api.validateExecution(item, draft);
    const badge = root.querySelector('#outreach-execution-badge');
    const status = root.querySelector('#outreach-execution-status');
    const exportButton = root.querySelector('#outreach-download-row');
    if (!badge || !status || !exportButton) return;

    if (!draft.actual_sent) {
      badge.textContent = 'Подготовка';
      badge.className = 'tag warn';
      status.textContent = result.errors.length
        ? result.errors.join('; ')
        : 'Можно копировать текст и скачать карточку подготовки. Статус CSV не изменяется.';
      exportButton.disabled = true;
      return;
    }

    if (result.valid) {
      badge.textContent = 'Готово к фиксации sent';
      badge.className = 'tag ok';
      status.textContent = 'Все обязательные поля заполнены. Экспорт создаст одну строку для последующей проверки и ручного внесения в журнал.';
      exportButton.disabled = false;
    } else {
      badge.textContent = 'Не готово';
      badge.className = 'tag warn';
      status.textContent = result.errors.join('; ');
      exportButton.disabled = true;
    }
  }

  function bindForm() {
    const form = root.querySelector('#outreach-execution-form');
    if (!form) return;
    form.addEventListener('input', () => {
      storeDraft(formDraft());
      renderStatus();
    });
    form.addEventListener('change', () => {
      storeDraft(formDraft());
      renderStatus();
    });

    root.querySelector('#outreach-copy-request')?.addEventListener('click', () => {
      copyText(requestText(currentItem()), 'Текст запроса скопирован. Отправка выполняется вручную через выбранный канал.');
    });
    root.querySelector('#outreach-download-preflight')?.addEventListener('click', () => {
      const item = currentItem();
      download(`${item.outreach_id}-preflight.txt`, api.buildPreflightText(item, requestText(item), formDraft()));
    });
    root.querySelector('#outreach-download-row')?.addEventListener('click', () => {
      const item = currentItem();
      const draft = formDraft();
      const result = api.validateExecution(item, draft);
      if (!result.valid || !result.actualSent) { renderStatus(); return; }
      download(`${item.outreach_id}-sent-row.csv`, `\ufeff${api.serializeUpdatedRow(item, draft)}`, 'text/csv;charset=utf-8');
    });
    root.querySelector('#outreach-reset-draft')?.addEventListener('click', () => {
      const item = currentItem();
      const store = loadStore();
      if (store.drafts) delete store.drafts[item.outreach_id];
      saveStore(store);
      renderWorkspace();
    });
  }

  function renderWorkspace() {
    const item = currentItem();
    if (!item) {
      root.innerHTML = '<div class="empty">В журнале нет черновиков для подготовки.</div>';
      return;
    }
    const draft = currentDraft();
    const message = requestText(item);
    const options = items.map((entry) => `<option value="${esc(entry.outreach_id)}"${entry.outreach_id === item.outreach_id ? ' selected' : ''}>${esc(entry.outreach_id)} — ${esc(entry.subject)}</option>`).join('');

    root.innerHTML = `<div class="section-head"><div><h2>Пакет отправки</h2><p>Подготовка сообщения и локальная фиксация исполнения без автоматического изменения журнала.</p></div><span class="tag warn" id="outreach-execution-badge">Подготовка</span></div>
      <div class="grid">
        <article class="card"><div class="card-inner">
          <label class="field-group field-wide"><span>Задача</span><select class="input" id="outreach-execution-select">${options}</select></label>
          <p><b>${esc(item.subject)}</b></p>
          <p class="tiny">${esc(groupLabels[item.request_group] || item.request_group)} · ${esc(item.outreach_id)} · источник ${esc(item.source_request_id)}</p>
          <div class="notice"><b>Рекомендованный маршрут из реестра:</b> ${esc(item.channel || 'не определён')}. Это подсказка, а не факт отправки.</div>
          <label class="field-group field-wide"><span>Готовый текст запроса</span><textarea class="input" id="outreach-request-preview" rows="14" readonly>${esc(message)}</textarea></label>
          <div class="card-actions"><button class="btn primary" type="button" id="outreach-copy-request">Копировать запрос</button><button class="btn" type="button" id="outreach-download-preflight">Скачать карточку подготовки</button></div>
        </div></article>
        <article class="card"><div class="card-inner">
          <form id="outreach-execution-form" novalidate>
            <div class="form-grid">
              <label class="field-group"><span>Фактический канал</span><input class="input" name="channel" value="${esc(draft.channel || '')}" placeholder="Email, форма, сообщение в сообществе"/></label>
              <label class="field-group"><span>Фактический получатель</span><input class="input" name="contact" value="${esc(draft.contact || '')}" placeholder="Организация, должность или открытый адрес"/></label>
              <label class="field-group"><span>Ответственный</span><input class="input" name="owner" value="${esc(draft.owner || '')}" placeholder="ФИО или рабочая роль"/></label>
              <label class="field-group"><span>Дата фактической отправки</span><input class="input" name="sent_date" type="date" value="${esc(draft.sent_date || '')}"/></label>
              <label class="field-group"><span>Дата повторного контакта</span><input class="input" name="follow_up_date" type="date" value="${esc(draft.follow_up_date || '')}"/></label>
              <label class="field-group"><span>Безопасная ссылка на след</span><input class="input" name="evidence_ref" value="${esc(draft.evidence_ref || '')}" placeholder="Публичная или обезличенная ссылка"/></label>
              <label class="field-group field-wide"><span>Рабочее примечание</span><textarea class="input" name="note" rows="4" placeholder="Что проверить перед внесением в журнал">${esc(draft.note || '')}</textarea></label>
            </div>
            <label class="consent-row"><input name="actual_sent" type="checkbox"${draft.actual_sent ? ' checked' : ''}/><span><b>Запрос действительно отправлен.</b> Отмечать только после фактического действия через указанный канал.</span></label>
          </form>
          <div class="notice" id="outreach-execution-status" aria-live="polite"></div>
          <div class="card-actions"><button class="btn primary" type="button" id="outreach-download-row" disabled>Скачать строку sent</button><button class="btn" type="button" id="outreach-reset-draft">Очистить локальный черновик</button></div>
          <p class="tiny">Экспорт не меняет репозиторий. Перед внесением строки нужно проверить фактический след отправки и сохранить только допустимую ссылку.</p>
        </div></article>
      </div>`;

    root.querySelector('#outreach-execution-select')?.addEventListener('change', (event) => {
      selectedId = event.target.value;
      const store = loadStore();
      store.selected = selectedId;
      saveStore(store);
      renderWorkspace();
    });
    bindForm();
    renderStatus();
  }

  async function loadCsv(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Не загружен ${path}`);
    return api.parseCsv(await response.text());
  }

  Promise.all([
    loadCsv('/data/outreach_register.csv'),
    loadCsv('/data/priority_tos_requests.csv'),
    loadCsv('/data/candidate_registry_requests.csv'),
    loadCsv('/data/projects_2026_result_requests.csv')
  ]).then(([register, priority, candidates, projects]) => {
    items = register.filter((item) => item.status === 'draft');
    sources = { priority, candidates, projects };
    const saved = loadStore().selected;
    selectedId = items.some((item) => item.outreach_id === saved) ? saved : (items[0]?.outreach_id || '');
    renderWorkspace();
  }).catch((error) => {
    root.innerHTML = `<div class="empty">Не удалось загрузить пакет отправки: ${esc(error.message)}</div>`;
  });
})();