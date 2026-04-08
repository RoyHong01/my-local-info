import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

function nowIso() {
  return new Date().toISOString();
}

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function statusEmoji(status) {
  if (status === 'success') return '✅';
  if (status === 'failure') return '❌';
  if (status === 'cancelled') return '⏹️';
  if (status === 'skipped') return '⏭️';
  return '•';
}

function toKoreanStatus(status) {
  const normalized = normalizeOutcome(status);
  if (normalized === 'success') return '성공';
  if (normalized === 'failure') return '실패';
  if (normalized === 'cancelled') return '취소';
  if (normalized === 'skipped') return '건너뜀';
  return '알 수 없음';
}

function normalizeOutcome(value) {
  if (!value) return 'unknown';
  return String(value).trim().toLowerCase();
}

function normalizeBoolean(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function classifyStageStatus(stage) {
  const outcomes = Object.values(stage.steps || {}).map(normalizeOutcome);
  if (outcomes.some((value) => value === 'failure')) return 'failure';
  if (outcomes.every((value) => value === 'skipped')) return 'skipped';
  if (outcomes.some((value) => value === 'success')) return 'success';
  return 'unknown';
}

function uniqueSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function getGitLogSince(runStartedAtUtc) {
  if (!runStartedAtUtc) return [];

  let output = '';
  try {
    output = execSync(
      `git -c core.quotePath=false log --since="${runStartedAtUtc}" --pretty=format:"__COMMIT__%n%H%x1f%s%x1f%aI" --name-only --no-merges`,
      { encoding: 'utf8' }
    );
  } catch {
    return [];
  }

  const lines = output.split(/\r?\n/);
  const commits = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line === '__COMMIT__') {
      if (current) commits.push(current);
      current = { sha: '', subject: '', authoredAt: '', files: [] };
      continue;
    }

    if (!current) continue;

    if (!current.sha && line.includes('\u001f')) {
      const [sha = '', subject = '', authoredAt = ''] = line.split('\u001f');
      current.sha = sha;
      current.subject = subject;
      current.authoredAt = authoredAt;
      continue;
    }

    if (line.includes('/') || line.endsWith('.md') || line.endsWith('.json') || line.endsWith('.js') || line.endsWith('.mjs') || line.endsWith('.ts')) {
      current.files.push(line);
    }
  }

  if (current) commits.push(current);
  return commits.filter((commit) => commit.sha);
}

function summarizeChanges(commits) {
  const allFiles = uniqueSorted(commits.flatMap((commit) => commit.files || []));

  const dataFiles = allFiles.filter((file) =>
    file.startsWith('public/data/') ||
    file === 'scripts/cleanup-expired.js' ||
    file === 'src/app/life/restaurant/data/restaurants.json'
  );

  const blogFiles = allFiles.filter((file) => file.startsWith('src/content/posts/') && file.endsWith('.md'));
  const lifeFiles = allFiles.filter((file) => file.startsWith('src/content/life/') && file.endsWith('.md'));

  return {
    totalChangedFiles: allFiles.length,
    dataChangedFiles: dataFiles,
    generatedBlogPosts: blogFiles,
    generatedLifePosts: lifeFiles,
    allChangedFiles: allFiles,
  };
}

