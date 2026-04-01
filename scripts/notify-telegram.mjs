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

async function readPostTitle(filePath) {
  try {
    const raw = await readFile(join(process.cwd(), filePath), 'utf8');
    const m = raw.match(/^title:\s*(.+)$/m);
    if (!m) return '';
    return stripQuotes(m[1]);
  } catch {
    return '';
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
  const generatedLifePosts = report.changes?.generatedLifePosts || [];
  const blogCount = generatedBlogPosts.length;
  const lifeCount = generatedLifePosts.length;
  const totalFiles = report.changes?.totalChangedFiles ?? 0;
  const budget = report.budget;

  const statusIcon = hasFailed ? '⚠️' : '✅';
  const statusText = hasFailed ? '일부 단계 실패' : '전체 정상 완료';
  const failedStages = formatFailedStages(report.stages || []);

  const blogTitles = await Promise.all(generatedBlogPosts.map((file) => readPostTitle(file)));
  const lifeTitles = await Promise.all(generatedLifePosts.map((file) => readPostTitle(file)));

  let budgetLine = '';
  if (budget?.enabled) {
    const cost = Number(budget.estimatedCostKrw || 0).toFixed(1);
    const limit = Number(budget.limitKrw || 0).toFixed(0);
    budgetLine = budget.stopped
      ? `⛔ Gemini 예산 초과 중단: ${cost}원 / ${limit}원`
      : `💰 Gemini 비용: ${cost}원 / ${limit}원`;
  }

  const lines = [
    `📊 *픽앤조이 자동화 리포트* (${REPORT_DATE})`,
    '',
    `${statusIcon} *${statusText}*`,
    '',
    `📝 블로그 생성: ${blogCount}건`,
    `🍽️ 맛집 포스트: ${lifeCount}건`,
    `📁 변경 파일: ${totalFiles}개`,
    budgetLine,
  ];

  if (blogTitles.filter(Boolean).length > 0) {
    lines.push('');
    lines.push('*생성된 블로그 제목:*');
    blogTitles.filter(Boolean).forEach((title) => lines.push(`  • ${title}`));
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
