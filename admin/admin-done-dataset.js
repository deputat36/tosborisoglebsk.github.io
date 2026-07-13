(function(){
  if(typeof DATASETS === 'undefined') throw new Error('admin2.js must be loaded before admin-done-dataset.js');

  DATASETS.done = {
    title: 'Результаты',
    hint: 'Редактирование data/done.json',
    file: '/data/done.json',
    download: 'done.json',
    label: (x) => x.title || 'Результат без заголовка',
    sub: (x) => [x.date, x.type, x.tos_slug, x.content_origin].filter(Boolean).join(' · '),
    template: () => ({
      id: 'done-' + Date.now(),
      status: 'draft',
      date: new Date().toISOString().slice(0,10),
      tos_slug: '',
      type: 'Результат проекта',
      title: '',
      summary: '',
      before: '',
      done: '',
      result: '',
      participants: '',
      source_label: '',
      source_url: '',
      needs_details: '',
      content_origin: 'request'
    }),
    fields: [
      ['id','ID результата'],
      ['status','Статус','select:published|draft'],
      ['date','Дата'],
      ['tos_slug','Привязка к ТОС: slug','tosSlug'],
      ['type','Тип результата'],
      ['title','Заголовок'],
      ['summary','Краткое описание','textarea'],
      ['before','Что было до','textarea'],
      ['done','Что сделано','textarea'],
      ['result','Подтверждённый результат','textarea'],
      ['participants','Участники','textarea'],
      ['source_label','Название источника'],
      ['source_url','Ссылка на источник'],
      ['needs_details','Каких подтверждений не хватает','textarea'],
      ['content_origin','Происхождение материала','select:verified|editorial|starter|request']
    ]
  };
})();