function buildStagesFromEnv(env) {
  const stages = [
    {
      key: 'stage1-data',
      title: '1단계: 공공데이터 수집/만료처리',
      deployUrl: env.DEPLOY_STAGE1_URL || '',
      steps: {
        collectIncheon: normalizeOutcome(env.COLLECT_INCHEON_OUTCOME),
        collectSubsidy: normalizeOutcome(env.COLLECT_SUBSIDY_OUTCOME),
        collectFestival: normalizeOutcome(env.COLLECT_FESTIVAL_OUTCOME),
        cleanupExpired: normalizeOutcome(env.CLEANUP_EXPIRED_OUTCOME),
        build: normalizeOutcome(env.BUILD_STAGE1_OUTCOME),
        e2e: normalizeOutcome(env.E2E_STAGE1_OUTCOME),
        deploy: normalizeOutcome(env.DEPLOY_STAGE1_OUTCOME),
      },
      collectSummary: {
        incheon: env.COLLECT_INCHEON_SUMMARY || '',
        subsidy: env.COLLECT_SUBSIDY_SUMMARY || '',
        festival: env.COLLECT_FESTIVAL_SUMMARY || '',
      },
    },
    {
      key: 'stage2-blog',
      title: '2단계: AI 블로그 생성',
      deployUrl: env.DEPLOY_STAGE2_URL || '',
      steps: {
        generateBlog: normalizeOutcome(env.GENERATE_BLOG_OUTCOME),
        build: normalizeOutcome(env.BUILD_STAGE2_OUTCOME),
        e2e: normalizeOutcome(env.E2E_STAGE2_OUTCOME),
        deploy: normalizeOutcome(env.DEPLOY_STAGE2_OUTCOME),
      },
    },
    {
      key: 'stage3-life',
      title: '3단계: 일상의 즐거움 맛집',
      deployUrl: env.DEPLOY_STAGE3_URL || '',
      steps: {
        collectRestaurants: normalizeOutcome(env.COLLECT_RESTAURANTS_OUTCOME),
        generateRestaurantPosts: normalizeOutcome(env.GENERATE_RESTAURANT_POSTS_OUTCOME),
        build: normalizeOutcome(env.BUILD_STAGE3_OUTCOME),
        e2e: normalizeOutcome(env.E2E_STAGE3_OUTCOME),
        deploy: normalizeOutcome(env.DEPLOY_STAGE3_OUTCOME),
      },
    },
  ];

  return stages.map((stage) => ({
    ...stage,
    status: classifyStageStatus(stage),
  }));
}

