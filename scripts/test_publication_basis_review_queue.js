const assert = require('assert');
const { buildQueue, rowFor, scoreFor, waveFor } = require('./generate_publication_basis_review_queue');

function record(overrides = {}) {
  return {
    slug: 'test',
    basis_status: 'basis_review_required',
    personal_fields: ['chairperson'],
    personal_field_count: 1,
    phone_count: 0,
    email_count: 0,
    personal_profile_count: 0,
    community_count: 0,
    other_public_link_count: 0,
    has_source_ref: false,
    has_publication_consent_ref: false,
    missing_verification_scope: ['chairperson'],
    ...overrides
  };
}

function main() {
  const profile = record({ slug: 'profile', personal_fields: ['chairperson', 'social_links'], personal_field_count: 2, personal_profile_count: 1 });
  const phoneEmail = record({ slug: 'phone-email', personal_fields: ['chairperson', 'phones', 'emails'], personal_field_count: 3, phone_count: 1, email_count: 1 });
  const phone = record({ slug: 'phone', personal_fields: ['chairperson', 'phones'], personal_field_count: 2, phone_count: 1 });
  const nameOnly = record({ slug: 'name-only' });
  const unknownLink = record({ slug: 'unknown-link', personal_fields: ['chairperson', 'chairperson_links'], personal_field_count: 2, other_public_link_count: 1 });

  assert.strictEqual(waveFor(profile), 1);
  assert.strictEqual(waveFor(phoneEmail), 1);
  assert.strictEqual(waveFor(unknownLink), 1);
  assert.strictEqual(waveFor(phone), 2);
  assert.strictEqual(waveFor(nameOnly), 3);
  assert.ok(scoreFor(profile) > scoreFor(phone));
  assert.ok(scoreFor(phone) > scoreFor(nameOnly));

  const row = rowFor(profile);
  assert.strictEqual(row.priority, 'P0-1');
  assert.strictEqual(row.status, 'pending_external_confirmation');
  assert.ok(row.reason_codes.includes('personal_profile_published'));
  assert.ok(row.reason_codes.includes('publication_consent_ref_missing'));

  const queue = buildQueue({ records: [nameOnly, phone, profile, phoneEmail, unknownLink, record({ slug: 'safe', basis_status: 'basis_documented' })] });
  assert.deepStrictEqual(queue.map((item) => item.wave), [1, 1, 1, 2, 3]);
  assert.strictEqual(queue.some((item) => item.slug === 'safe'), false);
  assert.strictEqual(JSON.stringify(queue).includes('+7'), false);
  assert.strictEqual(JSON.stringify(queue).includes('http'), false);

  console.log('Publication basis review queue self-test OK');
}

main();
