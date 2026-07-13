(function(){
  const MAX_SNAPSHOTS = 10;
  const AUTO_SNAPSHOT_IDS = new Set([
    'importJson',
    'addItem',
    'deleteItem',
    'duplicateItem',
    'autoFill',
    'fillLogo',
    'bulkFillLogoPaths'
  ]);

  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function historyKey(section){
    return `tosbgo_admin_history_${section}`;
  }

  function readHistory(section){
    try{
      const value = JSON.parse(localStorage.getItem(historyKey(section)) || '[]');
      return Array.isArray(value) ? value : [];
    }catch{
      return [];
    }
  }

  function writeHistory(section, history){
    localStorage.setItem(historyKey(section), JSON.stringify(history.slice(-MAX_SNAPSHOTS)));
  }

  function sameData(left, right){
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function createSnapshot(reason = 'manual', quiet = false){
    if(typeof state === 'undefined' || typeof current !== 'function') return null;
    const section = state.section;
    if(!section || section === 'help' || section === 'dashboard') return null;

    const data = clone(current());
    const history = readHistory(section);
    const previous = history[history.length - 1];
    if(previous && sameData(previous.data, data)){
      if(!quiet && typeof msg === 'function') msg(['Текущее состояние уже совпадает с последним снимком.'], true);
      return previous;
    }

    const snapshot = {
      created_at: new Date().toISOString(),
      section,
      reason,
      records: data.length,
      data
    };
    history.push(snapshot);
    writeHistory(section, history);
    updateRestoreLabel();
    if(!quiet && typeof msg === 'function') msg([`Снимок раздела «${section}» сохранён. Записей: ${data.length}.`], true);
    return snapshot;
  }

  function restoreLatest(){
    if(typeof state === 'undefined' || typeof save !== 'function') return;
    const section = state.section;
    const history = readHistory(section);
    const target = history[history.length - 1];
    if(!target){
      if(typeof msg === 'function') msg(['Для текущего раздела ещё нет сохранённых снимков.'], false);
      return;
    }

    const dateLabel = new Date(target.created_at).toLocaleString('ru-RU');
    if(!confirm(`Восстановить снимок раздела «${section}» от ${dateLabel}? Текущее состояние будет сохранено как снимок перед откатом.`)) return;

    const currentData = clone(current());
    if(!sameData(currentData, target.data)){
      history.push({
        created_at: new Date().toISOString(),
        section,
        reason: 'before-restore',
        records: currentData.length,
        data: currentData
      });
      writeHistory(section, history);
    }

    state.data[section] = clone(target.data);
    state.selected = 0;
    if(section === 'toses') state.tosOptions = [];
    save();
    if(typeof renderList === 'function') renderList();
    if(typeof renderForm === 'function') renderForm();
    updateRestoreLabel();
    if(typeof msg === 'function') msg([`Снимок от ${dateLabel} восстановлен. Перед откатом создан резервный снимок текущего состояния.`], true);
  }

  function updateRestoreLabel(){
    const button = document.querySelector('#restoreAdminSnapshot');
    if(!button || typeof state === 'undefined') return;
    const history = readHistory(state.section);
    const latest = history[history.length - 1];
    button.disabled = !latest;
    button.textContent = latest ? `Откатить (${history.length})` : 'Откатить';
    button.title = latest ? `Последний снимок: ${new Date(latest.created_at).toLocaleString('ru-RU')}` : 'Снимков для текущего раздела нет';
  }

  function install(){
    const row = document.querySelector('.tools-row');
    if(!row || document.querySelector('#createAdminSnapshot')) return;
    row.insertAdjacentHTML('beforeend', '<button class="btn" id="createAdminSnapshot" type="button">Создать снимок</button><button class="btn" id="restoreAdminSnapshot" type="button">Откатить</button>');
    document.querySelector('#createAdminSnapshot')?.addEventListener('click', () => createSnapshot('manual'));
    document.querySelector('#restoreAdminSnapshot')?.addEventListener('click', restoreLatest);

    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if(button?.id && AUTO_SNAPSHOT_IDS.has(button.id)) createSnapshot(`before-${button.id}`, true);
    }, true);

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => setTimeout(updateRestoreLabel, 80));
    });
    updateRestoreLabel();
  }

  ready(() => {
    const wait = setInterval(() => {
      if(typeof state === 'undefined' || typeof current !== 'function' || typeof save !== 'function') return;
      clearInterval(wait);
      install();
    }, 50);
  });
})();
