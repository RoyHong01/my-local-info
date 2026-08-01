const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const { promptHash } = require('./lib/anthropic-blog-batch');
const { finalizeBlogRequest } = require('./generate-blog-post');

function buildPreparedRequest({
  customId,
  postsDir,
  candidate,
  imageUrl,
}) {
  const prompt = `test prompt: ${customId}`;
  return {
    customId,
    prompt,
    promptHash: promptHash(prompt),
    maxTokens: 512,
    context: {
      candidate,
      postsDir,
      imageUrl,
      midImageUrl: '',
      itemName: candidate['서비스명'] || candidate.title || candidate.name || 'item',
      isSubsidy: false,
      sourceId: candidate['서비스ID'] || candidate.id || 'TEST-ID',
      sourceTitle: candidate['서비스명'] || candidate.title || candidate.name || 'item',
      sourceStartDate: '',
      sourceEndDate: '',
      sourceAddr1: '',
      sourceSnapshotKey: '',
      today: '2026-08-02',
      isFestival: false,
    },
  };
}

function buildModelResult(filename) {
  const longParagraph = [
    '인천 시민이 지원 제도를 처음 확인할 때 가장 먼저 필요한 것은 신청 자격과 준비 서류를 빠르게 파악할 수 있는 안내입니다.',
    '이 테스트 본문은 품질 게이트를 통과하기 위한 더미 문장으로 구성되며, 실제 운영 콘텐츠를 대체하지 않습니다.',
    '다만 구조는 실제 포스트와 유사하게 유지해 finalize 경로의 이미지 처리와 frontmatter 치환이 안정적으로 동작하는지 검증합니다.',
    '신청 대상, 접수 채널, 제출 문서, 처리 기간 같은 정보는 사용자 행동 전환에 직접 영향을 주기 때문에 문단으로 명확히 분리합니다.',
    '또한 본문 길이와 소제목 개수 조건을 충족시켜 불완전 응답 탐지 로직이 오탐 없이 작동하는지도 함께 확인합니다.',
  ].join(' ');

  return {
    text: `---\ntitle: \"테스트 포스트\"\ndate: 2026-08-02\nsummary: \"요약\"\ndescription: \"설명\"\ncategory: 인천 지역 정보\npublished_by: \"auto\"\ntags: [테스트, 이미지, 폴백, 검증, 자동화]\n---\n\n## 훅\n${longParagraph}\n\n### 신청 전에 먼저 확인할 핵심 조건\n${longParagraph}\n\n### 준비 서류와 접수 동선을 한 번에 정리\n${longParagraph}\n\n### 놓치기 쉬운 일정과 유의사항\n${longParagraph}\n\nFILENAME: ${filename}`,
    finishReason: 'STOP',
  };
}

async function testFinalizeFallbackRecoversImage() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-landmark-fallback-'));
  const postsDir = tempRoot;

  const candidate = {
    _category: '인천 지역 정보',
    '서비스명': '청소년 통합지원체계(청소년안전망)',
    '서비스ID': 'O00027100001',
    firstimage: '',
    firstimage2: '',
  };

  let resolverCallCount = 0;
  const preparedRequest = buildPreparedRequest({
    customId: 'test-fallback-recover',
    postsDir,
    candidate,
    imageUrl: 'https://pick-n-joy.com/images/default-incheon.svg',
  });

  const ok = await finalizeBlogRequest(
    preparedRequest,
    buildModelResult('fallback-recover-case'),
    null,
    {
      allowQualityRetry: false,
      landmarkResolver: async () => {
        resolverCallCount += 1;
        return 'https://example.com/recovered-landmark.jpg';
      },
    }
  );

  assert.strictEqual(ok, true, 'finalize should succeed');
  assert.strictEqual(resolverCallCount, 1, 'fallback resolver must run exactly once');

  const written = await fs.readFile(path.join(postsDir, 'fallback-recover-case.md'), 'utf-8');
  assert.match(
    written,
    /^image:\s*"https:\/\/example\.com\/recovered-landmark\.jpg"$/m,
    'image frontmatter should be replaced by recovered landmark URL'
  );
}

async function testFinalizeSkipsResolverWhenImageAlreadyResolved() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-landmark-noop-'));
  const postsDir = tempRoot;

  const candidate = {
    _category: '전국 보조금·복지 정책',
    '서비스명': '테스트 보조금',
    '서비스ID': 'TEST-002',
    firstimage: '',
    firstimage2: '',
  };

  let resolverCallCount = 0;
  const preparedRequest = buildPreparedRequest({
    customId: 'test-fallback-skip',
    postsDir,
    candidate,
    imageUrl: 'https://example.com/prepared-image.jpg',
  });

  const ok = await finalizeBlogRequest(
    preparedRequest,
    buildModelResult('fallback-skip-case'),
    null,
    {
      allowQualityRetry: false,
      landmarkResolver: async () => {
        resolverCallCount += 1;
        return 'https://example.com/should-not-be-used.jpg';
      },
    }
  );

  assert.strictEqual(ok, true, 'finalize should succeed');
  assert.strictEqual(resolverCallCount, 0, 'resolver must not run when image is already non-default');

  const written = await fs.readFile(path.join(postsDir, 'fallback-skip-case.md'), 'utf-8');
  assert.match(
    written,
    /^image:\s*"https:\/\/example\.com\/prepared-image\.jpg"$/m,
    'image frontmatter should keep prepared non-default image'
  );
}

async function run() {
  await testFinalizeFallbackRecoversImage();
  await testFinalizeSkipsResolverWhenImageAlreadyResolved();
  console.log('PASS test-blog-landmark-fallback');
}

run().catch((error) => {
  console.error('FAIL test-blog-landmark-fallback');
  console.error(error);
  process.exitCode = 1;
});
