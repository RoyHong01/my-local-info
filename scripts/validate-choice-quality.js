const fs = require('fs/promises');
const path = require('path');

const CONTENT_DIR = path.join(process.cwd(), 'src', 'content', 'life');

function splitFrontmatterAndBody(content) {
  const text = String(content || '');
  if (!text.startsWith('---\n')) {
    return { frontmatter: {}, body: text };
  }

  const end = text.indexOf('\n---\n', 4);
  if (end < 0) {
    return { frontmatter: {}, body: text };
  }

  const fmRaw = text.slice(4, end).trim();
  const body = text.slice(end + 5).trim();
  const frontmatter = {};

  for (const line of fmRaw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    if (!key) continue;
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

function isTextParagraph(block) {
  const value = block.trim();
  if (!value) return false;
  if (/^#{1,6}\s+/.test(value)) return false;
  if (/^!\[[^\]]*\]\([^)]+\)$/.test(value)) return false;
  if (/^\*\*(?:👉|🛒)/.test(value)) return false;
  return value.length >= 45;
}

/**
 * [재발 방지 - 모든 초이스 hook 검증]
 * 본문 첫 ## 헤딩 이전에 hook 단락(텍스트, 30자+) 1개 이상이 있어야 함.
 * 자동(auto), 수동(manual) 모두 적용.
 */
function validateIntroHook(body) {
  const errors = [];
  const trimmed = String(body || '').trim();
  if (!trimmed) return errors;

  const lines = trimmed.split('\n');
  const firstHeadingIndex = lines.findIndex((line) => /^##\s+/.test(line.trim()));
  if (firstHeadingIndex < 0) return errors;

  const intro = lines.slice(0, firstHeadingIndex).join('\n').trim();
  if (!intro) {
    errors.push('서론 hook 단락이 없습니다. 첫 ## 소제목 이전에 독자 공감용 hook 단락이 1개 이상 필요합니다.');
    return errors;
  }

  const introBlocks = intro.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const textBlocks = introBlocks.filter((block) => {
    if (/^#{1,6}\s+/.test(block)) return false;
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(block)) return false;
    if (/^\*\*(?:👉|🛒)/.test(block)) return false;
    return block.length >= 30;
  });

  if (textBlocks.length < 1) {
    errors.push('서론 hook 단락이 부족합니다. 첫 ## 소제목 이전에 30자 이상 텍스트 단락이 1개 이상 필요합니다.');
  }

  return errors;
}

/**
 * [재발 방지 - 모든 초이스 hook 검증]
 * 본문 첫 ## 헤딩 이전에 hook 단락(텍스트, 30자+) 1개 이상이 있어야 함.
 * 자동(auto), 수동(manual) 모두 적용.
 */
function validateIntroHook(body) {
  const errors = [];
  const trimmed = String(body || '').trim();
  if (!trimmed) return errors;

  const lines = trimmed.split('\n');
  const firstHeadingIndex = lines.findIndex((line) => /^##\s+/.test(line.trim()));
  if (firstHeadingIndex < 0) return errors;

  const intro = lines.slice(0, firstHeadingIndex).join('\n').trim();
  if (!intro) {
    errors.push('서론 hook 단락이 없습니다. 첫 ## 소제목 이전에 독자 공감용 hook 단락이 1개 이상 필요합니다.');
    return errors;
  }

  const introBlocks = intro.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const textBlocks = introBlocks.filter((block) => {
    if (/^#{1,6}\s+/.test(block)) return false;
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(block)) return false;
    if (/^\*\*(?:👉|🛒)/.test(block)) return false;
    return block.length >= 30;
  });

  if (textBlocks.length < 1) {
    errors.push('서론 hook 단락이 부족합니다. 첫 ## 소제목 이전에 30자 이상 텍스트 단락이 1개 이상 필요합니다.');
  }

  return errors;
}

function collectHeadingsAfterLine(lines, startLineIndex) {
  const headings = [];
  for (let i = startLineIndex + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^##\s+/.test(trimmed)) {
      headings.push(trimmed.replace(/^##\s+/, '').trim());
    }
  }
  return headings;
}

function validateManualChoiceBody(body, heroImage) {
  const errors = [];
  const lines = body.split('\n');

  const imageLines = lines
    .map((line, index) => ({ index, line: line.trim() }))
    .filter((item) => /^!\[[^\]]*\]\(([^)]+)\)$/.test(item.line));

  let middleImageLineIndex = -1;
  for (const item of imageLines) {
    const match = item.line.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
    const imageUrl = String(match?.[1] || '').trim();
    if (!imageUrl) continue;
    if (heroImage && imageUrl === heroImage) continue;
    middleImageLineIndex = item.index;
    break;
  }

  if (middleImageLineIndex < 0) {
    return errors;
  }

  const headingsAfterMiddle = collectHeadingsAfterLine(lines, middleImageLineIndex);
  const normalizedHeadings = headingsAfterMiddle.map((heading) => heading.replace(/\*\*/g, '').trim());

  const narrativeHeadings = normalizedHeadings.filter((heading) => {
    return !heading.includes('구매 전에 체크하면 좋은 포인트')
      && !heading.includes('한 줄 정리')
      && !heading.includes('픽앤조이 오늘의 단독 픽');
  });

  if (narrativeHeadings.length < 1) {
    errors.push('중간 이미지 이후 본문에 서사형 소제목이 부족합니다. (구매 전 체크/한 줄 정리 외 1개 이상 필요)');
  }

  const blocksAfterMiddle = lines.slice(middleImageLineIndex + 1).join('\n').split(/\n\s*\n/);
  const paragraphCount = blocksAfterMiddle.filter(isTextParagraph).length;
  if (paragraphCount < 4) {
    errors.push(`중간 이미지 이후 실질 문단 수가 부족합니다. (현재 ${paragraphCount}개, 최소 4개 필요)`);
  }

  return errors;
}

async function run() {
  const files = await fs.readdir(CONTENT_DIR);
  const mdFiles = files.filter((name) => name.endsWith('.md')).sort();

  const allIssues = [];

  for (const fileName of mdFiles) {
    const filePath = path.join(CONTENT_DIR, fileName);
    const raw = await fs.readFile(filePath, 'utf-8');
    const { frontmatter, body } = splitFrontmatterAndBody(raw);

    const category = String(frontmatter.category || '').trim();
    const publishedBy = String(frontmatter.published_by || '').trim().toLowerCase();

    if (category !== '픽앤조이 초이스') continue;

    const issues = [];

    // 수동 단독 글만 빌드 게이트로 검증한다.
    // (자동 글의 hook 보장은 generate-choice-post.js의 생성 시 검증 + 후처리 fallback에서 처리)
    if (publishedBy === 'manual') {
      issues.push(...validateIntroHook(body));
      issues.push(...validateManualChoiceBody(body, String(frontmatter.image || '').trim()));
    }

    if (issues.length > 0) {
      allIssues.push({
        filePath: `src/content/life/${fileName}`,
        issues,
      });
    }
  }

  if (allIssues.length > 0) {
    console.error('❌ 픽앤조이 초이스 품질 검증 실패');
    for (const item of allIssues) {
      console.error(`- ${item.filePath}`);
      for (const issue of item.issues) {
        console.error(`  - ${issue}`);
      }
    }
    process.exit(1);
  }

  console.log('✅ 픽앤조이 초이스 품질 검증 통과');
}

run().catch((error) => {
  console.error(`❌ 품질 검증 실행 실패: ${error.message}`);
  process.exit(1);
});
