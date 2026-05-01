/**
 * generate-editor-notes.js
 * 
 * Phase 2 (AdSense 콘텐츠 가치 보강): 상세 페이지 하단 "큐레이터 메모" 생성
 * 
 * 인천/보조금/축제 각 항목에 대해 Claude Haiku로
 * "함정·실전 팁·놓치기 쉬운 점 3가지"를 생성하여 editor_note 필드에 저장합니다.
 * 
 * 사용법:
 *   ANTHROPIC_API_KEY=sk-... node scripts/generate-editor-notes.js
 * 
 * 환경변수:
 *   ANTHROPIC_API_KEY         - (필수) Claude API 키
 *   EDITOR_NOTES_BATCH_SIZE   - 파일당 최대 처리 건수 (기본: 10)
 *   EDITOR_NOTES_ONLY_FILE    - 특정 파일만 처리 (incheon|subsidy|festival)
 *   EDITOR_NOTES_DELAY_MS     - API 호출 간 지연(ms) (기본: 1000)
 *   EDITOR_NOTES_FORCE        - 'true'이면 기존 editor_note 덮어쓰기
 */

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const HAIKU_MODELS = String(
  process.env.EDITOR_NOTES_MODELS
  || process.env.ANTHROPIC_MODEL
  || 'claude-haiku-4-5,claude-3-5-haiku-latest,claude-3-haiku-20240307'
)
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const BATCH_SIZE = Number(process.env.EDITOR_NOTES_BATCH_SIZE || 10);
const ONLY_FILE = (process.env.EDITOR_NOTES_ONLY_FILE || '').trim().toLowerCase();
const DELAY_MS = Number(process.env.EDITOR_NOTES_DELAY_MS || 1000);
const FORCE = process.env.EDITOR_NOTES_FORCE === 'true';

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY가 없습니다.');
  process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

const DATA_FILES = [
  { file: 'incheon.json', type: 'incheon' },
  { file: 'subsidy.json', type: 'subsidy' },
  { file: 'festival.json', type: 'festival' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getField(item, keys) {
  for (const key of keys) {
    if (item[key] && typeof item[key] === 'string') return String(item[key]).trim();
  }
  return '';
}

function parseNotesFromModelText(rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) return null;

  const candidates = [];
  candidates.push(raw);

  // ```json ... ``` 형태 우선 추출
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) candidates.push(String(fenced[1]).trim());

  // 본문 중 JSON 배열 부분만 추출
  const bracket = raw.match(/\[[\s\S]*\]/);
  if (bracket?.[0]) candidates.push(String(bracket[0]).trim());

  for (const text of candidates) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed
          .map((v) => String(v || '').trim())
          .filter(Boolean)
          .slice(0, 3);
        if (normalized.length > 0) return normalized;
      }
    } catch {
      // 다음 후보로 재시도
    }
  }

  return null;
}

