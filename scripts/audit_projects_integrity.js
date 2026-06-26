const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const projectsPath = path.join(process.cwd(), 'data', 'projects.json');
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedStatuses = new Set(['published', 'draft', 'archived']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function main() {
  if (!fs.existsSync(projectsPath)) {
    throw new Error(`Missing file: ${projectsPath}`);
  }

  const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const errors = [];

  if (!Array.isArray(projects)) {
    throw new Error('Projects integrity audit failed:\ndata/projects.json must be an array');
  }

  const seenIds = new Set();
  const seenTitles = new Set();

  projects.forEach((project, index) => {
    const line = `project ${index + 1}`;

    if (!isObject(project)) {
      errors.push(`${line}: item must be an object`);
      return;
    }

    const id = project.id || '';
    const title = project.title || '';
    const type = project.type || '';
    const status = project.status || '';
    const description = project.description || '';
    const grantLogic = project.grant_logic || '';
    const basedOn = project.based_on || '';
    const steps = project.steps;

    if (!id) errors.push(`${line}: missing id`);
    if (id && !idPattern.test(id)) errors.push(`${line}: invalid id ${id}`);
    if (id && seenIds.has(id)) errors.push(`${line}: duplicate id ${id}`);
    if (id) seenIds.add(id);

    if (!title) errors.push(`${line}: missing title`);
    if (title && title.length < 8) errors.push(`${line}: title is too short`);
    if (title && seenTitles.has(title)) errors.push(`${line}: duplicate title ${title}`);
    if (title) seenTitles.add(title);

    if (!type) errors.push(`${line}: missing type`);
    if (!allowedStatuses.has(status)) errors.push(`${line}: unsupported status ${status}`);
    if (!description) errors.push(`${line}: missing description`);
    if (description && description.length < 50) errors.push(`${line}: description is too short`);
    if (!grantLogic) errors.push(`${line}: missing grant_logic`);
    if (grantLogic && grantLogic.length < 40) errors.push(`${line}: grant_logic is too short`);
    if (!basedOn) errors.push(`${line}: missing based_on`);

    if (!Array.isArray(steps) || steps.length < 3) {
      errors.push(`${line}: steps must contain at least 3 items`);
    } else {
      steps.forEach((step, stepIndex) => {
        if (typeof step !== 'string' || step.trim().length < 15) {
          errors.push(`${line}: step ${stepIndex + 1} is too short`);
        }
      });
    }

    if (status === 'published' && id && !repoPathExists(`/projects/${id}/`)) {
      errors.push(`${line}: missing generated page /projects/${id}/`);
    }
  });

  if (errors.length) {
    throw new Error(`Projects integrity audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Projects integrity OK: ${projects.length} projects`);
}

main();
