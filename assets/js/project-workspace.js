(() => {
  'use strict';
  const core = window.ProjectWorkspaceCore;
  const root = document.querySelector('[data-project-workspace]');
  if (!core || !root) return;
  root.querySelector('[data-project-panel]').hidden = false;
  const form = root.dataset.projectWorkspace;
  const nodes = [...root.querySelectorAll('[data-project-field], [data-project-common]')];
  const status = root.querySelector('[data-project-status]');
  const notice = root.querySelector('[data-project-notice]');
  const reload = root.querySelector('[data-project-reload]');
  const undoButton = root.querySelector('[data-project-undo]');
  let state = core.fresh(), undo = null, blocked = false, corrupt = false, hadProject = false;
  const defaults = new Map(nodes.map(el => [el, el.isContentEditable ? el.textContent : el.value]));
  const say = message => { status.textContent = message; };
  function warn(message) { notice.textContent = message; notice.hidden = !message; }
  try {
    const raw = localStorage.getItem(core.KEY);
    if (raw) { state = core.normalize(JSON.parse(raw)); hadProject = true; }
  } catch { corrupt = true; warn('Не удалось открыть сохранённый проект. Старые данные не заменяются. Можно скачать текущие поля или открыть файл проекта.'); }
  if (!hadProject && !corrupt) {
    try {
      const legacy=localStorage.getItem('tos-project-budget-v1');
      if(legacy) {
        state.budget=window.ProjectBudgetCore.normalize(JSON.parse(legacy));
        for(const key of ['project','territory','responsible']) if(state.budget.meta[key]) state.common[key]=state.budget.meta[key];
      }
    } catch { warn('Старая смета не перенесена. Откройте её сохранённый файл в калькуляторе.'); }
  }
  function syncBudgetMeta() {
    if (!state.budget) return;
    for (const key of ['project','territory','responsible']) if (Object.hasOwn(state.common,key)) state.budget.meta[key] = state.common[key];
  }
  function save() {
    syncBudgetMeta();
    if (blocked || corrupt) { say('Изменения пока только на странице. Скачайте проект, чтобы сохранить их.'); return false; }
    try {
      const raw = localStorage.getItem(core.KEY);
      if (raw && core.normalize(JSON.parse(raw)).revision !== state.revision) {
        blocked = true; reload.hidden = false;
        warn('Проект изменён в другой вкладке. Скачайте свои изменения или обновите данные, прежде чем продолжить.');
        return false;
      }
      const revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const next = {...state,revision,updated_at:new Date().toISOString()};
      localStorage.setItem(core.KEY,JSON.stringify(next));
      state = next;
      // Keep the existing standalone budget tool and its saved files compatible.
      try { if (state.budget) localStorage.setItem('tos-project-budget-v1',JSON.stringify(state.budget)); else localStorage.removeItem('tos-project-budget-v1'); } catch { /* The complete project remains saved. */ }
      say('Проект сохранён в этом браузере.');
      return true;
    } catch { say('Автосохранение недоступно. Скачайте проект перед закрытием страницы.'); return false; }
  }
  function setValue(el,value) {
    if (el.type === 'checkbox') el.checked = value === '1';
    else if (el.isContentEditable) { if (el.textContent !== value) el.textContent = value; }
    else if (el.value !== value) el.value = value;
  }
  function apply() {
    const fields = state.documents[form] || {};
    const sums = core.budgetValues(state);
    for (const el of nodes) {
      const key = el.dataset.projectCommon;
      let value = defaults.get(el);
      if (key && Object.hasOwn(state.common,key)) value = state.common[key];
      else if (Object.hasOwn(fields,el.dataset.projectField)) value = fields[el.dataset.projectField];
      else if (el.dataset.projectDerived === 'period' && (state.common.start || state.common.end)) value = [state.common.start,state.common.end].filter(Boolean).join(' — ');
      else if (el.dataset.projectBudget && sums) value = sums[el.dataset.projectBudget];
      setValue(el,value || '');
    }
    root.querySelectorAll('[data-project-budget-value]').forEach(el => { el.textContent = sums ? sums[el.dataset.projectBudgetValue] : 'Откройте и заполните смету'; });
    root.querySelectorAll('[data-project-budget-notice]').forEach(el => { el.hidden = !sums; });
    undoButton.hidden = !undo;
    root.querySelectorAll('[data-project-progress]').forEach(el => {
      const slug = el.dataset.projectProgress;
      const count = Object.values(state.documents[slug] || {}).filter(value => value && value !== '0').length;
      el.textContent = slug === 'budget' && sums ? 'Расчёт сохранён' : count ? `Сохранено полей: ${count}` : 'Открыть и заполнить';
    });
  }
  function updateField(el) {
    let value = el.type === 'checkbox' ? (el.checked ? '1':'0') : el.isContentEditable ? el.innerText.replace(/\r/g,'') : el.value;
    const limit = el.dataset.projectCommon && !['summary','problem','goal','beneficiaries','maintenance','publicity'].includes(el.dataset.projectCommon) ? 300 : 12000;
    if (value.length > limit) { value = value.slice(0,limit); setValue(el,value); warn(`Поле сокращено до ${limit} символов.`); }
    if (el.dataset.projectCommon) {
      state.common[el.dataset.projectCommon] = value;
      nodes.filter(other => other !== el && other.dataset.projectCommon === el.dataset.projectCommon).forEach(other => setValue(other,value));
    } else {
      state.documents[form] ||= {};
      state.documents[form][el.dataset.projectField] = value;
    }
    if (root.matches('[data-project-budget]') && el.dataset.meta && window.ProjectBudgetEditor) {
      const budget = window.ProjectBudgetEditor.getState();
      budget.meta[el.dataset.meta] = value;
      window.ProjectBudgetEditor.replace(budget);
      state.budget = budget;
    }
    save();
  }
  root.addEventListener('input',event => { if (nodes.includes(event.target)) updateField(event.target); });
  root.addEventListener('change',event => { if (event.target.type === 'checkbox' && nodes.includes(event.target)) updateField(event.target); });
  root.addEventListener('paste',event => {
    const el = event.target.closest('[contenteditable="true"][data-project-field]');
    if (!el || !event.clipboardData) return;
    event.preventDefault();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const text = document.createTextNode(event.clipboardData.getData('text/plain').slice(0,12000));
    range.insertNode(text); range.setStartAfter(text); range.collapse(true); selection.removeAllRanges(); selection.addRange(range);
    updateField(el);
  });
  function download(value,name,type) {
    const url = URL.createObjectURL(new Blob([value],{type}));
    const a = document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function replace(next) {
    undo = JSON.parse(JSON.stringify(state));
    // A valid explicit import may replace corrupt local data; concurrency still has a lease.
    if (corrupt) { corrupt=false; try { localStorage.removeItem(core.KEY); } catch { /* Export remains available. */ } }
    next.revision = state.revision;
    state = next;
    syncBudgetMeta();
    if (window.ProjectBudgetEditor) window.ProjectBudgetEditor.replace(state.budget || window.ProjectBudgetCore.fresh());
    apply(); save();
  }
  root.addEventListener('click',event => {
    const button = event.target.closest('[data-project-action]');
    if (!button) return;
    const action = button.dataset.projectAction;
    if (action === 'export') { if(window.ProjectBudgetEditor)state.budget=window.ProjectBudgetEditor.getState(); save(); download(JSON.stringify(state,null,2),'proekt-tos.json','application/json'); }
    if (action === 'import') root.querySelector('[data-project-file]').click();
    if (action === 'new' && confirm('Начать другой проект? Текущий черновик будет заменён. Сначала скачайте его, если хотите сохранить. Замену можно отменить.')) replace(core.fresh());
    if (action === 'undo' && undo) { const previous=undo; replace(previous); undo=null; undoButton.hidden=true; }
    if (action === 'reload') {
      if (!confirm('Загрузить сохранённую версию? Несохранённые изменения этой страницы будут заменены.')) return;
      try { state=core.normalize(JSON.parse(localStorage.getItem(core.KEY))); blocked=false;corrupt=false;reload.hidden=true;warn('');syncBudgetMeta();apply();if(window.ProjectBudgetEditor)window.ProjectBudgetEditor.replace(state.budget||window.ProjectBudgetCore.fresh());say('Открыта сохранённая версия.'); }
      catch { warn('Не удалось загрузить сохранённую версию. Откройте скачанный файл проекта.'); }
    }
    if (action === 'budget') {
      if (confirm('Заменить плановые суммы в этом документе текущими итогами сметы? Фактические расходы не изменятся.')) {
        state.documents[form] ||= {};
        nodes.filter(el=>el.dataset.projectBudget).forEach(el=>delete state.documents[form][el.dataset.projectField]);
        apply();save();
      }
    }
    if (action === 'text') {
      const paper=root.querySelector('#template-content');
      download(window.ProjectBudgetEditor ? window.ProjectBudgetCore.toText(window.ProjectBudgetEditor.getState()) : paper.innerText,`proekt-${form}.txt`,'text/plain;charset=utf-8');
    }
  });
  root.querySelector('[data-project-file]').addEventListener('change',async event => {
    const file=event.target.files[0];if(!file)return;
    try {
      if(file.size>2097152)throw new Error('Файл должен быть не больше 2 МБ.');
      const next=core.normalize(JSON.parse(await file.text()));
      if(confirm('Открыть этот проект вместо текущего? Замену можно отменить.'))replace(next);
    } catch(error) { warn(`Файл не открыт. ${error.message}`); }
    event.target.value='';
  });
  window.addEventListener('storage',event => {
    if(event.key!==core.KEY)return;
    blocked=true;reload.hidden=false;warn('Проект изменён в другой вкладке. Обновите данные или скачайте свои изменения.');
  });
  window.addEventListener('project-budget-change',event => {
    state.budget = window.ProjectBudgetCore.normalize(event.detail);
    for(const key of ['project','territory','responsible'])state.common[key]=state.budget.meta[key];
    save();
  });
  if(window.ProjectBudgetEditor) {
    if(state.budget) window.ProjectBudgetEditor.replace(state.budget);
    else {
      state.budget=hadProject ? window.ProjectBudgetCore.fresh() : window.ProjectBudgetEditor.getState();
      for(const key of ['project','territory','responsible']) {
        if(!Object.hasOwn(state.common,key)&&state.budget.meta[key])state.common[key]=state.budget.meta[key];
      }
    }
    syncBudgetMeta();window.ProjectBudgetEditor.replace(state.budget);
  }
  apply();
  if(!hadProject && state.budget && !corrupt) save();
  if(!corrupt)say(state.updated_at?'Черновик восстановлен. Изменения сохраняются в этом браузере.':'Заполняйте поля — изменения сохраняются в этом браузере.');
  document.dispatchEvent(new CustomEvent('project-workspace-ready'));
})();