function toMarkdown(report) {
  const stageStepLabelMap = {
    stage1: {
      collectIncheon: '인천 데이터 수집',
      collectSubsidy: '보조금 데이터 수집',
      collectFestival: '축제 데이터 수집',
      cleanupExpired: '만료 콘텐츠 처리',
      build: '빌드',
      e2e: 'E2E 테스트',
      deploy: '배포',
    },
    stage2: {
      generateBlog: 'AI 블로그 생성',
      build: '빌드',
      e2e: 'E2E 테스트',
      deploy: '배포',
    },
    stage3: {
      collectRestaurants: '맛집 데이터 수집',
      generateRestaurantPosts: '맛집 포스트 생성',
      build: '빌드',
      e2e: 'E2E 테스트',
      deploy: '배포',
    },
  };

  const stage1 = report.stages.find((s) => s.key === 'stage1-data');
  const stage2 = report.stages.find((s) => s.key === 'stage2-blog');
  const stage3 = report.stages.find((s) => s.key === 'stage3-life');
  const dataValidation = report.dataValidation || {};

  const stageRows = report.stages.map((stage) => {
    const deployUrl = stage.deployUrl || '-';
    return `| ${stage.title} | ${statusEmoji(stage.status)} ${toKoreanStatus(stage.status)} | ${deployUrl} |`;
  });

  const deploymentUrls = report.stages
    .map((stage) => stage.deployUrl)
    .filter(Boolean);

  const latestDeployUrl = deploymentUrls.length > 0 ? deploymentUrls[deploymentUrls.length - 1] : '';

  const lines = [];
  lines.push(`# 📘 Daily Update Report — ${report.reportDateKst}`);
  lines.push('');
  lines.push(`- 워크플로우: ${report.workflow.name}`);
  lines.push(`- 실행 번호: #${report.workflow.runNumber} (시도 ${report.workflow.runAttempt})`);
  lines.push(`- 실행 타입: ${report.workflow.eventName}`);
  lines.push(`- 생성 시각(UTC): ${report.generatedAtUtc}`);
  lines.push(`- 실행 링크: ${report.workflow.runUrl}`);
  lines.push('');

  lines.push('## ✨ 핵심 요약');
  lines.push('');
  lines.push('| 항목 | 값 |');
  lines.push('|---|---|');
  lines.push(`| 단계 성공 수 | ${report.stages.filter((stage) => stage.status === 'success').length} / ${report.stages.length} |`);
  lines.push(`| 생성된 블로그 글 | ${report.changes.generatedBlogPosts.length}건 |`);
  lines.push(`| 생성된 맛집 글 | ${report.changes.generatedLifePosts.length}건 |`);
  lines.push(`| 총 변경 파일 | ${report.changes.totalChangedFiles}개 |`);
  lines.push(`| 맛집 후보 재수집 | ${report.restaurantCache?.recollectPerformed ? '실행' : '생략'} |`);
  lines.push(`| 맛집 캐시(hit/miss/called) | ${Number(report.restaurantCache?.cacheHit || 0)} / ${Number(report.restaurantCache?.cacheMiss || 0)} / ${Number(report.restaurantCache?.googleCalled || 0)} |`);
  lines.push(`| 최종 배포 URL | ${latestDeployUrl || '-'} |`);
  if (report.imagePolicy) {
    lines.push(`| 축제 중간 이미지(삽입/생략) | ${Number(report.imagePolicy.midImageInsertedCount || 0)} / ${Number(report.imagePolicy.midImageOmittedCount || 0)} |`);
  }
  if (report.dataValidation) {
    const validationSegments = [];
    if (report.dataValidation.incheon?.validation) validationSegments.push(`인천: ${report.dataValidation.incheon.validation}`);
    if (report.dataValidation.subsidy?.validation) validationSegments.push(`보조금: ${report.dataValidation.subsidy.validation}`);
    if (report.dataValidation.festival?.validation) validationSegments.push(`축제: ${report.dataValidation.festival.validation}`);
    if (validationSegments.length > 0) {
      lines.push(`| 데이터 검증 | ${validationSegments.join(' | ')} |`);
    }
    const usageSegments = [];
    if (report.dataValidation.incheon?.anthropicUsage) usageSegments.push(`인천 ${report.dataValidation.incheon.anthropicUsage}`);
    if (report.dataValidation.subsidy?.anthropicUsage) usageSegments.push(`보조금 ${report.dataValidation.subsidy.anthropicUsage}`);
    if (report.dataValidation.festival?.anthropicUsage) usageSegments.push(`축제 ${report.dataValidation.festival.anthropicUsage}`);
    if (usageSegments.length > 0) {
      lines.push(`| Anthropic 사용량 | ${usageSegments.join(' | ')} |`);
    }
  }
  if (report.budget?.enabled) {
    lines.push(`| 블로그 예산 가드 | ${report.budget.stopped ? '중단됨' : '정상'} |`);
    lines.push(`| 블로그 비용(추정) | ${Number(report.budget.estimatedCostKrw || 0).toFixed(2)}원 / ${Number(report.budget.limitKrw || 0).toFixed(0)}원 |`);
  }
  lines.push('');

  if (report.budget?.enabled) {
    lines.push('## 💸 블로그 예산 가드 상태');
    lines.push('');
    lines.push('| 항목 | 값 |');
    lines.push('|---|---|');
    lines.push(`| 상태 | ${report.budget.stopped ? '⛔ 중단됨' : '✅ 정상'} |`);
    lines.push(`| 일일 한도 | ${Number(report.budget.limitKrw || 0).toFixed(0)}원 |`);
    lines.push(`| 추정 비용 | ${Number(report.budget.estimatedCostKrw || 0).toFixed(2)}원 |`);
    lines.push(`| 중단 사유 | ${report.budget.stopReason || '-'} |`);
    lines.push('');
  }

  lines.push('## 🧭 단계별 실행 결과');
  lines.push('');
  lines.push('| 단계 | 상태 | 배포 URL |');
  lines.push('|---|---|---|');
  lines.push(...stageRows);
  lines.push('');

  lines.push('## 🔍 단계 세부 결과');
  lines.push('');

  if (stage1) {
    lines.push(`### ${statusEmoji(stage1.status)} ${stage1.title}`);
    lines.push('');
    lines.push('| 실행 항목 | 결과 |');
    lines.push('|---|---|');
    for (const [key, value] of Object.entries(stage1.steps)) {
      const label = stageStepLabelMap.stage1[key] || key;
      lines.push(`| ${label} | ${statusEmoji(value)} ${toKoreanStatus(value)} |`);
    }
    lines.push('');
  }

  if (stage2) {
    lines.push(`### ${statusEmoji(stage2.status)} ${stage2.title}`);
    lines.push('');
    lines.push('| 실행 항목 | 결과 |');
    lines.push('|---|---|');
    for (const [key, value] of Object.entries(stage2.steps)) {
      const label = stageStepLabelMap.stage2[key] || key;
      lines.push(`| ${label} | ${statusEmoji(value)} ${toKoreanStatus(value)} |`);
    }
    lines.push('');
  }

  if (stage3) {
    lines.push(`### ${statusEmoji(stage3.status)} ${stage3.title}`);
    lines.push('');
    lines.push('| 실행 항목 | 결과 |');
    lines.push('|---|---|');
    for (const [key, value] of Object.entries(stage3.steps)) {
      const label = stageStepLabelMap.stage3[key] || key;
      lines.push(`| ${label} | ${statusEmoji(value)} ${toKoreanStatus(value)} |`);
    }
    lines.push('');
  }

  lines.push('## 🧾 자동 커밋 요약');
  lines.push('');
  if (report.commits.length === 0) {
    lines.push('- 이번 실행에서 감지된 신규 커밋이 없습니다.');
  } else {
    lines.push('| 커밋 | 메시지 | 변경 파일 수 |');
    lines.push('|---|---|---:|');
    for (const commit of report.commits) {
      lines.push(`| ${commit.sha.slice(0, 7)} | ${commit.subject} | ${commit.files.length} |`);
    }
  }
  lines.push('');

  lines.push('## 📂 업데이트된 파일 분류');
  lines.push('');
  lines.push('| 분류 | 개수 |');
  lines.push('|---|---:|');
  lines.push(`| 총 변경 파일 | ${report.changes.totalChangedFiles} |`);
  lines.push(`| 데이터 파일 | ${report.changes.dataChangedFiles.length} |`);
  lines.push(`| 블로그 생성 파일 | ${report.changes.generatedBlogPosts.length} |`);
  lines.push(`| 맛집 생성 파일 | ${report.changes.generatedLifePosts.length} |`);
  lines.push('');

  if (report.changes.generatedBlogPosts.length > 0) {
    lines.push('### 생성된 블로그 파일');
    lines.push('');
    report.changes.generatedBlogPosts.forEach((file) => lines.push(`- ${file}`));
    lines.push('');
  }

  if (report.changes.generatedLifePosts.length > 0) {
    lines.push('### 생성된 맛집 파일');
    lines.push('');
    report.changes.generatedLifePosts.forEach((file) => lines.push(`- ${file}`));
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

async function updateIndex(indexPath, report) {
  let index = { reports: [] };
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    index = safeJsonParse(raw, index);
  } catch {
    // ignore if not exists
  }

  const compact = {
    date: report.reportDateKst,
    runId: report.workflow.runId,
    runNumber: report.workflow.runNumber,
    runAttempt: report.workflow.runAttempt,
    eventName: report.workflow.eventName,
    runUrl: report.workflow.runUrl,
    stageStatuses: report.stages.map((stage) => ({ key: stage.key, status: stage.status })),
    generatedBlogCount: report.changes.generatedBlogPosts.length,
    generatedLifeCount: report.changes.generatedLifePosts.length,
    restaurantRecollectPerformed: !!report.restaurantCache?.recollectPerformed,
    restaurantCacheHit: Number(report.restaurantCache?.cacheHit || 0),
    restaurantCacheMiss: Number(report.restaurantCache?.cacheMiss || 0),
    restaurantGoogleCalled: Number(report.restaurantCache?.googleCalled || 0),
    totalChangedFiles: report.changes.totalChangedFiles,
    blogBudgetEnabled: !!report.budget?.enabled,
    blogBudgetStopped: !!report.budget?.stopped,
    blogBudgetLimitKrw: Number(report.budget?.limitKrw || 0),
    blogEstimatedCostKrw: Number(report.budget?.estimatedCostKrw || 0),
    midImageInsertedCount: Number(report.imagePolicy?.midImageInsertedCount || 0),
    midImageOmittedCount: Number(report.imagePolicy?.midImageOmittedCount || 0),
    generatedAtUtc: report.generatedAtUtc,
  };

  index.reports = Array.isArray(index.reports) ? index.reports : [];
  index.reports = [
    compact,
    ...index.reports.filter((item) => !(item.date === compact.date && item.runId === compact.runId)),
  ].slice(0, 90);

  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const reportDateKst = process.env.REPORT_DATE_KST || argValue('date') || nowIso().slice(0, 10);
  const runStartedAtUtc = process.env.RUN_STARTED_AT_UTC || argValue('started-at');

  const outputDir = path.join(process.cwd(), 'runs', 'daily');
  const jsonPath = path.join(outputDir, `${reportDateKst}.json`);
  const mdPath = path.join(outputDir, `${reportDateKst}.md`);
  const indexPath = path.join(outputDir, 'index.json');

  const commits = getGitLogSince(runStartedAtUtc);
  const changes = summarizeChanges(commits);
  const stages = buildStagesFromEnv(process.env);

  const runId = String(process.env.GITHUB_RUN_ID || '');
  const runNumber = Number(process.env.GITHUB_RUN_NUMBER || 0);
  const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT || 0);
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const repository = process.env.GITHUB_REPOSITORY || '';
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';

  const report = {
    reportDateKst,
    generatedAtUtc: nowIso(),
    workflow: {
      name: 'Daily Update & Deploy',
      repository,
      runId,
      runNumber,
      runAttempt,
      eventName,
      runUrl: runId && repository ? `${serverUrl}/${repository}/actions/runs/${runId}` : '',
      runStartedAtUtc,
      headSha: process.env.GITHUB_SHA || '',
    },
    stages,
    commits,
    changes,
    budget: {
      enabled: normalizeBoolean(process.env.BLOG_BUDGET_ENABLED),
      limitKrw: Number(process.env.BLOG_BUDGET_LIMIT_KRW || 0),
      estimatedCostKrw: Number(process.env.BLOG_ESTIMATED_COST_KRW || 0),
      stopped: normalizeBoolean(process.env.BLOG_BUDGET_STOPPED),
      stopReason: process.env.BLOG_BUDGET_STOP_REASON || '',
    },
    imagePolicy: {
      midImageInsertedCount: Number(process.env.MID_IMAGE_INSERTED_COUNT || 0),
      midImageOmittedCount: Number(process.env.MID_IMAGE_OMITTED_COUNT || 0),
    },
    restaurantCache: {
      recollectPerformed: normalizeBoolean(process.env.RESTAURANT_RECOLLECT_PERFORMED),
      cacheHit: Number(process.env.RESTAURANT_CACHE_HIT || 0),
      cacheMiss: Number(process.env.RESTAURANT_CACHE_MISS || 0),
      googleCalled: Number(process.env.RESTAURANT_GOOGLE_CALLED || 0),
    },
    dataValidation: {
      incheon: {
        summary: process.env.COLLECT_INCHEON_SUMMARY || '',
        validation: process.env.COLLECT_INCHEON_VALIDATION || '',
        anthropicUsage: process.env.COLLECT_INCHEON_ANTHROPIC_USAGE || '',
      },
      subsidy: {
        summary: process.env.COLLECT_SUBSIDY_SUMMARY || '',
        validation: process.env.COLLECT_SUBSIDY_VALIDATION || '',
        anthropicUsage: process.env.COLLECT_SUBSIDY_ANTHROPIC_USAGE || '',
      },
      festival: {
        summary: process.env.COLLECT_FESTIVAL_SUMMARY || '',
        validation: process.env.COLLECT_FESTIVAL_VALIDATION || '',
        anthropicUsage: process.env.COLLECT_FESTIVAL_ANTHROPIC_USAGE || '',
      },
    },
  };

  if (dryRun) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(mdPath, toMarkdown(report), 'utf8');
  await updateIndex(indexPath, report);

  console.log(`일일 리포트 생성 완료: ${jsonPath}`);
  console.log(`일일 리포트(MD) 생성 완료: ${mdPath}`);
}

main().catch((error) => {
  console.error('[write-daily-report] 실패:', error?.message || error);
  process.exit(1);
});
