(function(){
  function ready(callback){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback);
    else callback();
  }

  function csvCell(value){
    const normalized = Array.isArray(value)
      ? value.join(' | ')
      : value && typeof value === 'object'
        ? JSON.stringify(value)
        : String(value ?? '');
    return '"' + normalized.replace(/"/g, '""') + '"';
  }

  function orderedKeys(items){
    const preferred = ['slug','id','name','title','status','type','date','location','chairperson','tos_slug'];
    const found = new Set();
    items.forEach((item) => Object.keys(item || {}).forEach((key) => found.add(key)));
    return [
      ...preferred.filter((key) => found.has(key)),
      ...[...found].filter((key) => !preferred.includes(key)).sort((left, right) => left.localeCompare(right, 'ru'))
    ];
  }

  function visibleItems(){
    if(typeof filtered === 'function') return filtered().map((row) => row.item);
    if(typeof current === 'function') return current();
    return [];
  }

  function exportFilteredCsv(){
    if(typeof state === 'undefined' || typeof downloadText !== 'function') return;
    const items = visibleItems();
    if(!items.length){
      if(typeof msg === 'function') msg(['В текущем фильтре нет записей для экспорта.'], false);
      return;
    }

    const keys = orderedKeys(items);
    const rows = [keys, ...items.map((item) => keys.map((key) => item?.[key]))];
    const csv = '\ufeff' + rows.map((row) => row.map(csvCell).join(';')).join('\n');
    const date = typeof today === 'function' ? today() : new Date().toISOString().slice(0,10);
    downloadText(`admin-${state.section}-filtered-${date}.csv`, csv, 'text/csv;charset=utf-8');
    if(typeof msg === 'function'){
      msg([
        `CSV сформирован. Экспортировано записей: ${items.length}. Полей: ${keys.length}.`,
        'Перед передачей файла проверьте, не содержит ли выборка контакты или другие сведения, которые не должны распространяться.'
      ], true);
    }
  }

  function install(){
    const row = document.querySelector('.tools-row');
    if(!row || document.querySelector('#exportFilteredCsv')) return;
    row.insertAdjacentHTML('beforeend', '<button class="btn" id="exportFilteredCsv" type="button">CSV текущего списка</button>');
    document.querySelector('#exportFilteredCsv')?.addEventListener('click', exportFilteredCsv);
  }

  ready(() => {
    const wait = setInterval(() => {
      if(typeof state === 'undefined' || typeof current !== 'function') return;
      clearInterval(wait);
      install();
    }, 50);
  });
})();
