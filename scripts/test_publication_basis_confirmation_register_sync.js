const assert = require('assert');
const { synchronizeRows } = require('./sync_publication_basis_confirmation_register');

function main() {
  const queue = [
    { slug: 'alpha', wave: '1', priority: 'P0-1', score: '90' },
    { slug: 'beta', wave: '2', priority: 'P0-2', score: '38' }
  ];
  const register = [
    {
      tos_slug: 'beta',
      wave: '2',
      priority: 'P0-2',
      score: '58',
      template_id: 'publication-basis-wave-2',
      request_status: 'sent',
      recipient_role: 'председатель ТОС',
      channel_type: 'other_private_channel',
      owner_role: 'portal-editor',
      sent_date: '2026-09-01',
      follow_up_date: '2026-09-08',
      response_date: '',
      reviewed_at: '',
      reviewed_by_role: '',
      chairperson_status: '',
      field_types_to_keep: '',
      field_types_to_remove: '',
      preferred_public_channel_type: '',
      personal_profile_classification: '',
      factual_source_ref: '',
      decision_status: 'not_reviewed',
      blocker: 'ожидается ответ',
      next_step: 'проверить ответ'
    }
  ];

  const rows = synchronizeRows(queue, register);
  assert.deepStrictEqual(rows.map((row) => row.tos_slug), ['alpha', 'beta']);

  const alpha = rows[0];
  assert.strictEqual(alpha.request_status, 'draft');
  assert.strictEqual(alpha.template_id, 'publication-basis-wave-1');

  const beta = rows[1];
  assert.strictEqual(beta.score, '38');
  assert.strictEqual(beta.priority, 'P0-2');
  assert.strictEqual(beta.template_id, 'publication-basis-wave-2');
  assert.strictEqual(beta.request_status, 'sent');
  assert.strictEqual(beta.recipient_role, 'председатель ТОС');
  assert.strictEqual(beta.sent_date, '2026-09-01');
  assert.strictEqual(beta.blocker, 'ожидается ответ');
  assert.strictEqual(beta.next_step, 'проверить ответ');

  console.log('Publication basis confirmation register synchronization self-test OK');
}

main();
