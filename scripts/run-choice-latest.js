const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const inputPath = path.join(process.cwd(), 'scripts', 'choice-input.latest.json');

if (!fs.existsSync(inputPath)) {
  console.error(`입력 파일이 없습니다: ${inputPath}`);
  process.exit(1);
}

const extraArgs = process.argv.slice(2);
const args = ['scripts/generate-choice-post.js', '--input', inputPath, ...extraArgs];

const result = spawnSync('node', args, {
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

process.exit(result.status === null ? 1 : result.status);
