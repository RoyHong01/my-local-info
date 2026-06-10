const fs = require('fs');
const path = require('path');

const targets = [
  path.join(process.cwd(), 'src/content'),
  path.join(process.cwd(), 'src/app/life/restaurant/data/restaurants.json'),
];

const patterns = [
  {
    name: 'Places key URL',
    regex: /https:\/\/places\.googleapis\.com\/v1\/[^\s"')]*key=[^\s"')]+/,
  },
  {
    name: 'Google API key literal',
    regex: /AIza[0-9A-Za-z_-]{20,}/,
  },
];

function walkFiles(entryPath, out = []) {
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    out.push(entryPath);
    return out;
  }

  for (const name of fs.readdirSync(entryPath)) {
    walkFiles(path.join(entryPath, name), out);
  }
  return out;
}

const findings = [];

for (const target of targets) {
  if (!fs.existsSync(target)) continue;

  const files = walkFiles(target).filter((filePath) => filePath.endsWith('.md') || filePath.endsWith('.json'));
  for (const filePath of files) {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          findings.push({
            filePath,
            line: index + 1,
            pattern: pattern.name,
            sample: line.slice(0, 180),
          });
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error('Found exposed key patterns:');
  for (const item of findings.slice(0, 100)) {
    const rel = path.relative(process.cwd(), item.filePath).replace(/\\/g, '/');
    console.error(`- ${rel}:${item.line} [${item.pattern}] ${item.sample}`);
  }
  if (findings.length > 100) {
    console.error(`... and ${findings.length - 100} more`);
  }
  process.exit(1);
}

console.log('No exposed key patterns found in monitored content/data files.');
