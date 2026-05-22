(function(){
  function ready(fn){
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function csvCell(value){
    return '"' + String(value ?? '').replace(/"/g, '""') + '"';
  }

  function makeLogoPath(item){
    if(!item.slug && item.name && typeof slugify === 'function') item.slug = slugify(item.name);
    if(!item.slug) return '';
    return '/assets/img/tos-logos/' + item.slug + '.svg';
  }

  function addNoLogoFilter(){
    const select = document.querySelector('#quickFilter');
    if(!select || typeof state === 'undefined' || state.section !== 'toses') return;
    if(!select.querySelector('option[value="no-logo"]')){
      select.insertAdjacentHTML('beforeend', '<option value="no-logo">Без логотипа</option>');
    }
  }

  function addLogoToolbar(){
    const row = document.querySelector('.tools-row');
    if(!row || document.querySelector('#bulkFillLogoPaths')) return;
    row.insertAdjacentHTML('beforeend', '<button class="btn" id="bulkFillLogoPaths" type="button">Логотипы всем ТОСам</button><button class="btn" id="downloadNoLogoCsv" type="button">CSV без логотипа</button>');

    document.querySelector('#bulkFillLogoPaths').addEventListener('click', () => {
      if(typeof state === 'undefined' || state.section !== 'toses'){
        msg(['Массовое заполнение логотипов работает только в разделе «Каталог ТОС».'], false);
        return;
      }
      let changed = 0;
      current().forEach(item => {
        const path = makeLogoPath(item);
        if(path && item.logo !== path){ item.logo = path; changed++; }
        if(!item.updated_at && typeof today === 'function') item.updated_at = today();
      });
      save();
      renderList();
      renderForm();
      msg([`Пути к логотипам сформированы. Обновлено записей: ${changed}. Теперь нужно загрузить SVG-файлы в assets/img/tos-logos/.`], true);
    });

    document.querySelector('#downloadNoLogoCsv').addEventListener('click', () => {
      if(typeof state === 'undefined' || state.section !== 'toses'){
        msg(['CSV без логотипов работает только в разделе «Каталог ТОС».'], false);
        return;
      }
      const rows = current().filter(item => !item.logo).map(item => [
        item.name || '',
        item.slug || '',
        item.location || '',
        item.chairperson || '',
        makeLogoPath(item)
      ]);
      const header = ['ТОС','slug','Территория','Председатель','Рекомендуемый путь логотипа'];
      const csv = [header, ...rows].map(row => row.map(csvCell).join(';')).join('\n');
      downloadText('tos-without-logos.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
      msg([`CSV сформирован. В списке записей без логотипа: ${rows.length}.`], true);
    });
  }

  ready(() => {
    const wait = setInterval(() => {
      if(typeof state === 'undefined' || typeof buildFilters === 'undefined' || typeof pass === 'undefined') return;
      clearInterval(wait);

      const originalPass = pass;
      pass = function(item){
        if(state.filter === 'no-logo') return !item.logo;
        return originalPass(item);
      };

      const originalBuildFilters = buildFilters;
      buildFilters = function(){
        originalBuildFilters();
        addNoLogoFilter();
      };

      addLogoToolbar();
      addNoLogoFilter();

      const tabs = document.querySelectorAll('.tab');
      tabs.forEach(tab => tab.addEventListener('click', () => setTimeout(() => { addLogoToolbar(); addNoLogoFilter(); }, 80)));
    }, 50);
  });
})();
