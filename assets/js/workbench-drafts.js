document.addEventListener('DOMContentLoaded', () => {
  const DRAFTS_KEY = 'tos-workbench-drafts-v1';
  const STATUS_LABELS = {
    new: 'Новый контакт',
    contacted: 'Ждём ответ',
    received: 'Сведения получены',
    ready: 'Готово к внесению',
    blocked: 'Нужна допроверка'
  };

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  function readDraftMap() {
    try {
      const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {};
      return drafts && typeof drafts === 'object' && !Array.isArray(drafts) ? drafts : {};
    } catch (error) {
      return {};
    }
  }

  function readDrafts() {
    return Object.entries(readDraftMap()).filter(([slug, draft]) => slug && draft);
  }

  function writeDraftMap(drafts) {
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
      return true;
    } catch (error) {
      return false;
    }
  }

  function ensureSummaryRoot() {
    const priorityList = document.querySelector('#workbench-priority-list');
    if (!priorityList) return null;

    let root = document.querySelector('#workbench-draft-summary');
    if (!root) {
      priorityList.insertAdjacentHTML('beforebegin', '<div class="container stats" id="workbench-draft-summary" aria-live="polite"></div><div class="container toolbar" id="workbench-draft-backup-tools"><button class="btn" id="workbench-draft-backup" type="button">JSON черновиков</button><label class="btn" for="workbench-draft-restore">Загрузить JSON</label><input id="workbench-draft-restore" type="file" accept="application/json,.json" hidden/><span class="tiny" id="workbench-draft-backup-meta"></span></div><div class="container list" id="workbench-recent-drafts"></div>');
      root = document.querySelector('#workbench-draft-summary');
      wireBackupControls();
    }
    return root;
  }

  function buildCounts(entries) {
    return entries.reduce((acc, [, draft]) => {
      const status = draft && draft.status ? draft.status : 'new';
      acc.total += 1;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { total: 0 });
  }

  function formatDate(value) {
    if (!value) return 'без даты';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU');
  }

  function draftTimestamp(draft) {
    const date = new Date(draft && draft.updated_at ? draft.updated_at : 0);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function renderRecentDrafts(entries) {
    const root = document.querySelector('#workbench-recent-drafts');
    if (!root) return;

    if (!entries.length) {
      root.innerHTML = '';
      return;
    }

    const cards = entries
      .slice()
      .sort(([, a], [, b]) => draftTimestamp(b) - draftTimestamp(a))
      .slice(0, 5)
      .map(([slug, draft]) => {
        const status = STATUS_LABELS[draft.status] || 'Черновик';
        const note = String(draft.note || '').trim();
        const preview = note ? `<p>${esc(note.slice(0, 180))}${note.length > 180 ? '...' : ''}</p>` : '<p>Заметка пока пустая.</p>';
        const urlSlug = encodeURIComponent(slug);
        return `<article class="list-item"><div class="meta"><span class="tag ok">${esc(status)}</span><span class="tag">${esc(formatDate(draft.updated_at))}</span><span class="tag">slug: ${esc(slug)}</span></div><h3>Последний черновик: ${esc(slug)}</h3>${preview}<div class="card-actions"><a class="btn" href="/tos/${urlSlug}/">Карточка</a><a class="btn primary" href="/update-tos/?tos=${urlSlug}&type=card#message-builder">Уточнить</a></div></article>`;
      }).join('');

    root.innerHTML = `<div class="tiny">Последние локальные черновики. Показываются 5 последних по времени сохранения.</div>${cards}`;
  }

  function renderDraftSummary() {
    const root = ensureSummaryRoot();
    if (!root) return;

    const entries = readDrafts();
    const counts = buildCounts(entries);
    const values = [
      ['Черновики', counts.total],
      ['Новые', counts.new || 0],
      ['Ждём ответ', counts.contacted || 0],
      ['Получены', counts.received || 0],
      ['Готовы', counts.ready || 0],
      ['Допроверка', counts.blocked || 0]
    ];

    root.innerHTML = values.map(([label, value]) => {
      const className = label === 'Допроверка' && value ? 'stat warn' : 'stat';
      return `<article class="${className}"><b>${esc(value)}</b><span>${esc(label)}</span></article>`;
    }).join('');
    renderRecentDrafts(entries);
  }

  function setBackupMeta(message) {
    const meta = document.querySelector('#workbench-draft-backup-meta');
    if (meta) meta.textContent = message;
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportDraftBackup() {
    const drafts = readDraftMap();
    const count = Object.keys(drafts).length;
    if (!count) {
      setBackupMeta('Сохранённых черновиков пока нет');
      return;
    }

    downloadJson({
      type: DRAFTS_KEY,
      exported_at: new Date().toISOString(),
      drafts
    }, `tos-workbench-drafts-${new Date().toISOString().slice(0, 10)}.json`);
    setBackupMeta(`Выгружено черновиков: ${count}`);
  }

  function normalizeImportedDrafts(payload) {
    const raw = payload && payload.drafts && typeof payload.drafts === 'object'
      ? payload.drafts
      : payload;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    return Object.fromEntries(Object.entries(raw)
      .filter(([slug, draft]) => slug && draft && typeof draft === 'object')
      .map(([slug, draft]) => [String(slug), {
        status: String(draft.status || 'new'),
        note: String(draft.note || ''),
        updated_at: String(draft.updated_at || new Date().toISOString())
      }]));
  }

  function refreshWorkbenchFilters() {
    document.querySelector('#workbench-draft-select')
      ?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function importDraftBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      try {
        const imported = normalizeImportedDrafts(JSON.parse(String(reader.result || '{}')));
        if (!imported || !Object.keys(imported).length) {
          setBackupMeta('В файле нет черновиков для загрузки');
          return;
        }
        const merged = { ...readDraftMap(), ...imported };
        if (!writeDraftMap(merged)) {
          setBackupMeta('Не удалось сохранить черновики в браузере');
          return;
        }
        renderDraftSummary();
        refreshWorkbenchFilters();
        setBackupMeta(`Загружено черновиков: ${Object.keys(imported).length}`);
      } catch (error) {
        setBackupMeta('Не удалось прочитать JSON-файл');
      }
    });
    reader.readAsText(file);
  }

  function wireBackupControls() {
    document.querySelector('#workbench-draft-backup')
      ?.addEventListener('click', exportDraftBackup);
    document.querySelector('#workbench-draft-restore')
      ?.addEventListener('change', (event) => {
        importDraftBackup(event.target.files && event.target.files[0]);
        event.target.value = '';
      });
  }

  function queueRender() {
    window.setTimeout(renderDraftSummary, 0);
    window.setTimeout(renderDraftSummary, 120);
  }

  renderDraftSummary();

  document.addEventListener('click', (event) => {
    if (event.target.closest('#workbench-save-draft, #workbench-clear-draft')) {
      queueRender();
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.closest('#workbench-draft-select')) {
      queueRender();
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === DRAFTS_KEY) renderDraftSummary();
  });
});
