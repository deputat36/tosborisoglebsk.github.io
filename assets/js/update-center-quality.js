(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TOS_UPDATE_QUALITY = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const clean = (value) => String(value ?? '').trim();

  function evaluate(input = {}) {
    const scenario = input.scenario || { fields: [] };
    const data = input.data || {};
    const requiredFields = (scenario.fields || []).filter((field) => field.required);
    const missingRequired = requiredFields
      .filter((field) => !clean(data[field.name]))
      .map((field) => field.label || field.name);
    const hasStatusField = (scenario.fields || []).some((field) => field.name === 'material_status');
    const hasSourceField = (scenario.fields || []).some((field) => field.name === 'source');

    const checks = [
      {
        id: 'territory',
        label: 'Указан ТОС или территория',
        passed: Boolean(input.tosSelected || clean(data.tos_custom)),
        blocking: false,
        hint: 'Материал без привязки можно отправить, но редакции придётся уточнять территорию.'
      },
      {
        id: 'required',
        label: 'Заполнены обязательные сведения',
        passed: missingRequired.length === 0,
        blocking: true,
        hint: missingRequired.length ? `Не заполнено: ${missingRequired.join(', ')}` : ''
      },
      {
        id: 'status',
        label: 'Указан фактический статус материала',
        passed: !hasStatusField || Boolean(clean(data.material_status)),
        blocking: hasStatusField,
        hint: 'Статус отделяет идею, анонс, процесс и подтверждённый результат.'
      },
      {
        id: 'source',
        label: 'Указан источник подтверждения',
        passed: !hasSourceField || Boolean(clean(data.source)),
        blocking: hasSourceField,
        hint: 'Подойдёт название документа, организатор, председатель или иной проверяемый источник.'
      },
      {
        id: 'contact',
        label: 'Оставлен контакт для уточнения',
        passed: Boolean(clean(data.contact)),
        blocking: false,
        hint: 'Контакт не публикуется автоматически и нужен только редакции.'
      },
      {
        id: 'accuracy',
        label: 'Подтверждена добросовестность сведений',
        passed: Boolean(input.confirmed),
        blocking: true,
        hint: 'Передавайте только известные вам факты и отмечайте всё, что требует проверки.'
      },
      {
        id: 'publication',
        label: 'Проверена допустимость передачи материалов',
        passed: Boolean(input.publicationChecked),
        blocking: true,
        hint: 'Фото, контакты, документы и другие материалы не публикуются автоматически.'
      }
    ];

    const passed = checks.filter((check) => check.passed).length;
    const blocking = checks.filter((check) => check.blocking && !check.passed);

    return {
      checks,
      passed,
      total: checks.length,
      percent: Math.round((passed / checks.length) * 100),
      missingRequired,
      ready: blocking.length === 0,
      blocking
    };
  }

  return { evaluate };
}));