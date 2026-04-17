const fs = require('fs/promises');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 120000);
const requestedGeminiModel = process.env.GEMINI_MODEL || '';
if (/\bpro\b/i.test(requestedGeminiModel)) {
  throw new Error('안전장치: 수집 스크립트는 Pro 모델을 사용하지 않습니다. gemini-2.5-flash-lite만 허용됩니다.');
}
if (requestedGeminiModel && requestedGeminiModel !== GEMINI_MODEL) {
  console.warn(`GEMINI_MODEL 오버라이드(${requestedGeminiModel}) 무시: ${GEMINI_MODEL} 고정 사용`);
}

function sourceHash(item) {
  return [
    item['서비스명'] || item.name || item.title || '',
    item['서비스목적요약'] || item.summary || item.description || '',
    item['지원내용'] || '',
    item['지원대상'] || item.target || '',
    item['신청방법'] || '',
    item['신청기한'] || item.endDate || '',
    item['지원유형'] || '',
  ].join('||');
}

function validateFetchedData(sourceName, existingCount, fetchedCount) {
  if (fetchedCount === 0 && existingCount > 0) {
    return `warning: ${sourceName} API 조회 결과가 0건입니다. 데이터 존재 여부를 확인하세요.`;
  }
  if (existingCount > 0 && fetchedCount < Math.max(1, Math.floor(existingCount * 0.5))) {
    return `warning: ${sourceName} API 조회 결과가 기존 데이터(${existingCount}건)의 절반 미만입니다.`;
  }
  return 'ok';
}

function parseDateCandidates(text) {
  const src = String(text || '');
  const matches = [...src.matchAll(/(\d{4})[.-](\d{2})[.-](\d{2})/g)];
  if (matches.length === 0) return [];
  return matches
    .map((m) => `${m[1]}-${m[2]}-${m[3]}`)
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
}

function extractEndDateFromSubsidyItem(item) {
  const fields = [
    item['신청기한'],
    item['신청기간'],
    item['접수기간'],
    item['지원내용'],
    item['지원대상'],
    item['선정기준'],
  ];
  const dates = fields.flatMap(parseDateCandidates).sort();
  if (dates.length === 0) return null;
  return dates[dates.length - 1];
}

async function fetchSubsidyPages(apiKey, { perPage = 100, maxPages = 80 } = {}) {
  const all = [];
  let totalCount = 0;

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
      returnType: 'JSON',
    });

    const endpoint = `https://api.odcloud.kr/api/gov24/v3/serviceList?${params.toString()}`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Infuser ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`subsidy page ${page} fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const pageItems = data.data || data.items || [];
    const list = Array.isArray(pageItems) ? pageItems : [];
    all.push(...list);

    totalCount = Number(data.totalCount || totalCount || 0);
    const currentCount = Number(data.currentCount || list.length);
    if (currentCount === 0) break;
    if (totalCount > 0 && all.length >= totalCount) break;
  }

  return { items: all, totalCount };
}

async function generateSubsidyMarkdown(item) {
  if (!GEMINI_API_KEY) return { markdown: '', usage: { input_tokens: 0, output_tokens: 0 } };
  const prompt = `아래 보조금/복지 정책 정보를 블로그처럼 읽기 쉬운 한국어 Markdown으로 재작성해줘.

[요구사항]
- 첫 줄은 훅: ## ...
- 다음 구조 포함:
  ### 💡 어떤 혜택인가요?
  ### 👥 지원 대상
  ### 📝 신청 방법
  ### 📌 한눈에 보는 신청 정보
- 사실만 사용, 과장 금지
- 500~900자
- 출력은 Markdown 본문만

[데이터]
${JSON.stringify(item, null, 2)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          maxOutputTokens: 1200,
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0] || {};
  const markdown = (candidate?.content?.parts?.[0]?.text || '').trim();
  const usageMeta = data?.usageMetadata || {};

  return {
    markdown,
    usage: {
      input_tokens: Number(usageMeta.promptTokenCount || usageMeta.inputTokenCount || 0),
      output_tokens: Number(usageMeta.candidatesTokenCount || usageMeta.outputTokenCount || 0),
    },
  };
}