function buildItemContext(item, type) {
  if (type === 'subsidy') {
    const name = getField(item, ['서비스명', 'name', 'title']);
    const summary = getField(item, ['서비스목적요약', 'summary']);
    const target = getField(item, ['지원대상', 'target']);
    const content = getField(item, ['지원내용']);
    const method = getField(item, ['신청방법']);
    const deadline = getField(item, ['신청기한', 'endDate']);
    const criteria = getField(item, ['선정기준']);
    const ai = getField(item, ['description_markdown']);
    return [
      `[보조금/복지 정책] ${name}`,
      summary && `목적: ${summary.slice(0, 200)}`,
      target && `지원대상: ${target.slice(0, 200)}`,
      content && `지원내용: ${content.slice(0, 200)}`,
      method && `신청방법: ${method.slice(0, 200)}`,
      criteria && `선정기준: ${criteria.slice(0, 200)}`,
      deadline && `마감일: ${deadline}`,
      ai && `AI 상세설명 (참고): ${ai.slice(0, 400)}`,
    ].filter(Boolean).join('\n');
  }
  if (type === 'incheon') {
    const name = getField(item, ['서비스명', 'name', 'title']);
    const summary = getField(item, ['서비스목적요약', 'summary']);
    const target = getField(item, ['지원대상', 'target']);
    const method = getField(item, ['신청방법']);
    const deadline = getField(item, ['신청기한', 'endDate']);
    const ai = getField(item, ['description_markdown']);
    return [
      `[인천시 정보/행사] ${name}`,
      summary && `내용: ${summary.slice(0, 200)}`,
      target && `대상: ${target.slice(0, 200)}`,
      method && `신청방법: ${method.slice(0, 200)}`,
      deadline && `마감/기간: ${deadline}`,
      ai && `AI 상세설명 (참고): ${ai.slice(0, 400)}`,
    ].filter(Boolean).join('\n');
  }
  if (type === 'festival') {
    const name = getField(item, ['title', 'name', '서비스명']);
    const overview = getField(item, ['overview', 'description', 'summary']);
    const location = getField(item, ['addr1', 'location', '소관기관명']);
    const startDate = getField(item, ['eventstartdate', 'startDate']);
    const endDate = getField(item, ['eventenddate', 'endDate']);
    const ai = getField(item, ['description_markdown']);
    return [
      `[전국 축제/여행] ${name}`,
      location && `위치: ${location}`,
      startDate && `기간: ${startDate}${endDate ? ` ~ ${endDate}` : ''}`,
      overview && `설명: ${overview.slice(0, 300)}`,
      ai && `AI 상세설명 (참고): ${ai.slice(0, 400)}`,
    ].filter(Boolean).join('\n');
  }
  return '';
}

