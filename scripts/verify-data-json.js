const fs = require('fs');
const path = require('path');

const DEFAULT_FILES = [
  'public/data/incheon.json',
  'public/data/subsidy.json',
  'public/data/festival.json',
];

const targetFiles = process.argv.slice(2);
const filesToCheck = targetFiles.length > 0 ? targetFiles : DEFAULT_FILES;

let hasFailure = false;

for (const relativeFile of filesToCheck) {
  const absoluteFile = path.resolve(relativeFile);

  try {
    if (!fs.existsSync(absoluteFile)) {
      hasFailure = true;
      console.error(`[FAIL] ${relativeFile}: file not found`);
      continue;
    }

    const raw = fs.readFileSync(absoluteFile, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      hasFailure = true;
      console.error(`[FAIL] ${relativeFile}: expected a JSON array`);
      continue;
    }

    const totalCount = parsed.length;
    const descriptionCount = parsed.filter(
      (item) => typeof item?.description_markdown === 'string' && item.description_markdown.trim().length > 0
    ).length;
    const expiredCount = parsed.filter((item) => item?.expired === true).length;

    console.log(
      [
        `[OK] ${relativeFile}`,
        `total=${totalCount}`,
        `description_markdown=${descriptionCount}`,
        `missing_description=${totalCount - descriptionCount}`,
        `expired=${expiredCount}`,
      ].join(' | ')
    );
  } catch (error) {
    hasFailure = true;
    console.error(`[FAIL] ${relativeFile}: ${error.message}`);
  }
}

if (hasFailure) {
  process.exitCode = 1;
}