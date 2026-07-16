(() => {
  'use strict';

  const api = window.PublicationBasisExecution;
  const registerValidation = window.PublicationBasisValidation;
  const root = document.querySelector('#publication-basis-execution-root');
  if (!api || !registerValidation || !root) return;

  const STORAGE_KEY = 'tos-publication-basis-execution-v1';
  let registerRows = [];
  let queueBySlug = new Map();
  let tosBySlug = new Map();
  let templatesById = new Map();
  let selectedSlug = '';

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
    return registerRows.find((item) => item.tos_slug === selectedSlug) || registerRows[0] || null;
  }

  function currentDraft() {
    const item = currentItem();
    return item ? (loadStore().drafts?.[item.tos_slug] || {}) : {};
  }

  function storeDraft(draft) {
    const item = currentItem();
    if (!item) return;
    const store = loadStore();
    store.selected = item.tos_slug;
    store.drafts = { ...(store.drafts || {}), [item.tos_slug]: draft };
    saveStore(store);
  }

  function formDraft() {
    const form = root.querySelector('#publication-basis-execution-form');
    if (!form) return {};
    const data = Object.fromEntries(new FormData(form).entries());
    return {
      response_deadline: clean(data.response_deadline),
      recipient_role: clean(data.recipient_role),
      channel_type: clean(data.channel_type),
      owner_role: clean(data.owner_role),
      sent_date: clean(data.sent_date),
      follow_up_date: clean(data.follow_up_date),
      note: clean(data.note),
      actual_sent: Boolean(form.elements.actual_sent?.checked)
    };
  }

  function requestPacket(item, draft) {
    return api.buildRequestPacket(
      item,
      queueBySlug.get(item.tos_slug),
      tosBySlug.get(item.tos_slug),
      templatesById.get(item.template_id),
      draft.response_deadline
    );
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

  async function copyText(text, successText) {
    const status = root.querySelector('#publication-basis-execution-status');
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
      if (status) status.textContent = successText;
    } catch {
      if (status) status.textContent = 'Не удалось скопировать автоматически. Используйте поля предварительного просмотра.';
    }
  }

  function renderStatus() {
    const item = currentItem();
    const draft = formDraft();
    const result = api.validateExecution(item, draft, registerValidation);
    const badge = root.querySelector('#publication-basis-execution-badge');
    const status = root.querySelector('#publication-basis-execution-status');
    const exportButton = root.querySelector('#publication-basis-download-row');
    if (!badge || !status || !exportButton) return;

    if (!draft.actual_sent) {
      badge.textContent = 'Подготовка';
      badge.className = 'tag warn';
      status.textContent = result.errors.length
        ? result.errors.join('; ')
        : 'Можно скопировать редакционный запрос и скачать карточку подготовки. Исходный CSV не меняется.';
      exportButton.disabled = true;
      return;
    }

    if (result.valid) {
      badge.textContent = 'Готово к фиксации sent';
      badge.className = 'tag ok';
      status.textContent = 'Обязательные поля заполнены. Экспорт создаст одну строку для ручной проверки и внесения в журнал.';
      exportButton.disabled = false;
    } else {
      badge.textContent = 'Не готово';
      badge.className = 'tag warn';
      status.textContent = result.errors.join('; ');
      exportButton.disabled = true;
    }
  }

  function bindForm() {
    const form = root.querySelector('#publication-basis-execution-form');
    if (!form) return;
    const onChange = () => {
      storeDraft(formDraft());
      const item = currentItem();
      const packet = requestPacket(item, formDraft());
      const subject = root.querySelector('#publication-basis-subject-preview');
      const message = root.querySelector('#publication-basis-message-preview');
      if (subject && packet) subject.value = packet.subject;
      if (message && packet) message.value = packet.message;
      renderStatus();
    };
    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);

    root.querySelector('#publication-basis-copy-subject')?.addEventListener('click', () => {
      const packet = requestPacket(currentItem(), formDraft());
      copyText(packet?.subject || '', 'Тема скопирована. Отправка выполняется вручную.');
    });
    root.querySelector('#publication-basis-copy-message')?.addEventListener('click', () => {
      const packet = requestPacket(currentItem(), formDraft());
      copyText(packet?.message || '', 'Текст скопирован. Отправка выполняется вручную через выбранный канал.');
    });
    root.querySelector('#publication-basis-download-preflight')?.addEventListener('click', () => {
      const item = currentItem();
      const draft = formDraft();
      const packet = requestPacket(item, draft);
      download(`${item.tos_slug}-publication-basis-preflight.txt`, api.buildPreflightText(item, packet, draft));
    });
    root.querySelector('#publication-basis-download-row')?.addEventListener('click', () => {
      const item = currentItem();
      const draft = formDraft();
      const result = api.validateExecution(item, draft, registerValidation);
      if (!result.valid || !result.actualSent) { renderStatus(); return; }
      download(`${item.tos_slug}-publication-basis-sent-row.csv`, `\ufeff${api.serializeUpdatedRow(item, draft, registerValidation)}`, 'text/csv;charset=utf-8');
    });
    root.querySelector('#publication-basis-reset-draft')?.addEventListener('click', () => {
      const item = currentItem();
      const store = loadStore();
      if (store.drafts) delete store.drafts[item.tos_slug];
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
    const packet = requestPacket(item, draft);
    if (!packet) {
      root.innerHTML = '<div class="empty">Не удалось связать журнал, очередь, шаблон и карточку ТОС.</div>';
      return;
    }
    const options = registerRows.map((entry) => {
      const tos = tosBySlug.get(entry.tos_slug);
      return `<option value="${esc(entry.tos_slug)}"${entry.tos_slug === item.tos_slug ? ' selected' : ''}>Волна ${esc(entry.wave)} · ${esc(tos?.name || entry.tos_slug)} · score ${esc(entry.score)}</option>`;
    }).join('');

    root.innerHTML = `<div class="section-head"><div><h2>Локальный пакет исполнения</h2><p>Готовый редакционный запрос и безопасный экспорт одной строки без автоматической отправки или изменения репозитория.</p></div><span class="tag warn" id="publication-basis-execution-badge">Подготовка</span></div>
      <div class="grid">
        <article class="card"><div class="card-inner">
          <label class="field-group field-wide"><span>Карточка ТОС</span><select class="input" id="publication-basis-execution-select">${options}</select></label>
          <p><b>ТОС «${esc(packet.tosName)}»</b></p>
          <p class="tiny">${esc(item.tos_slug)} · волна ${esc(item.wave)} · ${esc(item.template_id)} · score ${esc(item.score)}</p>
          <div class="notice"><b>Поля из канонической очереди:</b> ${packet.fieldTypes.map(esc).join(', ')}. Перечень является подсказкой для запроса, а не итоговым решением.</div>
          <label class="field-group field-wide"><span>Тема</span><textarea class="input" id="publication-basis-subject-preview" rows="3" readonly>${esc(packet.subject)}</textarea></label>
          <label class="field-group field-wide"><span>Текст запроса</span><textarea class="input" id="publication-basis-message-preview" rows="15" readonly>${esc(packet.message)}</textarea></label>
          <div class="card-actions"><button class="btn" type="button" id="publication-basis-copy-subject">Копировать тему</button><button class="btn primary" type="button" id="publication-basis-copy-message">Копировать запрос</button><button class="btn" type="button" id="publication-basis-download-preflight">Скачать карточку подготовки</button></div>
        </div></article>
        <article class="card"><div class="card-inner">
          <form id="publication-basis-execution-form" novalidate>
            <div class="form-grid">
              <label class="field-group"><span>Срок ответа в сообщении</span><input class="input" name="response_deadline" type="date" value="${esc(draft.response_deadline || '')}"/></label>
              <label class="field-group"><span>Роль получателя</span><input class="input" name="recipient_role" value="${esc(draft.recipient_role || '')}" placeholder="tos_representative"/></label>
              <label class="field-group"><span>Тип фактического канала</span><input class="input" name="channel_type" value="${esc(draft.channel_type || '')}" placeholder="email, messenger, official_form"/></label>
              <label class="field-group"><span>Роль ответственного</span><input class="input" name="owner_role" value="${esc(draft.owner_role || '')}" placeholder="editor"/></label>
              <label class="field-group"><span>Дата фактической отправки</span><input class="input" name="sent_date" type="date" value="${esc(draft.sent_date || '')}"/></label>
              <label class="field-group"><span>Дата повторного контакта</span><input class="input" name="follow_up_date" type="date" value="${esc(draft.follow_up_date || '')}"/></label>
              <label class="field-group field-wide"><span>Локальное примечание</span><textarea class="input" name="note" rows="4" placeholder="Не переносите сюда контакты, переписку и закрытые ссылки">${esc(draft.note || '')}</textarea></label>
            </div>
            <label class="consent-row"><input name="actual_sent" type="checkbox"${draft.actual_sent ? ' checked' : ''}/><span><b>Редакционный запрос действительно отправлен.</b> Отмечать только после фактического действия через указанный тип канала.</span></label>
          </form>
          <div class="notice" id="publication-basis-execution-status" aria-live="polite"></div>
          <div class="card-actions"><button class="btn primary" type="button" id="publication-basis-download-row" disabled>Скачать строку sent</button><button class="btn" type="button" id="publication-basis-reset-draft">Очистить локальный черновик</button></div>
          <p class="tiny">Экспорт не создаёт юридическое согласие, factual_source_ref или решение по полям. Перед внесением строки проверьте фактический след отправки вне публичного GitHub.</p>
        </div></article>
      </div>`;

    root.querySelector('#publication-basis-execution-select')?.addEventListener('change', (event) => {
      selectedSlug = event.target.value;
      const store = loadStore();
      store.selected = selectedSlug;
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

  async function loadJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Не загружен ${path}`);
    return response.json();
  }

  Promise.all([
    loadCsv('/data/publication_basis_confirmation_register.csv'),
    loadCsv('/data/publication_basis_review_queue.csv'),
    loadJson('/data/publication_basis_confirmation_templates.json'),
    loadJson('/data/tos.json')
  ]).then(([register, queue, templates, tos]) => {
    registerRows = register.filter((item) => item.request_status === 'draft');
    queueBySlug = api.indexBy(queue, 'slug');
    tosBySlug = api.indexBy(tos, 'id');
    templatesById = api.indexBy(templates.templates || [], 'id');
    const saved = loadStore().selected;
    selectedSlug = registerRows.some((item) => item.tos_slug === saved) ? saved : (registerRows[0]?.tos_slug || '');
    renderWorkspace();
  }).catch((error) => {
    root.innerHTML = `<div class="empty">Не удалось загрузить локальный пакет: ${esc(error.message)}</div>`;
  });
})();
