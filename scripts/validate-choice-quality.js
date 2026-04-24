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

/**
 * [재발 방지 - 단독 픽 이미지 위치 강제 가드]
 * 수동 단독 초이스 글에서 다음을 강제한다:
 *   1) `## 📍 픽앤조이 오늘의 단독 픽` 헤딩이 정확히 1개 존재.
 *   2) 헤딩 바로 다음 non-empty 라인은 이미지 마크다운(`![alt](url)`)이어야 한다.
 *   3) 그 다음 non-empty 라인은 CTA 링크(`**👉 [...](url)**`)여야 한다.
 *   4) frontmatter `image`(=hero) URL이 본문 어디에도 등장하면 안 된다.
 *      (hero는 frontmatter 자동 렌더링에 위임 — render의 removeFirstDuplicateHeroImage와 충돌 방지)
 *   5) middleImage URL이 본문에 2회 이상 등장하면 안 된다 (단독 픽 블록 1회만 허용).
 *
 * 이 가드가 통과해야만 빌드(next build) 진행. (npm run build는 check:choice-quality 선행)
 *
 * 관련 코드:
 *   - 생성 측: scripts/generate-choice-post.js::buildSinglePickBlock, stripDuplicateMiddleImage
 *   - 렌더 측: src/app/blog/[slug]/page.tsx::removeFirstDuplicateHeroImage
 */
function validateManualSinglePickImagePosition(body, frontmatter) {
  const errors = [];
  const heroImage = String(frontmatter.image || '').trim();
  const text = String(body || '');
  if (!text) return errors;

  const headingRegex = /^##\s+📍\s+픽앤조이\s+오늘의\s+단독\s+픽\s*$/m;
  const headingMatches = text.match(/^##\s+📍\s+픽앤조이\s+오늘의\s+단독\s+픽\s*$/gm) || [];

  // 단독 픽 헤딩이 없으면 단독 모드 글이 아니므로 검증 스킵
  if (headingMatches.length === 0) return errors;

  if (headingMatches.length > 1) {
    errors.push(`'## 📍 픽앤조이 오늘의 단독 픽' 헤딩이 ${headingMatches.length}회 등장합니다. 정확히 1회만 허용됩니다.`);
  }

  const lines = text.split('\n');
  const headingIndex = lines.findIndex((line) => headingRegex.test(line));
  if (headingIndex < 0) return errors;

  // 헤딩 다음 non-empty 라인 1, 2 추출
  const nextNonEmpty = [];
  for (let i = headingIndex + 1; i < lines.length && nextNonEmpty.length < 2; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    nextNonEmpty.push(trimmed);
  }

  const [first, second] = nextNonEmpty;
  if (!first || !/^!\[[^\]]*\]\([^)]+\)$/.test(first)) {
    errors.push("'## 📍 픽앤조이 오늘의 단독 픽' 헤딩 바로 다음 라인은 이미지 마크다운(`![alt](url)`)이어야 합니다.");
  }
  if (!second || !/^\*\*👉\s*\[[^\]]+\]\([^)]+\)\*\*/.test(second)) {
    errors.push("'## 📍 픽앤조이 오늘의 단독 픽' 이미지 다음 라인은 CTA 링크(`**👉 [...](url)**`)여야 합니다.");
  }

  // hero가 본문에 등장하면 실패 (frontmatter image 자동 렌더링과 중복)
  if (heroImage) {
    const escapedHero = heroImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const heroInBody = new RegExp(`!\\[[^\\]]*\\]\\(${escapedHero}\\)`, 'i');
    if (heroInBody.test(text)) {
      errors.push(`hero 이미지(frontmatter.image=${heroImage})가 본문에 등장합니다. hero는 frontmatter 자동 렌더링에 위임해야 합니다. (render의 removeFirstDuplicateHeroImage와 충돌)`);
    }
  }

  // middleImage 중복 검사 (단독 픽 블록 1회만)
  if (first && /^!\[[^\]]*\]\(([^)]+)\)$/.test(first)) {
    const middleImageUrl = first.match(/^!\[[^\]]*\]\(([^)]+)\)$/)[1];
    const escapedMid = middleImageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const occurrences = (text.match(new RegExp(`!\\[[^\\]]*\\]\\(${escapedMid}\\)`, 'gi')) || []).length;
    if (occurrences > 1) {
      errors.push(`단독 픽 본문 이미지(${middleImageUrl})가 ${occurrences}회 등장합니다. 정확히 1회만 허용됩니다.`);
    }
  }

  return errors;
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
      issues.push(...validateManualSinglePickImagePosition(body, frontmatter));
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
