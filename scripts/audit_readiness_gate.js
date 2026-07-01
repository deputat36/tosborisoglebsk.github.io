const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');

const csvPath = path.join(process.cwd(), 'data', 'verification_readiness_matrix.csv');

function main() {
  if (!fs.existsSync(csvPath)) throw new Error(`Missing file: ${csvPath}`);

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const errors = [];

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const [tos, slug, totalRequired, acceptedCount, missingCount, readinessPercent, currentGate, nextRequiredAction, canSetVerified, blockers] = row.map((cell) => (cell || '').trim());

    if (!tos) errors.push(`line ${line}: missing tos`);
    if (!slug) errors.push(`line ${line}: missing slug`);

    const total = Number(totalRequired);
    const accepted = Number(acceptedCount);
    const missing = Number(missingCount);
    const readiness = Number(readinessPercent);

    if (!Number.isInteger(total) || !Number.isInteger(accepted) || !Number.isInteger(missing) || !Number.isInteger(readiness)) {
      errors.push(`line ${line}: numeric readiness fields are invalid`);
      return;
    }

    if (accepted + missing !== total) {
      errors.push(`line ${line}: accepted plus missing must equal total`);
    }

    if (canSetVerified === 'да' && (readiness !== 100 || missing !== 0 || accepted !== total || blockers)) {
      errors.push(`line ${line}: final status requires full readiness and no blockers`);
    }

    if (canSetVerified === 'нет' && !blockers) {
      errors.push(`line ${line}: blocked row must explain blockers`);
    }

    if (!currentGate) errors.push(`line ${line}: missing current gate`);
    if (!nextRequiredAction) errors.push(`line ${line}: missing next action`);
  });

  if (errors.length) {
    throw new Error(`Readiness gate audit failed:\n${errors.join('\n')}`);
  }

  console.log('Readiness gate OK');
}

main();
