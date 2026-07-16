const assert = require('assert');
const {
  isOverdue,
  readiness,
  validationIssues
} = require('../assets/js/outreach-validation');

function item(overrides = {}) {
  return {
    outreach_id: 'out-test',
    request_group: 'priority_card',
    source_request_id: 'test',
    subject: 'Тестовый запрос',
    recipient_type: 'представитель ТОС',
    channel: '',
    contact: '',
    status: 'draft',
    sent_date: '',
    follow_up_date: '',
    response_date: '',
    response_source: '',
    owner: '',
    blocker: '',
    next_step: 'Подготовить запрос',
    ...overrides
  };
}

assert.deepStrictEqual(readiness(item()), {
  state: 'blocked',
  missing: ['channel', 'contact', 'owner']
});
assert.deepStrictEqual(readiness(item({ channel: 'email', contact: 'Администрация БГО', owner: 'Редактор' })), {
  state: 'ready',
  missing: []
});

const sentIssues = validationIssues(item({
  status: 'sent',
  channel: 'email',
  sent_date: '2026-07-15'
}));
assert.ok(sentIssues.includes('для статуса нужен фактический получатель или организация'));
assert.ok(sentIssues.includes('для статуса нужен ответственный'));
assert.ok(sentIssues.includes('для статуса нужна дата повторного контакта'));

const receivedIssues = validationIssues(item({
  status: 'received',
  response_date: '2026-07-16',
  response_source: 'safe-ref'
}));
assert.ok(receivedIssues.includes('для статуса нужен реальный канал'));
assert.ok(receivedIssues.includes('для статуса нужен фактический получатель или организация'));
assert.ok(receivedIssues.includes('для статуса нужен ответственный'));
assert.ok(receivedIssues.includes('для статуса нужна дата отправки'));

assert.ok(validationIssues(item({ status: 'draft', sent_date: '2026-07-15' })).includes('черновик не может иметь дату отправки'));
assert.ok(validationIssues(item({
  status: 'resolved',
  sent_date: '2026-07-15',
  response_date: '2026-07-15',
  response_source: 'official-source'
})).includes('resolved не может иметь дату отправки'));
assert.ok(validationIssues(item({
  status: 'waiting',
  channel: 'email',
  contact: 'Администрация БГО',
  owner: 'Редактор',
  sent_date: '2026-07-15',
  follow_up_date: '2026-07-14'
})).includes('повторный контакт раньше отправки'));

assert.strictEqual(isOverdue(item({
  status: 'waiting',
  follow_up_date: '2026-07-10'
}), new Date('2026-07-16T12:00:00Z')), true);
assert.strictEqual(isOverdue(item({
  status: 'resolved',
  follow_up_date: '2026-07-10'
}), new Date('2026-07-16T12:00:00Z')), false);

console.log('Outreach validation self-test OK');
