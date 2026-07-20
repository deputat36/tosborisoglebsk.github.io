window.TOS_UPDATE_SCENARIOS = {
  card: {
    title: 'Обновление карточки ТОС',
    help: 'Укажите тип изменения, правильные сведения и источник подтверждения.',
    fields: [
      { name: 'material_status', label: 'Статус материала', type: 'select', required: true, options: ['Исправление', 'Дополнение', 'Удаление сведений'] },
      { name: 'changes', label: 'Что нужно исправить или добавить', type: 'textarea', required: true, placeholder: 'Например: заменить телефон председателя и добавить ссылку на сообщество' },
      { name: 'correct_value', label: 'Как должно быть правильно', type: 'textarea', required: true, placeholder: 'Запишите проверенные сведения' },
      { name: 'chairperson', label: 'Председатель ТОС', type: 'text' },
      { name: 'phone', label: 'Телефон для публикации', type: 'tel' },
      { name: 'email', label: 'Email для публикации', type: 'email' },
      { name: 'social', label: 'Ссылка на сообщество или страницу', type: 'url' },
      { name: 'boundaries', label: 'Границы или территория', type: 'textarea' },
      { name: 'description', label: 'Краткое описание ТОС', type: 'textarea' },
      { name: 'source', label: 'Источник подтверждения', type: 'text', required: true, placeholder: 'Например: председатель ТОС, официальный документ или публикация организатора' },
      { name: 'source_link', label: 'Ссылка на источник', type: 'url', placeholder: 'Необязательно, если источник нельзя открыть публично' }
    ]
  },
  news: {
    title: 'Новость для сайта',
    help: 'Отделите анонс от состоявшегося события и укажите, кто подтверждает сведения.',
    fields: [
      { name: 'material_status', label: 'Статус материала', type: 'select', required: true, options: ['Анонс', 'Событие состоялось', 'Получен результат', 'Уточнение ранее опубликованного'] },
      { name: 'subject', label: 'Тема новости', type: 'text', required: true },
      { name: 'date', label: 'Дата события', type: 'date', required: true },
      { name: 'place', label: 'Место', type: 'text', required: true },
      { name: 'what_happened', label: 'Что произошло', type: 'textarea', required: true },
      { name: 'participants', label: 'Кто участвовал', type: 'textarea' },
      { name: 'result', label: 'Какой получен результат', type: 'textarea', required: true },
      { name: 'thanks', label: 'Кого поблагодарить', type: 'textarea' },
      { name: 'media', label: 'Ссылка на фото или видео', type: 'url' },
      { name: 'source', label: 'Источник подтверждения', type: 'text', required: true, placeholder: 'Например: организатор, председатель ТОС или официальный отчёт' },
      { name: 'source_link', label: 'Ссылка на источник', type: 'url' }
    ]
  },
  photo: {
    title: 'Фотоотчёт',
    help: 'Укажите этап работ, фактический результат и источник подтверждения.',
    fields: [
      { name: 'material_status', label: 'Статус материала', type: 'select', required: true, options: ['Работы начались', 'Работы продолжаются', 'Работы завершены', 'Сравнение до и после'] },
      { name: 'subject', label: 'Что показываем', type: 'text', required: true },
      { name: 'date', label: 'Дата работ', type: 'date', required: true },
      { name: 'place', label: 'Адрес или место', type: 'text', required: true },
      { name: 'before', label: 'Что было до работ', type: 'textarea', required: true },
      { name: 'work', label: 'Что сделали', type: 'textarea', required: true },
      { name: 'after', label: 'Что получилось', type: 'textarea', required: true },
      { name: 'participants', label: 'Кто участвовал', type: 'textarea' },
      { name: 'media', label: 'Ссылка на фотографии', type: 'url' },
      { name: 'source', label: 'Источник подтверждения', type: 'text', required: true, placeholder: 'Например: автор фото, организатор или ответственный за работы' },
      { name: 'source_link', label: 'Ссылка на источник', type: 'url' }
    ]
  },
  event: {
    title: 'Событие в календарь',
    help: 'Укажите актуальный статус, точные дату и место, а также источник информации.',
    fields: [
      { name: 'material_status', label: 'Статус материала', type: 'select', required: true, options: ['Запланировано', 'Перенесено', 'Отменено', 'Состоялось'] },
      { name: 'subject', label: 'Название события', type: 'text', required: true },
      { name: 'date', label: 'Дата', type: 'date', required: true },
      { name: 'time', label: 'Время', type: 'time' },
      { name: 'place', label: 'Место', type: 'text', required: true },
      { name: 'description', label: 'Краткое описание', type: 'textarea', required: true },
      { name: 'audience', label: 'Кто может участвовать', type: 'text' },
      { name: 'bring', label: 'Что взять с собой', type: 'text' },
      { name: 'responsible', label: 'Ответственный', type: 'text' },
      { name: 'source', label: 'Источник подтверждения', type: 'text', required: true, placeholder: 'Например: организатор события или официальное объявление' },
      { name: 'source_link', label: 'Ссылка на источник', type: 'url' }
    ]
  },
  project: {
    title: 'Проект или идея проекта',
    help: 'Точно отделите идею, подготовку, заявку, реализацию и завершённый результат.',
    fields: [
      { name: 'material_status', label: 'Статус материала', type: 'select', required: true, options: ['Идея для обсуждения', 'Подготовка', 'Заявка подана', 'Поддержано или профинансировано', 'Реализуется', 'Завершено'] },
      { name: 'subject', label: 'Название проекта', type: 'text', required: true },
      { name: 'problem', label: 'Какая проблема решается', type: 'textarea', required: true },
      { name: 'place', label: 'Где находится объект', type: 'text', required: true },
      { name: 'solution', label: 'Что планируется сделать', type: 'textarea', required: true },
      { name: 'audience', label: 'Для кого проект', type: 'text' },
      { name: 'result', label: 'Ожидаемый или фактический результат', type: 'textarea', required: true },
      { name: 'budget', label: 'Ориентировочная смета', type: 'text' },
      { name: 'resources', label: 'Что уже подготовлено', type: 'textarea' },
      { name: 'support', label: 'Какая помощь нужна', type: 'textarea' },
      { name: 'media', label: 'Ссылка на фото или эскиз', type: 'url' },
      { name: 'source', label: 'Источник подтверждения', type: 'text', required: true, placeholder: 'Например: решение собрания, заявка, протокол, организатор или отчёт' },
      { name: 'source_link', label: 'Ссылка на источник', type: 'url' }
    ]
  },
  need: {
    title: 'Потребность территории',
    help: 'Укажите текущий статус потребности, точный объём и источник информации.',
    fields: [
      { name: 'material_status', label: 'Статус материала', type: 'select', required: true, options: ['Сбор помощи', 'Частично закрыто', 'Закрыто', 'Срок истёк'] },
      { name: 'subject', label: 'Что нужно', type: 'text', required: true },
      { name: 'purpose', label: 'Для чего это нужно', type: 'textarea', required: true },
      { name: 'quantity', label: 'Количество или объём', type: 'text' },
      { name: 'deadline', label: 'Желательный срок', type: 'date' },
      { name: 'options', label: 'Варианты помощи', type: 'textarea', placeholder: 'Материалы, техника, волонтёры, информационная помощь' },
      { name: 'responsible', label: 'Ответственный', type: 'text' },
      { name: 'media', label: 'Ссылка на фото или описание', type: 'url' },
      { name: 'remove_date', label: 'Когда снять потребность с сайта', type: 'date' },
      { name: 'source', label: 'Источник подтверждения', type: 'text', required: true, placeholder: 'Например: председатель ТОС, организатор сбора или заявитель' },
      { name: 'source_link', label: 'Ссылка на источник', type: 'url' }
    ]
  }
};

window.TOS_UPDATE_LABELS = {
  material_status: 'Статус материала',
  changes: 'Что изменить',
  correct_value: 'Правильные сведения',
  chairperson: 'Председатель',
  phone: 'Телефон',
  email: 'Email',
  social: 'Сообщество',
  boundaries: 'Территория',
  description: 'Описание',
  source: 'Источник подтверждения',
  source_link: 'Ссылка на источник',
  subject: 'Тема',
  date: 'Дата',
  time: 'Время',
  place: 'Место',
  what_happened: 'Что произошло',
  participants: 'Участники',
  result: 'Результат',
  thanks: 'Благодарность',
  media: 'Фото / материалы',
  before: 'До работ',
  work: 'Что сделали',
  after: 'После работ',
  audience: 'Для кого',
  bring: 'Что взять',
  responsible: 'Ответственный',
  problem: 'Проблема',
  solution: 'Решение',
  budget: 'Смета',
  resources: 'Что подготовлено',
  support: 'Нужна помощь',
  purpose: 'Назначение',
  quantity: 'Количество',
  deadline: 'Срок',
  options: 'Варианты помощи',
  remove_date: 'Снять с сайта'
};