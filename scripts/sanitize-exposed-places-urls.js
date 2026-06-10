const fs = require('fs');
const path = require('path');

const targets = [
  path.join(process.cwd(), 'src/content'),
  path.join(process.cwd(), 'src/app/life/restaurant/data/restaurants.json'),
];

const placesKeyUrlPattern = /https:\/\/places\.googleapis\.com\/v1\/[^\s"')]*key=[^\s"')]+/g;

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

let changedFiles = 0;
let replacedUrls = 0;

for (const target of targets) {
  if (!fs.existsSync(target)) continue;

  const files = walkFiles(target).filter((filePath) => filePath.endsWith('.md') || filePath.endsWith('.json'));

  for (const filePath of files) {
    const original = fs.readFileSync(filePath, 'utf8');
    const matches = original.match(placesKeyUrlPattern) || [];
    if (matches.length === 0) continue;

    const sanitized = original.replace(placesKeyUrlPattern, '/images/default-restaurant.svg');
    fs.writeFileSync(filePath, sanitized, 'utf8');
    changedFiles += 1;
    replacedUrls += matches.length;
  }
}

console.log(`changed_files=${changedFiles}`);
console.log(`replaced_urls=${replacedUrls}`);
