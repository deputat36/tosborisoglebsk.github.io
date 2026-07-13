const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const AUDIT_SCRIPT = path.join(ROOT, 'scripts', 'audit_priority_tos_update_evidence.js');
const POLICY_FILE = path.join(ROOT, 'data', 'priority_tos_evidence_policy.json');
const SLUGS = ['ivanovka', 'podstepki', 'gubari', 'tancyrey'];
const HEADERS = [
  'tos',
  'slug',
  'review_status',
  'response_received_at',
  'response_source_type',
  'public_source_url',
  'private_source_recorded',
  'chairperson_confirmed',
  'boundaries_confirmed',
  'public_phone_confirmed',
  'email_confirmed',
  'social_confirmed',
  'logo_rights_confirmed',
  'photo_rights_confirmed',
  'publication_consent_confirmed',
  'verification_decision',
  'next_step',
  'notes'
];

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function writeCsv(filePath, records) {
  const lines = [HEADERS.map(csvCell).join(',')];
  records.forEach((record) => {
    lines.push(HEADERS.map((header) => csvCell(record[header] || '')).join(','));
  });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function baseToses() {
  return SLUGS.map((slug) => ({
    slug,
    chairperson: `Председатель ${slug}`,
    boundaries: `Границы ${slug}`,
    phones: [],
    emails: [],
    chairperson_links: [],
    social_links: [],
    logo: '',
    trust: {
      source_type: '',
      source_ref: '',
      checked_at: '',
      checked_by: '',
      recheck_after: '',
      verification_scope: [],
      publication_consent_ref: ''
    }
  }));
}

function emptyReview(slug) {
  return {
    tos: `ТОС «${slug}»`,
    slug,
    review_status: 'Нет ответа',
    next_step: 'Ждать подтверждённый ответ'
  };
}

function runAudit(files) {
  return spawnSync(process.execPath, [AUDIT_SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PRIORITY_TOS_BASE_FILE: files.base,
      PRIORITY_TOS_CURRENT_FILE: files.current,
      PRIORITY_TOS_REVIEW_FILE: files.review,
      PRIORITY_TOS_POLICY_FILE: POLICY_FILE
    }
  });
}

function requireSuccess(result, scenario) {
  if (result.status !== 0) {
    throw new Error(`${scenario} should pass:\n${result.stdout}\n${result.stderr}`);
  }
}

function requireFailure(result, scenario, expectedText) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0) throw new Error(`${scenario} should fail`);
  if (!output.includes(expectedText)) {
    throw new Error(`${scenario} failed without expected message ${expectedText}:\n${output}`);
  }
}

function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'priority-tos-evidence-'));
  const files = {
    base: path.join(tempDir, 'base.json'),
    current: path.join(tempDir, 'current.json'),
    review: path.join(tempDir, 'review.csv')
  };

  try {
    const baseline = baseToses();
    fs.writeFileSync(files.base, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    fs.writeFileSync(files.current, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    writeCsv(files.review, SLUGS.map(emptyReview));

    requireSuccess(runAudit(files), 'unchanged protected fields');

    const changed = JSON.parse(JSON.stringify(baseline));
    changed.find((item) => item.slug === 'ivanovka').phones = ['+7 (900) 000-00-00'];
    fs.writeFileSync(files.current, `${JSON.stringify(changed, null, 2)}\n`, 'utf8');

    requireFailure(
      runAudit(files),
      'phone change without evidence',
      'public_phone_confirmed=да is not recorded'
    );

    const reviews = SLUGS.map(emptyReview);
    Object.assign(reviews.find((item) => item.slug === 'ivanovka'), {
      review_status: 'Готово к обновлению',
      response_received_at: '2026-07-13',
      response_source_type: 'Ответ председателя',
      private_source_recorded: 'да',
      public_phone_confirmed: 'да',
      publication_consent_confirmed: 'да',
      verification_decision: 'partial',
      next_step: 'Обновить телефон и сохранить частичный статус'
    });
    writeCsv(files.review, reviews);

    requireSuccess(runAudit(files), 'phone change with evidence and consent');

    console.log('Priority TOS update evidence self-test OK: unchanged, blocked change, approved change');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
