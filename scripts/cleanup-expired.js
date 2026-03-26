const fs = require('fs/promises');
const path = require('path');

async function run() {
  const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
  const today = new Date().toISOString().split('T')[0];

  let files = [];
  try {
    files = await fs.readdir(postsDir);
  } catch (err) {
    console.error("Failed to read posts directory:", err.message);
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(postsDir, file);
    let content = await fs.readFile(filePath, 'utf-8');

    // frontmatter 파싱 (--- 블록)
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      skipped++;
      continue;
    }

    const fmRaw = fmMatch[1];

    // endDate 추출
    const endDateMatch = fmRaw.match(/endDate:\s*(.+)/);
    if (!endDateMatch) {
      skipped++;
      continue;
    }

    const endDateVal = endDateMatch[1].trim().replace(/['"]/g, '');

    // 상시 또는 빈 값이면 유지
    if (!endDateVal || endDateVal === '상시' || endDateVal === 'null') {
      skipped++;
      continue;
    }

    // 날짜 비교
    if (endDateVal < today) {
      // 이미 expired: true면 스킵
      if (/expired:\s*true/.test(fmRaw)) {
        skipped++;
        continue;
      }

      // expired: false → true 로 교체, 없으면 추가
      let newFm;
      if (/expired:/.test(fmRaw)) {
        newFm = fmRaw.replace(/expired:\s*\S+/, 'expired: true');
      } else {
        newFm = fmRaw + '\nexpired: true';
      }

      content = content.replace(fmMatch[0], `---\n${newFm}\n---`);
      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`만료 처리: ${file} (endDate: ${endDateVal})`);
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`cleanup-expired 완료: ${updated}건 만료 처리, ${skipped}건 유지`);
}

run();