async function run() {
  const PUBLIC_DATA_API_KEY = process.env.PUBLIC_DATA_API_KEY;
  const DESCRIPTION_MARKDOWN_BATCH_LIMIT = Math.max(0, Number.parseInt(process.env.DESCRIPTION_MARKDOWN_BATCH_LIMIT || '10', 10));
  const DESCRIPTION_MARKDOWN_MIN_BATCH_LIMIT = Math.max(1, Number.parseInt(process.env.DESCRIPTION_MARKDOWN_MIN_BATCH_LIMIT || '5', 10));
  const DESCRIPTION_MARKDOWN_ADAPTIVE_ENABLED = String(process.env.DESCRIPTION_MARKDOWN_ADAPTIVE_ENABLED || 'true').toLowerCase() !== 'false';
  const DESCRIPTION_MARKDOWN_FAIL_THRESHOLD_PCT = Math.min(100, Math.max(1, Number.parseInt(process.env.DESCRIPTION_MARKDOWN_FAIL_THRESHOLD_PCT || '40', 10)));
  const DESCRIPTION_MARKDOWN_DELAY_MS = Math.max(0, Number.parseInt(process.env.DESCRIPTION_MARKDOWN_DELAY_MS || '80', 10));
  const SUBSIDY_WINDOW_MONTHS = Math.max(6, Number.parseInt(process.env.SUBSIDY_WINDOW_MONTHS || '12', 10));
  if (!PUBLIC_DATA_API_KEY) {
    console.error("Missing PUBLIC_DATA_API_KEY in process.env");
    return;
  }

  let items = [];
  try {
    const fetched = await fetchSubsidyPages(PUBLIC_DATA_API_KEY, { perPage: 100, maxPages: 80 });
    items = fetched.items;
    console.log(`보조금 원천 데이터 수집: totalCount=${fetched.totalCount || '-'}, collected=${items.length}`);
  } catch (err) {
    console.error("Error fetching subsidy data:", err);
    return;
  }

  // 인천 소관기관 제외
  const onlyNational = items.filter(item => {
    const org = item['소관기관명'] || '';
    return !org.includes('인천');
  });

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const windowEnd = new Date(today.getFullYear(), today.getMonth() + SUBSIDY_WINDOW_MONTHS, today.getDate());
  const windowEndStr = windowEnd.toISOString().split('T')[0];

  const filtered = onlyNational.filter((item) => {
    const endDate = extractEndDateFromSubsidyItem(item);
    if (!endDate) return true;
    return endDate >= todayStr && endDate <= windowEndStr;
  });

  const dataPath = path.join(process.cwd(), 'public', 'data', 'subsidy.json');

  // 기존 데이터 로드
  let existing = [];
  try {
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    existing = JSON.parse(fileContent);
  } catch (_) {}

  const validationStatus = validateFetchedData('전국 보조금·복지 정책', existing.length, filtered.length);

  // active window 기준으로 재구성 (지난 데이터는 파일에서 제거)
  const existingByKey = new Map(
    existing.map((item) => [
      String(item['서비스ID'] || item.id || item['서비스명'] || item.name),
      item,
    ])
  );

  const merged = [];
  let newItemsCount = 0;
  for (const item of filtered) {
    const key = String(item['서비스ID'] || item.id || item['서비스명'] || item.name || '');
    if (!key) continue;
    const prev = existingByKey.get(key);
    if (!prev) newItemsCount++;

    merged.push({
      ...(prev || {}),
      ...item,
      endDate: extractEndDateFromSubsidyItem(item) || prev?.endDate || null,
      expired: false,
      collectedAt: todayStr,
    });
  }

  let markdownGenerated = 0;
  let markdownAttempted = 0;
  let markdownFailed = 0;
  let markdownPending = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  if (!GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY 없음: description_markdown 생성 건너뜀');
  } else {
    const markdownTargets = merged.filter((item) => {
      const hash = sourceHash(item);
      return !(item.description_markdown && item.description_markdown_source_hash === hash);
    });
    const requestedLimit = DESCRIPTION_MARKDOWN_BATCH_LIMIT;
    const minLimit = Math.min(DESCRIPTION_MARKDOWN_MIN_BATCH_LIMIT, requestedLimit || DESCRIPTION_MARKDOWN_MIN_BATCH_LIMIT);
    let effectiveLimit = Math.min(markdownTargets.length, requestedLimit);
    console.log(`description_markdown 배치 처리: 최대 ${effectiveLimit}건 (최소 ${minLimit}건, adaptive=${DESCRIPTION_MARKDOWN_ADAPTIVE_ENABLED ? 'on' : 'off'}) / 전체 대기 ${markdownTargets.length}건`);

    for (const item of markdownTargets.slice(0, effectiveLimit)) {
      const hash = sourceHash(item);
      markdownAttempted++;

      try {
        const { markdown, usage } = await generateSubsidyMarkdown(item);
        if (markdown) {
          item.description_markdown = markdown;
          item.description_markdown_source_hash = hash;
          item.description_markdown_model = GEMINI_MODEL;
          item.description_markdown_updated_at = new Date().toISOString().split('T')[0];
          markdownGenerated++;
          inputTokens += usage.input_tokens;
          outputTokens += usage.output_tokens;
        }
      } catch {
        markdownFailed++;
        console.error(`description_markdown 생성 실패: ${item['서비스명'] || item.name || item.title || item['서비스ID'] || item.id}`);
      }

      if (DESCRIPTION_MARKDOWN_DELAY_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, DESCRIPTION_MARKDOWN_DELAY_MS));
      }

      // 실패율이 높으면 한 번 실행에서 처리 건수를 10 -> 5 수준으로 자동 하향
      if (
        DESCRIPTION_MARKDOWN_ADAPTIVE_ENABLED &&
        requestedLimit > minLimit &&
        markdownAttempted >= minLimit &&
        markdownAttempted < requestedLimit
      ) {
        const failRate = (markdownFailed / markdownAttempted) * 100;
        if (failRate >= DESCRIPTION_MARKDOWN_FAIL_THRESHOLD_PCT) {
          effectiveLimit = minLimit;
          console.warn(`description_markdown adaptive 하향: 실패율 ${failRate.toFixed(1)}% (기준 ${DESCRIPTION_MARKDOWN_FAIL_THRESHOLD_PCT}%) -> 이번 실행 처리 상한 ${effectiveLimit}건`);
        }
      }

      if (markdownAttempted >= effectiveLimit) {
        break;
      }
    }

    markdownPending = Math.max(0, markdownTargets.length - markdownAttempted);
    console.log(`description_markdown 결과: 시도 ${markdownAttempted}건, 성공 ${markdownGenerated}건, 실패 ${markdownFailed}건, 잔여 ${markdownPending}건`);
  }

  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`전국 보조금·복지 정책 수집 완료: 신규 ${newItemsCount}건 추가, markdown ${markdownGenerated}건 생성 (총 ${merged.length}건, 윈도우 ${SUBSIDY_WINDOW_MONTHS}개월)`);
  if (markdownGenerated > 0) {
    console.log(`  Gemini usage - input: ${inputTokens}, output: ${outputTokens}`);
  }
  if (validationStatus !== 'ok') {
    console.warn(`  데이터 검증 경고: ${validationStatus}`);
  }

  // GitHub Actions output
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = require('fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `collect_summary=신규 ${newItemsCount}건, 총 ${merged.length}건\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `gemini_usage=${inputTokens}/${outputTokens}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `anthropic_usage=${inputTokens}/${outputTokens}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `markdown_attempted=${markdownAttempted}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `markdown_failed=${markdownFailed}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `markdown_pending=${markdownPending}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `collect_validation=${validationStatus}\n`);
  }
}

run();
