#!/usr/bin/env node
/**
 * notify-telegram.mjs
 * GitHub Actions 일일 자동화 완료 후 Telegram으로 결과를 전송합니다.
 * 환경변수:
 *   TELEGRAM_BOT_TOKEN  — 텔레그램 봇 토큰 (GitHub Secret)
 *   TELEGRAM_CHAT_ID    — 수신 채팅/채널 ID (GitHub Secret)
 *   REPORT_DATE_KST     — 리포트 날짜 (YYYY-MM-DD)
 *   GITHUB_SERVER_URL   — GitHub 서버 URL
 *   GITHUB_REPOSITORY   — owner/repo
 *   GITHUB_RUN_ID       — Actions run ID
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const REPORT_DATE = process.env.REPORT_DATE_KST;
const GITHUB_SERVER_URL = process.env.GITHUB_SERVER_URL || 'https://github.com';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || '';
const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID || '';

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('[notify-telegram] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다. 건너뜁니다.');
  process.exit(0);
}

async function loadReport() {
  if (!REPORT_DATE) return null;
  try {
    const reportPath = join(process.cwd(), 'runs', 'daily', `${REPORT_DATE}.json`);
    const raw = await readFile(reportPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stripQuotes(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function normalizeBlogCategory(categoryRaw, filePath) {
  const category = String(categoryRaw || '').trim();
  const lowerCategory = category.toLowerCase();
  const lowerPath = String(filePath || '').toLowerCase();

  if (category.includes('인천') || lowerCategory.includes('incheon') || lowerPath.includes('incheon')) {
    return 'incheon';
  }
  if (category.includes('보조금') || category.includes('복지') || lowerCategory.includes('subsidy') || lowerPath.includes('subsidy')) {
    return 'subsidy';
  }
  if (category.includes('축제') || category.includes('여행') || lowerCategory.includes('festival') || lowerPath.includes('festival')) {
    return 'festival';
  }
  return 'other';
}

async function readPostMeta(filePath) {
  try {
    const raw = await readFile(join(process.cwd(), filePath), 'utf8');
    const titleMatch = raw.match(/^title:\s*(.+)$/m);
    const categoryMatch = raw.match(/^category:\s*(.+)$/m);

    const title = titleMatch ? stripQuotes(titleMatch[1]) : '';
    const categoryKey = normalizeBlogCategory(categoryMatch ? stripQuotes(categoryMatch[1]) : '', filePath);

    return { title, categoryKey };
  } catch {
    return { title: '', categoryKey: 'other' };
  }
}

function formatFailedStages(stages) {
  return (stages || [])
    .filter((stage) => stage.status === 'failure')
    .map((stage) => {
      const failedStepKeys = Object.entries(stage.steps || {})
        .filter(([, outcome]) => String(outcome || '').toLowerCase() === 'failure')
        .map(([stepKey]) => stepKey);
      if (failedStepKeys.length === 0) return `  • ${stage.title}`;
      return `  • ${stage.title} (${failedStepKeys.join(', ')})`;
    })
    .join('\n');
}

async function buildMessage(report) {
  const runUrl = GITHUB_RUN_ID && GITHUB_REPOSITORY
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : null;
  const adminUrl = 'https://pick-n-joy.com/admin/runs/';

  if (!report) {
    const lines = [
      `📊 *픽앤조이 일일 자동화* (${REPORT_DATE || '날짜 불명'})`,
      '',
      '⚠️ 리포트 파일을 읽지 못했습니다.',
      '',
      runUrl ? `🔗 [Actions 로그](${runUrl})` : '',
    ];
    return lines.filter((l) => l !== null).join('\n');
  }

  const hasFailed = report.stages?.some((s) => s.status === 'failure');
  const generatedBlogPosts = report.changes?.generatedBlogPosts || [];
  const generatedChoicePosts = report.changes?.generatedChoicePosts || [];
  const generatedRestaurantPosts = report.changes?.generatedRestaurantPosts || report.changes?.generatedLifePosts || [];
  const generatedLifePosts = report.changes?.generatedLifePosts || [];
  const blogCount = generatedBlogPosts.length;
  const choiceCount = generatedChoicePosts.length;
  const lifeCount = generatedRestaurantPosts.length;
  const totalFiles = report.changes?.totalChangedFiles ?? 0;
  const budget = report.budget;
  const imagePolicy = report.imagePolicy || {};
  const restaurantCache = report.restaurantCache || {};
  const recollectPerformed = !!restaurantCache.recollectPerformed;
  const midImageInsertedCount = Number(imagePolicy.midImageInsertedCount || 0);
  const midImageOmittedCount = Number(imagePolicy.midImageOmittedCount || 0);
  const cacheHit = Number(restaurantCache.cacheHit || 0);
  const cacheMiss = Number(restaurantCache.cacheMiss || 0);
  const googleCalled = Number(restaurantCache.googleCalled || 0);
  const choiceFallback = report.choiceFallback || {};
  const relaxedFallbackCount = Number(choiceFallback.relaxedAppliedCount || 0);
  const appliedMinRating = Number(choiceFallback.appliedMinRating || 0);

  const statusIcon = hasFailed ? '⚠️' : '✅';
  const statusText = hasFailed ? '일부 단계 실패' : '전체 정상 완료';
  const failedStages = formatFailedStages(report.stages || []);

  // 1단계 데이터 수집 결과 추출
  const stage1 = report.stages?.find((s) => s.key === 'stage1-data');
  const stage1Steps = stage1?.steps || {};
  const collectSummary = stage1?.collectSummary || {};
  const incheonPhotoApi = report.dataValidation?.incheon?.photoApi || {};

  const blogMetas = await Promise.all(generatedBlogPosts.map((file) => readPostMeta(file)));
  const blogTitles = blogMetas.map((meta) => meta.title);
  const choiceTitles = await Promise.all(generatedChoicePosts.map((file) => readPostMeta(file).then((meta) => meta.title)));
  const lifeTitles = await Promise.all(generatedRestaurantPosts.map((file) => readPostMeta(file).then((meta) => meta.title)));

  const incheonBlogTitles = blogMetas.filter((meta) => meta.categoryKey === 'incheon').map((meta) => meta.title).filter(Boolean);
  const subsidyBlogTitles = blogMetas.filter((meta) => meta.categoryKey === 'subsidy').map((meta) => meta.title).filter(Boolean);
  const festivalBlogTitles = blogMetas.filter((meta) => meta.categoryKey === 'festival').map((meta) => meta.title).filter(Boolean);
  const otherBlogTitles = blogMetas.filter((meta) => meta.categoryKey === 'other').map((meta) => meta.title).filter(Boolean);

  let budgetLine = '';
  if (budget?.enabled) {
    const cost = Number(budget.estimatedCostKrw || 0).toFixed(1);
    const limit = Number(budget.limitKrw || 0).toFixed(0);
    budgetLine = budget.stopped
      ? `⛔ Gemini 예산 초과 중단: ${cost}원 / ${limit}원`
      : `💰 Gemini 비용: ${cost}원 / ${limit}원`;
  }

  // 데이터 수집 결과 한 줄 포맷
  function stepIcon(outcome) {
    if (outcome === 'success') return '✅';
    if (outcome === 'failure') return '❌';
    if (outcome === 'cancelled') return '🚫';
    return '⏭️'; // skipped
  }

  const dataCollectionLine = stage1
    ? `📡 데이터 수집: 인천 ${stepIcon(stage1Steps.collectIncheon)} 보조금 ${stepIcon(stage1Steps.collectSubsidy)} 축제 ${stepIcon(stage1Steps.collectFestival)} 만료처리 ${stepIcon(stage1Steps.cleanupExpired)}`
    : '';

  // 수집 건수 상세
  const summaryParts = [];
  if (collectSummary.incheon) summaryParts.push(`인천: ${collectSummary.incheon}`);
  if (collectSummary.subsidy) summaryParts.push(`보조금: ${collectSummary.subsidy}`);
  if (collectSummary.festival) summaryParts.push(`축제: ${collectSummary.festival}`);
  const collectDetailLine = summaryParts.length > 0
    ? `📋 수집 결과: ${summaryParts.join(' | ')}`
    : '';

  const dataChangedFiles = report.changes?.dataChangedFiles || [];
  const dataChangeLine = dataChangedFiles.length > 0
    ? `📂 데이터 변경: ${dataChangedFiles.map((f) => f.split('/').pop()).join(', ')}`
    : '';
  const incheonPhotoMode = String(incheonPhotoApi.mode || '').trim();
  const incheonPhotoHealthcheck = String(incheonPhotoApi.healthcheck || '').trim();
  const incheonPhotoFailureReason = String(incheonPhotoApi.failureReason || '').trim();
  const incheonPhotoLine = incheonPhotoHealthcheck
    ? `📸 인천 사진 API: mode=${incheonPhotoMode || '-'} / health=${incheonPhotoHealthcheck}`
    : '';
  const incheonPhotoFailureLine = incheonPhotoFailureReason
    ? `⚠️ 인천 사진 API 원인: ${incheonPhotoFailureReason}`
    : '';
  const markdownStats = report.dataValidation || {};
  const markdownLine = `🧩 상세 markdown(생성/대기): 인천 ${Number(markdownStats.incheon?.markdown?.generated || 0)}/${Number(markdownStats.incheon?.markdown?.pending || 0)} | 보조금 ${Number(markdownStats.subsidy?.markdown?.generated || 0)}/${Number(markdownStats.subsidy?.markdown?.pending || 0)} | 축제 ${Number(markdownStats.festival?.markdown?.generated || 0)}/${Number(markdownStats.festival?.markdown?.pending || 0)}`;

  const lines = [
    `📊 *픽앤조이 자동화 리포트* (${REPORT_DATE})`,
    '',
    `${statusIcon} *${statusText}*`,
    '',
    dataCollectionLine,
    collectDetailLine,
    dataChangeLine,
    markdownLine,
    incheonPhotoLine,
    incheonPhotoFailureLine,
    `📝 블로그 생성: ${blogCount}건`,
    `  └ 인천 ${incheonBlogTitles.length}건 | 보조금 ${subsidyBlogTitles.length}건 | 축제 ${festivalBlogTitles.length}건${otherBlogTitles.length > 0 ? ` | 기타 ${otherBlogTitles.length}건` : ''}`,
    `🛍️ 초이스 포스트: ${choiceCount}건`,
    `🍽️ 맛집 포스트: ${lifeCount}건`,
    `📁 변경 파일: ${totalFiles}개`,
    `♻️ 맛집 후보 재수집: ${recollectPerformed ? '실행' : '생략'}`,
    `🖼️ 축제 중간 이미지: 삽입 ${midImageInsertedCount}건 / 생략 ${midImageOmittedCount}건`,
    `🗄️ 맛집 캐시: hit ${cacheHit} / miss ${cacheMiss} / google ${googleCalled}`,
    `🎯 초이스 fallback 완화: ${relaxedFallbackCount}회${appliedMinRating > 0 ? ` (적용 하한 ${appliedMinRating.toFixed(1)})` : ''}`,
    budgetLine,
  ];

  if (incheonBlogTitles.length > 0) {
    lines.push('');
    lines.push('*인천 블로그:*');
    incheonBlogTitles.forEach((title) => lines.push(`  • ${title}`));
  }

  if (subsidyBlogTitles.length > 0) {
    lines.push('');
    lines.push('*전국보조금 블로그:*');
    subsidyBlogTitles.forEach((title) => lines.push(`  • ${title}`));
  }

  if (festivalBlogTitles.length > 0) {
    lines.push('');
    lines.push('*전국축제 블로그:*');
    festivalBlogTitles.forEach((title) => lines.push(`  • ${title}`));
  }

  if (choiceTitles.filter(Boolean).length > 0) {
    lines.push('');
    lines.push('*생성된 초이스 제목:*');
    choiceTitles.filter(Boolean).forEach((title) => lines.push(`  • ${title}`));
  }

  if (lifeTitles.filter(Boolean).length > 0) {
    lines.push('');
    lines.push('*생성된 맛집 제목:*');
    lifeTitles.filter(Boolean).forEach((title) => lines.push(`  • ${title}`));
  }

  lines.push('');
  if (hasFailed && failedStages) {
    lines.push(`*실패 단계:*\n${failedStages}`);
    lines.push('');
  }

  lines.push(`🔗 [Admin 대시보드](${adminUrl})`);
  if (runUrl) lines.push(`🔗 [Actions 로그](${runUrl})`);

  return lines.filter((l) => l !== '' && l !== null && l !== undefined).join('\n');
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id: CHAT_ID,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const json = await res.json();
  if (!json.ok) {
    console.error('[notify-telegram] Telegram API 오류:', JSON.stringify(json));
    process.exit(1);
  }
  console.log('[notify-telegram] 전송 완료 ✅ message_id:', json.result?.message_id);
}

const report = await loadReport();
const message = await buildMessage(report);
console.log('[notify-telegram] 전송 메시지:\n', message);
await sendTelegram(message);
