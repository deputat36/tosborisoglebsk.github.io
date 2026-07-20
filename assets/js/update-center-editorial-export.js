(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TOS_UPDATE_EDITORIAL_EXPORT = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const INTAKE_HEADERS = [
    'submission_type',
    'tos_name',
    'title',
    'short_summary',
    'event_or_fact_date',
    'source_person',
    'source_contact',
    'source_document_or_link',
    'publication_permission',
    'media_attached',
    'personal_data_present',
    'target_section',
    'status',
    'next_step'
  ];

  const QUEUE_HEADERS = [
    'queue_id',
    'submission_type',
    'tos_name',
    'title',
    'source_checked',
    'permission_checked',
    'personal_data_checked',
    'media_checked',
    'target_file',
    'status',
    'blocker',
    'owner',
    'next_step'
  ];

  const PROFILES = {
    card: {
      submissionType: 'card_update',
      targetSection: '/tos/ и data/toses.json',
      targetFile: 'data/toses.json',
      nextStep: 'сверить изменяемое поле с источником и журналом верификации'
    },
    news: {
      submissionType: 'news',
      targetSection: '/news/ и data/news.json',
      targetFile: 'data/news.json',
      nextStep: 'проверить дату факт источник разрешение и персональные данные'
    },
    photo: {
      submissionType: 'media',
      targetSection: '/media-intake/ и data/media_intake_register.csv',
      targetFile: 'data/media_intake_register.csv',
      nextStep: 'проверить автора правообладателя людей на фото и объём разрешения'
    },
    event: {
      submissionType: 'news',
      targetSection: '/news/ и data/news.json',
      targetFile: 'data/news.json',
      nextStep: 'проверить актуальный статус события дату источник и право на публикацию'
    },
    project: {
      submissionType: 'project',
      targetSection: '/projects/ и data/projects.json',
      targetFile: 'data/projects.json',
      nextStep: 'проверить статус проекта сроки подтверждение ТОС и право на публикацию'
    },
    need: {
      submissionType: 'need',
      targetSection: '/needs/ и data/needs.json',
      targetFile: 'data/needs.json',
      nextStep: 'проверить срок актуальности источник контакт и условия закрытия потребности'
    }
  };

  const clean = (value) => String(value ?? '').trim();

  function profileFor(scenarioKey) {
    return PROFILES[scenarioKey] || PROFILES.news;
  }

  function timestampId(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return 'incoming-undated';
    return `incoming-${date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}`;
  }

  function titleFor(scenarioKey, scenario, data, tosName) {
    if (clean(data.subject)) return clean(data.subject);
    if (scenarioKey === 'card') return `Обновление карточки ${tosName || 'ТОС'}`;
    return clean(scenario?.title) || 'Входящий материал';
  }

  function summaryFor(scenarioKey, data) {
    const candidates = {
      card: [data.material_status, data.changes, data.correct_value],
      news: [data.material_status, data.what_happened, data.result],
      photo: [data.material_status, data.work, data.after],
      event: [data.material_status, data.description, data.place],
      project: [data.material_status, data.problem, data.solution, data.result],
      need: [data.material_status, data.purpose, data.quantity]
    }[scenarioKey] || [data.material_status, data.description, data.result];

    return candidates.map(clean).filter(Boolean).join(' — ').slice(0, 700);
  }

  function csvCell(value) {
    const text = clean(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCsv(headers, row) {
    return `${headers.map(csvCell).join(',')}\n${headers.map((header) => csvCell(row[header])).join(',')}\n`;
  }

  function buildPackage(input) {
    const scenarioKey = clean(input?.scenarioKey) || 'news';
    const scenario = input?.scenario || {};
    const data = input?.data || {};
    const profile = profileFor(scenarioKey);
    const tosName = clean(input?.tosName);
    const generatedAt = input?.generatedAt || new Date();
    const title = titleFor(scenarioKey, scenario, data, tosName);
    const hasMedia = Boolean(clean(data.media));
    const sourceLink = clean(data.source_link);

    const intake = {
      submission_type: profile.submissionType,
      tos_name: tosName,
      title,
      short_summary: summaryFor(scenarioKey, data),
      event_or_fact_date: clean(data.date || data.deadline),
      source_person: clean(data.source),
      source_contact: clean(data.contact),
      source_document_or_link: sourceLink,
      publication_permission: 'не подтверждено',
      media_attached: hasMedia ? 'да' : 'нет',
      personal_data_present: 'не проверено',
      target_section: profile.targetSection,
      status: 'draft',
      next_step: profile.nextStep
    };

    const blockerParts = [
      'источник указан заявителем но не проверен',
      'разрешения и персональные данные не проверены'
    ];
    if (hasMedia) blockerParts.push('медиа не проверены');

    const queue = {
      queue_id: timestampId(generatedAt),
      submission_type: profile.submissionType,
      tos_name: tosName,
      title,
      source_checked: 'нет',
      permission_checked: 'нет',
      personal_data_checked: 'нет',
      media_checked: hasMedia ? 'нет' : 'не применимо',
      target_file: profile.targetFile,
      status: 'draft',
      blocker: blockerParts.join('; '),
      owner: '',
      next_step: profile.nextStep
    };

    return {
      intake,
      queue,
      intakeCsv: toCsv(INTAKE_HEADERS, intake),
      queueCsv: toCsv(QUEUE_HEADERS, queue),
      fileStem: `${timestampId(generatedAt)}-${scenarioKey}`
    };
  }

  return {
    INTAKE_HEADERS,
    QUEUE_HEADERS,
    PROFILES,
    profileFor,
    timestampId,
    toCsv,
    buildPackage
  };
});
