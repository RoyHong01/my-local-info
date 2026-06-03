const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = { input: '', help: false };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--help' || key === '-h') {
      args.help = true;
      continue;
    }
    if (key === '--input' && next) {
      args.input = next;
      i += 1;
      continue;
    }
  }
  return args;
}

function printHelp() {
  console.log('Usage: node scripts/run-choice-request.js --input scripts/choice-input.request.json');
  console.log('');
  console.log('This command will:');
  console.log('1) backup scripts/choice-input.latest.json');
  console.log('2) replace latest input with --input file');
  console.log('3) run generate:choice:latest -> check:choice-quality -> build');
  console.log('4) restore scripts/choice-input.latest.json even on failure');
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  return result.status === null ? 1 : result.status;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  const latestPath = path.join(process.cwd(), 'scripts', 'choice-input.latest.json');

  if (!fs.existsSync(inputPath)) {
    console.error(`입력 파일이 없습니다: ${inputPath}`);
    process.exit(1);
  }

  const hadLatest = fs.existsSync(latestPath);
  const originalLatest = hadLatest ? fs.readFileSync(latestPath, 'utf-8') : null;

  let exitCode = 0;
  try {
    fs.copyFileSync(inputPath, latestPath);

    const generateCode = runCommand('node', ['scripts/run-choice-latest.js']);
    if (generateCode !== 0) {
      exitCode = generateCode;
      return;
    }

    const qualityCode = runCommand('npm', ['run', 'check:choice-quality']);
    if (qualityCode !== 0) {
      exitCode = qualityCode;
      return;
    }

    const buildCode = runCommand('npm', ['run', 'build']);
    if (buildCode !== 0) {
      exitCode = buildCode;
      return;
    }
  } finally {
    try {
      if (hadLatest) {
        fs.writeFileSync(latestPath, originalLatest, 'utf-8');
      } else if (fs.existsSync(latestPath)) {
        fs.unlinkSync(latestPath);
      }
    } catch (restoreError) {
      console.error('choice-input.latest.json 복원 실패:', restoreError.message || restoreError);
      if (exitCode === 0) {
        exitCode = 1;
      }
    }
  }

  process.exit(exitCode);
}

main();
