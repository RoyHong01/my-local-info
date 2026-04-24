/**
 * [재발 방지 - 단독 픽 빌드 게이트 단위 테스트]
 * scripts/generate-choice-post.js의 buildSinglePickBlock + stripDuplicateMiddleImage
 * 동작을 합성 fixture로 검증한다. 빌드 직전(npm run build)에 실행되어
 * 회귀가 발생하면 즉시 실패한다.
 *
 * 검증 항목:
 *   1. "## 📍 픽앤조이 오늘의 단독 픽" 헤딩 다음 라인은 middleImage 마크다운.
 *   2. 그 다음 라인은 CTA 링크.
 *   3. 본문에 hero 이미지가 등장하지 않음.
 *   4. middleImage가 다른 섹션에 추가로 들어가도 strip되어 1회만 남음.
 */
const path = require('path');
const Module = require('module');

// generate-choice-post.js를 require하면 즉시 실행되지 않는 함수만 추출 가능.
// 단, 이 파일은 export하지 않으므로 소스를 읽어 함수만 eval로 격리 추출.
const fs = require('fs');

const generatorSrc = fs.readFileSync(
  path.join(__dirname, 'generate-choice-post.js'),
  'utf-8'
);

function extractFunction(src, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const start = src.search(re);
  if (start < 0) throw new Error(`함수 ${name} 를 찾을 수 없습니다.`);
  let depth = 0;
  let i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(start, i + 1);
      }
    }
  }
  throw new Error(`함수 ${name} 의 닫는 중괄호를 찾을 수 없습니다.`);
}

const code = [
  extractFunction(generatorSrc, 'buildSinglePickBlock'),
  extractFunction(generatorSrc, 'stripDuplicateMiddleImage'),
].join('\n\n');

// eslint-disable-next-line no-new-func
const factory = new Function(`${code}\nreturn { buildSinglePickBlock, stripDuplicateMiddleImage };`);
const { buildSinglePickBlock, stripDuplicateMiddleImage } = factory();

const failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

const candidate = {
  image: '/images/choice/test-hero.png',
  middleImage: '/images/choice/test-middle.png',
  middleImageAlt: '테스트 디테일',
  coupangUrl: 'https://link.coupang.com/a/test',
  coupangBannerAlt: '테스트 상품',
  brand: '테스트 브랜드',
  title: '테스트 상품',
};

// 1) buildSinglePickBlock 출력 검증
const block = buildSinglePickBlock(candidate);
const blockLines = block.split('\n');
assert(blockLines[0] === '## 📍 픽앤조이 오늘의 단독 픽', `[1-1] 헤딩이 첫 라인이 아님: ${blockLines[0]}`);
assert(blockLines[1] === '', '[1-2] 헤딩 다음은 빈 줄이어야 함');
assert(
  /^!\[테스트 디테일\]\(\/images\/choice\/test-middle\.png\)$/.test(blockLines[2]),
  `[1-3] 헤딩 다음 이미지가 middleImage가 아님: ${blockLines[2]}`
);
assert(
  !block.includes('/images/choice/test-hero.png'),
  '[1-4] 단독 픽 블록에 hero 이미지가 포함되면 안 됨 (frontmatter 자동 렌더 위임)'
);
assert(
  /\*\*👉 \[.+?\]\(https:\/\/link\.coupang\.com\/a\/test\)\*\*/.test(block),
  '[1-5] CTA 링크 형식 위반'
);

// 2) stripDuplicateMiddleImage 동작 검증
const dirtyBody = `## 어떤 섹션
본문 내용입니다.

![중복 디테일](/images/choice/test-middle.png)

다른 문단.

## 다른 섹션
또 다른 내용.`;

const cleaned = stripDuplicateMiddleImage(dirtyBody, candidate);
assert(
  !cleaned.includes('/images/choice/test-middle.png'),
  '[2-1] 본문에서 middleImage가 strip되지 않음'
);
assert(cleaned.includes('## 어떤 섹션'), '[2-2] 섹션 헤딩이 보존되지 않음');
assert(cleaned.includes('## 다른 섹션'), '[2-3] 다른 섹션 헤딩이 보존되지 않음');

// 3) middleImage 누락 시 hero fallback 동작
const noMiddle = { ...candidate, middleImage: '' };
const fallbackBlock = buildSinglePickBlock(noMiddle);
assert(
  fallbackBlock.includes('/images/choice/test-hero.png'),
  '[3] middleImage가 없으면 hero를 fallback으로 사용해야 함'
);

if (failures.length > 0) {
  console.error('❌ 단독 픽 단위 테스트 실패');
  for (const msg of failures) console.error(`  - ${msg}`);
  process.exit(1);
}

console.log('✅ 단독 픽 단위 테스트 통과 (buildSinglePickBlock + stripDuplicateMiddleImage)');