async function generateEditorNote(item, type) {
  const context = buildItemContext(item, type);
  if (!context) return null;

  const systemPrompt = `당신은 픽앤조이(pick-n-joy.com)의 시민 생활정보 큐레이터입니다.
공공 서비스와 지역 정보를 실제로 이용해본 경험자 관점에서 독자에게 솔직하고 실용적인 조언을 줍니다.`;

  const userPrompt = `다음 정보를 읽고, 일반 시민이 이 서비스/행사를 이용할 때 **놓치기 쉬운 함정·실전 팁 3가지**를 작성해 주세요.

${context}

---

출력 형식 (JSON 배열, 순수 JSON만 출력):
["팁 1 내용", "팁 2 내용", "팁 3 내용"]

요구사항:
- 각 팁은 1~2문장, 50자 이내
- 친근한 한국어 반말 금지 (존댓말 사용)
- "~해요", "~세요" 어투
- AI 생성 느낌이 나는 뻔한 표현 금지
- 실제로 도움이 될 구체적인 내용
- 마감일, 소득 기준, 서류, 신청 방법상 주의점, 실제 적용 팁 위주`;

  try {
    let response = null;
    let lastError = null;

    for (const model of HAIKU_MODELS) {
      try {
        response = await client.messages.create({
          model,
          max_tokens: 256,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        break;
      } catch (err) {
        lastError = err;
        const status = err?.status || err?.statusCode;
        const message = String(err?.message || '');
        // 모델 미존재/권한 오류일 때 다음 모델로 폴백 시도
        if (status === 404 || status === 403 || /model|not\s*found|doesn'?t\s*exist/i.test(message)) {
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastError || new Error('사용 가능한 Anthropic 모델을 찾지 못했습니다.');
    }

    const raw = response.content[0]?.text?.trim() || '';
    const parsedNotes = parseNotesFromModelText(raw);
    if (!parsedNotes) {
      console.warn('  ⚠️ JSON 파싱 실패:', raw.slice(0, 100));
      return null;
    }
    return parsedNotes;
  } catch (err) {
    console.warn('  ⚠️ API 오류:', err.message?.slice(0, 100));
    return null;
  }
}

function getItemId(item, type) {
  if (type === 'festival') return getField(item, ['contentid', 'id']);
  return getField(item, ['서비스ID', 'id']);
}

function hasEnoughContext(item, type) {
  if (type === 'subsidy') {
    return !!(getField(item, ['서비스명', 'name']) && getField(item, ['서비스목적요약', 'summary', '지원내용']));
  }
  if (type === 'incheon') {
    return !!(getField(item, ['서비스명', 'name']) && getField(item, ['서비스목적요약', 'summary', '지원내용', 'description_markdown']));
  }
  if (type === 'festival') {
    return !!(getField(item, ['title', 'name']) && getField(item, ['overview', 'description', 'description_markdown']));
  }
  return false;
}

async function processFile({ file, type }) {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`⏩ ${file} 없음, 건너뜀`);
    return { generated: 0, skipped: 0, errors: 0 };
  }

  let items;
  try {
    items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`❌ ${file} 읽기 오류:`, err.message);
    return { generated: 0, skipped: 0, errors: 1 };
  }

  // 처리 대상: expired 제외, editor_note 없는 항목 (FORCE면 전체), 충분한 컨텍스트 있는 항목
  const candidates = items.filter(item => {
    if (item.expired) return false;
    if (!FORCE && item.editor_note) return false;
    return hasEnoughContext(item, type);
  });

  // description_markdown 있는 항목 우선 정렬
  candidates.sort((a, b) => {
    const aHasAi = !!(a.description_markdown);
    const bHasAi = !!(b.description_markdown);
    if (aHasAi && !bHasAi) return -1;
    if (!aHasAi && bHasAi) return 1;
    return 0;
  });

  const batch = candidates.slice(0, BATCH_SIZE);
  console.log(`\n📂 ${file}: 전체 ${items.length}건 / 처리 대상 ${candidates.length}건 / 이번 배치 ${batch.length}건`);

  if (batch.length === 0) {
    console.log('  ✅ 처리할 항목 없음');
    return { generated: 0, skipped: candidates.length, errors: 0 };
  }

  let generated = 0;
  let errors = 0;

  for (const item of batch) {
    const id = getItemId(item, type);
    const name = getField(item, ['서비스명', 'name', 'title']) || id;
    console.log(`  ⚙️ [${id}] ${name.slice(0, 30)}...`);

    const note = await generateEditorNote(item, type);
    if (note) {
      item.editor_note = note;
      generated++;
      console.log(`    ✅ 생성 완료: ${note[0]?.slice(0, 40)}...`);
    } else {
      errors++;
      console.log('    ❌ 생성 실패');
    }

    if (batch.indexOf(item) < batch.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // 파일 저장
  if (generated > 0) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
      console.log(`  💾 저장 완료: ${generated}건 추가`);
    } catch (err) {
      console.error(`  ❌ 저장 오류:`, err.message);
    }
  }

  return { generated, skipped: candidates.length - batch.length, errors };
}

async function main() {
  console.log('🚀 editor_note 생성 시작');
  console.log(`  모델 후보: ${HAIKU_MODELS.join(' -> ')}`);
  console.log(`  배치 크기: ${BATCH_SIZE}건/파일`);
  console.log(`  FORCE 덮어쓰기: ${FORCE}`);
  console.log(`  호출 간 지연: ${DELAY_MS}ms`);

  const targets = ONLY_FILE
    ? DATA_FILES.filter(d => d.type === ONLY_FILE || d.file.includes(ONLY_FILE))
    : DATA_FILES;

  if (ONLY_FILE) console.log(`  대상 파일: ${ONLY_FILE}`);

  let totalGenerated = 0;
  let totalErrors = 0;

  for (const target of targets) {
    const result = await processFile(target);
    totalGenerated += result.generated;
    totalErrors += result.errors;
  }

  console.log(`\n✅ 완료: ${totalGenerated}건 생성 / ${totalErrors}건 실패`);

  // GitHub Actions output
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    try {
      fs.appendFileSync(outputPath, `editor_notes_generated=${totalGenerated}\n`);
      fs.appendFileSync(outputPath, `editor_notes_errors=${totalErrors}\n`);
    } catch { /* ignore */ }
  }
}

main().catch(err => {
  console.error('❌ 치명적 오류:', err);
  process.exit(1);
});
