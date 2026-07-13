(function(){
  if(typeof DATASETS === 'undefined') throw new Error('admin2.js must be loaded before admin-done-dataset.js');

  DATASETS.done = {
    title: 'Результаты',
    file: '/data/done.json',
    key: 'id',
    label: 'title',
    fields: [
      ['id','ID результата','text'],
      ['status','Статус','select',['published','draft']],
      ['date','Дата','date'],
      ['tos_slug','Привязка к ТОС','select',() => typeof tosOptions === 'function' ? tosOptions() : []],
      ['type','Тип результата','text'],
      ['title','Заголовок','text'],
      ['summary','Краткое описание','textarea'],
      ['before','Что было до','textarea'],
      ['done','Что сделано','textarea'],
      ['result','Подтверждённый результат','textarea'],
      ['participants','Участники','textarea'],
      ['source_label','Название источника','text'],
      ['source_url','Ссылка на источник','text'],
      ['needs_details','Каких подтверждений не хватает','textarea'],
      ['content_origin','Происхождение материала','select',['verified','editorial','starter','request']]
    ]
  };
})();
