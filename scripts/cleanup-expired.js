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

  // subsidy.json 만료일 자동 감지 보정 패스
  const subsidyPath = path.join(process.cwd(), 'public', 'data', 'subsidy.json');
  try {
    const subsidyRaw = await fs.readFile(subsidyPath, 'utf-8');
    const subsidyData = JSON.parse(subsidyRaw);
    const expiryPattern = /(\d{4})\.(\d{2})\.(\d{2})\.한/;
    function parseExpiry(text) {
      const m = expiryPattern.exec(String(text || ''));
      return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
    }
    let subsidyExpired = 0;
    for (const item of subsidyData) {
      if (item.expired) continue;
      const expiryDate = parseExpiry(item['지원내용'])
        || parseExpiry(item['지원대상'])
        || parseExpiry(item['선정기준']);
      if (expiryDate && expiryDate < today) {
        item.expired = true;
        subsidyExpired++;
      }
    }
    if (subsidyExpired > 0) {
      await fs.writeFile(subsidyPath, JSON.stringify(subsidyData, null, 2), 'utf-8');
      console.log(`subsidy.json 만료 보정: ${subsidyExpired}건 expired 처리`);
    }
  } catch (err) {
    console.error('subsidy.json 만료 보정 실패:', err.message);
  }
}

run();
