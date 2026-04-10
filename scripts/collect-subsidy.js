const fs = require('fs/promises');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

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

async function generateSubsidyMarkdown(item) {
  if (!anthropic) return { markdown: '', usage: { input_tokens: 0, output_tokens: 0 } };
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

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  return {
    markdown: (msg.content?.[0]?.text || '').trim(),
    usage: {
      input_tokens: msg.usage?.input_tokens || 0,
      output_tokens: msg.usage?.output_tokens || 0,
    },
  };
}

async function run() {
  const PUBLIC_DATA_API_KEY = process.env.PUBLIC_DATA_API_KEY;
  const DESCRIPTION_MARKDOWN_BATCH_LIMIT = Number.parseInt(process.env.DESCRIPTION_MARKDOWN_BATCH_LIMIT || '10', 10);
  if (!PUBLIC_DATA_API_KEY) {
    console.error("Missing PUBLIC_DATA_API_KEY in process.env");
    return;
  }

  const endpoint = `https://api.odcloud.kr/api/gov24/v3/serviceList?page=1&perPage=100&returnType=JSON`;

  let items = [];
  try {
    const response = await fetch(endpoint, {
      headers: { 'Authorization': `Infuser ${PUBLIC_DATA_API_KEY}` }
    });
    if (!response.ok) {
      console.error("Failed to fetch subsidy data:", await response.text());
      return;
    }
    const data = await response.json();
    items = data.data || data.items || [];
  } catch (err) {
    console.error("Error fetching subsidy data:", err);
    return;
  }

  // 인천 소관기관 제외
  const filtered = items.filter(item => {
    const org = item['소관기관명'] || '';
    return !org.includes('인천');
  });

  const dataPath = path.join(process.cwd(), 'public', 'data', 'subsidy.json');

  // 기존 데이터 로드
  let existing = [];
  try {
    const fileContent = await fs.readFile(dataPath, 'utf-8');
    existing = JSON.parse(fileContent);
  } catch (_) {}

  const validationStatus = validateFetchedData('전국 보조금·복지 정책', existing.length, filtered.length);

  // 중복 제거 후 신규 항목 추가
  const existingNames = new Set(existing.map(e => e['서비스명'] || e.name));
  const newItems = filtered.filter(item => !existingNames.has(item['서비스명'] || item.name));

  const merged = [
    ...existing,
    ...newItems.map(item => ({
      ...item,
      expired: false,
      collectedAt: new Date().toISOString().split('T')[0]
    }))
  ];

  // 만료일 자동 감지: 지원내용 등에서 "(YYYY.MM.DD.한)" 패턴 파싱
  const expiryPattern = /(\d{4})\.(\d{2})\.(\d{2})\.한/;
  function parseExpiryDate(text) {
    const m = expiryPattern.exec(String(text || ''));
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  const todayStr = new Date().toISOString().split('T')[0];
  let autoExpiredCount = 0;
  for (const item of merged) {
    if (item.expired) continue;
    const expiryDate = parseExpiryDate(item['지원내용'])
      || parseExpiryDate(item['지원대상'])
      || parseExpiryDate(item['선정기준']);
    if (expiryDate && expiryDate < todayStr) {
      item.expired = true;
      autoExpiredCount++;
    }
  }
  if (autoExpiredCount > 0) {
    console.log(`만료일 자동 감지: ${autoExpiredCount}건 expired 처리`);
  }

  let markdownGenerated = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  if (!anthropic) {
    console.log('ANTHROPIC_API_KEY 없음: description_markdown 생성 건너뜀');
  } else {
    const markdownTargets = merged.filter((item) => {
      const hash = sourceHash(item);
      return !(item.description_markdown && item.description_markdown_source_hash === hash);
    });
    const batchTargets = markdownTargets.slice(0, Math.max(0, DESCRIPTION_MARKDOWN_BATCH_LIMIT));
    console.log(`description_markdown 배치 처리: ${batchTargets.length}건 / 대기 ${Math.max(0, markdownTargets.length - batchTargets.length)}건`);

    for (const item of batchTargets) {
      const hash = sourceHash(item);

      try {
        const { markdown, usage } = await generateSubsidyMarkdown(item);
        if (markdown) {
          item.description_markdown = markdown;
          item.description_markdown_source_hash = hash;
          item.description_markdown_model = 'claude-haiku-4-5-20251001';
          item.description_markdown_updated_at = new Date().toISOString().split('T')[0];
          markdownGenerated++;
          inputTokens += usage.input_tokens;
          outputTokens += usage.output_tokens;
        }
      } catch {
        console.error(`description_markdown 생성 실패: ${item['서비스명'] || item.name || item.title || item['서비스ID'] || item.id}`);
      }
    }
  }

  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`전국 보조금·복지 정책 수집 완료: 신규 ${newItems.length}건 추가, markdown ${markdownGenerated}건 생성 (총 ${merged.length}건)`);
  if (markdownGenerated > 0) {
    console.log(`  Anthropic usage - input: ${inputTokens}, output: ${outputTokens}`);
  }
  if (validationStatus !== 'ok') {
    console.warn(`  데이터 검증 경고: ${validationStatus}`);
  }

  // GitHub Actions output
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = require('fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `collect_summary=신규 ${newItems.length}건, 총 ${merged.length}건\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `anthropic_usage=${inputTokens}/${outputTokens}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `collect_validation=${validationStatus}\n`);
  }
}

run();
