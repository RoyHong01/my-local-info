import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { execFileSync } from 'child_process';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const ALLOW_GEMINI_PRO = process.env.ALLOW_GEMINI_PRO === 'true';
if (/\bpro\b/i.test(GEMINI_MODEL) && !ALLOW_GEMINI_PRO) {
  throw new Error(`안전장치: Pro 모델(${GEMINI_MODEL})은 차단됩니다. 필요하면 ALLOW_GEMINI_PRO=true를 명시하세요.`);
}
const TARGET_POSTS_PER_RUN = Number(process.env.LIFE_RESTAURANT_POSTS_PER_RUN || '3');
const TARGET_POSTS_PER_BUCKET = Number(process.env.LIFE_RESTAURANT_POSTS_PER_BUCKET || '1');
const INTER_REQUEST_DELAY_MS = Number(process.env.INTER_REQUEST_DELAY_MS || '1000');
const BOOTSTRAP_MIN_PER_BUCKET = Number(process.env.LIFE_RESTAURANT_BOOTSTRAP_MIN_PER_BUCKET || '0');
const MIN_UNUSED_CANDIDATES = Number(process.env.MIN_UNUSED_RESTAURANT_CANDIDATES || '10');
const TARGET_BUCKETS = ['seoul', 'incheon', 'gyeonggi'];
const FORCE_RESTAURANT_SOURCE_IDS = new Set(
  String(process.env.FORCE_RESTAURANT_SOURCE_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);
const snapshotPath = path.join(process.cwd(), 'src', 'app', 'life', 'restaurant', 'data', 'restaurants.json');
const postsDir = path.join(process.cwd(), 'src', 'content', 'life');
const existingPostDirs = [
  path.join(process.cwd(), 'src', 'content', 'posts'),
  path.join(process.cwd(), 'src', 'content', 'life'),
];
const BANNED_WORDS = ['최고', '대박', '무조건'];
const REQUIRED_SECTION_PATTERNS = [
  { label: '방문 정보 한눈에', pattern: /##\s*방문 정보 한눈에/ },
  { label: '상호명:', pattern: /(?:\*\*\s*)?상호명(?:\s*\*\*)?\s*:/ },
  { label: '주소:', pattern: /(?:\*\*\s*)?주소(?:\s*\*\*)?\s*:/ },
  { label: '전화번호:', pattern: /(?:\*\*\s*)?전화번호(?:\s*\*\*)?\s*:/ },
];

function slugifyKorean(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function slugifyAscii(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function inferAreaSlug(candidate, locality) {
  const sourceText = [
    locality,
    candidate?.item?.sourceQuery || '',
    candidate?.item?.address || '',
  ].join(' ');

  const areaMap = [
    ['송도', 'songdo'],
    ['청라', 'cheongna'],
    ['구월', 'guwol'],
    ['부평', 'bupyeong'],
    ['부천', 'bucheon'],
    ['김포', 'gimpo'],
    ['성수', 'seongsu'],
    ['연남', 'yeonnam'],
    ['강남', 'gangnam'],
    ['잠실', 'jamsil'],
    ['행궁', 'haenggung'],
    ['수원', 'suwon'],
    ['판교', 'pangyo'],
    ['서울', 'seoul'],
    ['인천', 'incheon'],
    ['경기', 'gyeonggi'],
  ];

  for (const [korean, romanized] of areaMap) {
    if (sourceText.includes(korean)) return romanized;
  }

  const localitySlug = slugifyAscii(locality);
  return localitySlug || 'korea';
}

function buildRestaurantSlug(candidate, locality) {
  const areaSlug = inferAreaSlug(candidate, locality);
  const nameSlugAscii = slugifyAscii(candidate?.item?.name || '');
  const nameSlug = nameSlugAscii || `restaurant-${candidate?.item?.id || 'unknown'}`;
  return `${areaSlug}-${nameSlug}`;
}

function inferLocality(address, regionLabel) {
  const text = String(address || '').trim();
  if (text.startsWith('인천')) return '인천';
  if (text.startsWith('서울')) return '서울';
  if (text.startsWith('경기')) return '경기';
  if (text.startsWith('부천')) return '경기';
  if (text.startsWith('김포')) return '경기';
  if (text.startsWith('수원')) return '경기';
  return regionLabel.includes('인천') ? '인천' : '서울/경기';
}

function classifyRegionBucket(item) {
  const source = [item?.address || '', item?.sourceQuery || '', item?.name || ''].join(' ');

  if (/서울/.test(source)) return 'seoul';
  if (/인천/.test(source)) return 'incheon';

  if (/경기|수원|성남|용인|고양|안양|화성|하남|의왕|의정부|광명|군포|파주|남양주|김포|부천|판교|분당|광교|동탄/.test(source)) {
    return 'gyeonggi';
  }

  // 기본값: 서울/인천이 아닌 수도권 후보는 경기로 분류
  return 'gyeonggi';
}

function toAreaTag(bucket) {
  if (bucket === 'seoul') return '서울';
  if (bucket === 'incheon') return '인천';
  return '경기';
}

function classifyBucketFromPostFrontmatter(data) {
  const locality = String(data?.place_locality || data?.placeLocality || '').trim();
  if (locality === '서울') return 'seoul';
  if (locality === '인천') return 'incheon';
  if (locality === '경기') return 'gyeonggi';

  const tags = Array.isArray(data?.tags) ? data.tags.join(' ') : String(data?.tags || '');
  const source = [
    tags,
    String(data?.place_address || data?.placeAddress || ''),
    String(data?.title || ''),
  ].join(' ');

  if (/서울/.test(source)) return 'seoul';
  if (/인천/.test(source)) return 'incheon';
  return 'gyeonggi-other';
}

function selectCandidatesByBucket(candidates, existingBucketCounts) {
  const buckets = new Map(TARGET_BUCKETS.map((bucket) => [bucket, []]));

  for (const candidate of candidates) {
    const bucket = classifyRegionBucket(candidate.item);
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push({ ...candidate, regionBucket: bucket, areaTag: toAreaTag(bucket) });
  }

  const selected = [];
  const desiredByBucket = new Map();

  for (const bucket of TARGET_BUCKETS) {
    if (BOOTSTRAP_MIN_PER_BUCKET > 0) {
      const existing = existingBucketCounts.get(bucket) || 0;
      desiredByBucket.set(bucket, Math.max(0, BOOTSTRAP_MIN_PER_BUCKET - existing));
    } else {
      desiredByBucket.set(bucket, TARGET_POSTS_PER_BUCKET);
    }
  }

  const totalWanted = BOOTSTRAP_MIN_PER_BUCKET > 0
    ? Array.from(desiredByBucket.values()).reduce((acc, count) => acc + count, 0)
    : TARGET_POSTS_PER_RUN;

  let remaining = 0;
  for (const bucket of TARGET_BUCKETS) {
    const list = buckets.get(bucket) || [];
    const desired = desiredByBucket.get(bucket) || 0;
    const picked = list.slice(0, desired);
    if (picked.length < desired) {
      console.warn(`⚠️ ${bucket} 버킷 후보 부족: ${picked.length}/${desired}`);
      remaining += desired - picked.length;
    }
    selected.push(...picked);
  }

  // 부족한 버킷의 남은 슬롯을 다른 버킷에 재분배
  if (remaining > 0) {
    for (const bucket of TARGET_BUCKETS) {
      if (remaining <= 0) break;
      const list = buckets.get(bucket) || [];
      const alreadyPicked = desiredByBucket.get(bucket) || 0;
      const extra = list.slice(alreadyPicked);
      const fill = extra.slice(0, remaining);
      if (fill.length > 0) {
        console.log(`♻️ ${bucket} 버킷에서 ${fill.length}건 추가 선택 (부족 버킷 재분배)`);
        selected.push(...fill);
        remaining -= fill.length;
      }
    }
  }

  return selected.slice(0, totalWanted);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API 오류: ${res.status} ${err}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0] || {};
  return {
    text: candidate?.content?.parts?.[0]?.text || '',
    finishReason: candidate?.finishReason || '',
  };
}

function looksIncompleteGeminiOutput(text) {
  const value = (text || '').trim();
  if (!value) return true;
  if (!/FILENAME:\s*\S+/m.test(value)) return true;

  const withoutFilename = value
    .split('\n')
    .filter((line) => !line.trim().startsWith('FILENAME:'))
    .join('\n')
    .trim();

  if (withoutFilename.length < 700) return true;
  if (!/[.!?…]$/.test(withoutFilename)) return true;
  return false;
}

function splitMarkdownSections(markdown) {
  const normalized = (markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: '', body: normalized };
  }

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) {
    return { frontmatter: '', body: normalized };
  }

  const frontmatter = normalized.slice(0, end + 5);
  const body = normalized.slice(end + 5).trim();
  return { frontmatter, body };
}

function extractTitleFromFrontmatter(frontmatter) {
  const m = frontmatter.match(/^title:\s*(.+)$/m);
  if (!m) return '';
  return m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
}

function buildHookFromTitle(title, fallback) {
  const seed = (title || fallback || '이번 맛집').trim();
  const cleaned = seed
    .replace(/["'“”‘’]/g, '')
    .replace(/[!?.,:;]+$/g, '')
    .trim();
  const core = cleaned.split(/[,:]/)[0].trim() || cleaned;
  return `## ${core}, 여기서 결정하면 고민이 좀 줄어들어요`;
}

function postProcessRestaurantMarkdown(markdown, context) {
  const { frontmatter, body } = splitMarkdownSections(markdown);
  let normalizedBody = (body || '').trim();

  normalizedBody = normalizedBody
    .split('\n')
    .map((line) => line.replace(/^#\s+/, '## '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const firstNonEmpty = normalizedBody.split('\n').find((line) => line.trim()) || '';
  if (!/^##\s+/.test(firstNonEmpty)) {
    const title = extractTitleFromFrontmatter(frontmatter) || context.itemName;
    normalizedBody = `${buildHookFromTitle(title, context.itemName)}\n\n${normalizedBody}`;
  }

  // 숫자형 보고서 톤 소제목이 나오면 최대한 완화
  normalizedBody = normalizedBody
    .replace(/^###\s+1\.\s+/gm, '### 이 지점이 먼저 끌려요 — ')
    .replace(/^###\s+2\.\s+/gm, '### 그래서 후보에서 안 빼게 돼요 — ')
    .replace(/^###\s+3\.\s+/gm, '### 가기 전에 이것만 챙기면 돼요 — ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  normalizedBody = enforceHookBridgeAndHeadingSpacing(normalizedBody, context);

  return `${frontmatter}\n\n${normalizedBody}`.trim();
}

function enforceHookBridgeAndHeadingSpacing(body, context) {
  const lines = String(body || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmptyIndices = lines.map((line, i) => ({ line: line.trim(), i })).filter((x) => x.line.length > 0).map((x) => x.i);
  if (nonEmptyIndices.length === 0) return body;

  const hookIndex = nonEmptyIndices[0];
  if (!/^##\s+/.test(lines[hookIndex].trim())) {
    return body;
  }

  const firstSubheadingIndex = lines.findIndex((line, i) => i > hookIndex && isSubheadingLine(line));

  const result = [];
  for (let i = 0; i <= hookIndex; i++) result.push(lines[i]);

  // HOOK 다음은 반드시 한 줄 공백
  if (result[result.length - 1] !== '') result.push('');

  const bridgeSourceStart = hookIndex + 1;
  const bridgeSourceEnd = firstSubheadingIndex === -1 ? lines.length : firstSubheadingIndex;
  const bridgeLines = lines
    .slice(bridgeSourceStart, bridgeSourceEnd)
    .map((line) => line.trim())
    .filter((line) => line && !isSubheadingLine(line));

  const bridgeFallback = [
    `${context.itemName}은(는) 첫인상에서부터 동선이 깔끔하게 잡히는 편이라, 약속 코스 고민이 줄어드는 느낌이 들어요.`,
    `${context.scenarioHint || '약속 전후 흐름'} 기준으로도 부담이 적고, ${context.vibeHint || '공간의 결'}이 자연스럽게 이어져서 첫 방문 코스로 잡기 좋아요.`,
  ];

  const normalizedBridge = bridgeLines.slice(0, 3);
  while (normalizedBridge.length < 2) {
    normalizedBridge.push(bridgeFallback[normalizedBridge.length]);
  }

  for (const line of normalizedBridge) result.push(line);

  // 브릿지 이후 첫 소제목 전 여백 2줄 보장
  result.push('');
  result.push('');

  if (firstSubheadingIndex !== -1) {
    for (let i = firstSubheadingIndex; i < lines.length; i++) {
      result.push(lines[i]);
    }
  }

  // ### 또는 ** 소제목 위/아래 2줄 여백 보장
  const spaced = [];
  const addBlankLine = () => {
    if (spaced.length === 0 || spaced[spaced.length - 1] !== '') spaced.push('');
  };

  for (const rawLine of result) {
    const line = rawLine.trimEnd();
    if (isSubheadingLine(line)) {
      addBlankLine();
      addBlankLine();
      spaced.push(line);
      addBlankLine();
      addBlankLine();
      continue;
    }
    spaced.push(line);
  }

  return spaced.join('\n').replace(/\n{5,}/g, '\n\n\n\n').trim();
}

function tryConvertJsonResponseToMarkdown(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  let candidate = raw;
  if (/^json\s*\n/i.test(candidate)) {
    candidate = candidate.replace(/^json\s*\n/i, '').trim();
  }
  if (candidate.startsWith('```json')) candidate = candidate.substring(7).trim();
  else if (candidate.startsWith('```')) candidate = candidate.substring(3).trim();
  if (candidate.endsWith('```')) candidate = candidate.slice(0, -3).trim();

  if (!candidate.startsWith('{')) return null;

  try {
    const parsed = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object') return null;

    const title = String(parsed.title || '').trim();
    const date = String(parsed.date || '').trim();
    const summary = String(parsed.summary || '').trim();
    const description = String(parsed.description || '').trim();
    const category = String(parsed.category || '픽앤조이 맛집 탐방').trim();
    const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
    const image = String(parsed.image || '/images/default-restaurant.svg').trim();
    const sourceId = String(parsed.source_id || parsed.sourceId || '').trim();
    const slug = String(parsed.slug || '').trim();
    const placeName = String(parsed.place_name || parsed.placeName || '').trim();
    const placeAddress = String(parsed.place_address || parsed.placeAddress || '').trim();
    const placeLocality = String(parsed.place_locality || parsed.placeLocality || '').trim();
    const placeRegion = String(parsed.place_region || parsed.placeRegion || 'KR').trim();
    const placePhone = String(parsed.place_phone || parsed.placePhone || '').trim();
    const placeUrl = String(parsed.place_url || parsed.placeUrl || '').trim();
    const parkingInfo = String(parsed.parking_info || parsed.parkingInfo || '확인 필요').trim();
    const ratingValue = parsed.rating_value ?? parsed.ratingValue;
    const reviewCount = parsed.review_count ?? parsed.reviewCount;
    const content = String(parsed.content || '').trim();

    if (!title || !date || !slug || !content) return null;

    const escapedTitle = title.replace(/"/g, '\\"');
    const escapedSummary = summary.replace(/"/g, '\\"');
    const escapedDescription = description.replace(/"/g, '\\"');
    const escapedPlaceName = placeName.replace(/"/g, '\\"');
    const escapedPlaceAddress = placeAddress.replace(/"/g, '\\"');
    const escapedPlaceLocality = placeLocality.replace(/"/g, '\\"');
    const escapedPlaceRegion = placeRegion.replace(/"/g, '\\"');
    const escapedPlacePhone = placePhone.replace(/"/g, '\\"');
    const escapedPlaceUrl = placeUrl.replace(/"/g, '\\"');
    const escapedParkingInfo = parkingInfo.replace(/"/g, '\\"');

    const tagsLine = tags.length > 0 ? tags.join(', ') : '맛집탐방, 카카오맵';
    const ratingBlock = (ratingValue != null || reviewCount != null)
      ? `\nrating_value: "${String(ratingValue ?? '').replace(/"/g, '\\"')}"\nreview_count: "${String(reviewCount ?? '').replace(/"/g, '\\"')}"`
      : '';

    return `---
title: "${escapedTitle}"
date: ${date}
summary: ${escapedSummary}
description: "${escapedDescription}"
category: ${category}
tags: [${tagsLine}]
image: "${image}"
source_id: "${sourceId}"
slug: "${slug}"
place_name: "${escapedPlaceName}"
place_address: "${escapedPlaceAddress}"
place_locality: "${escapedPlaceLocality}"
place_region: "${escapedPlaceRegion}"
place_phone: "${escapedPlacePhone}"
place_url: "${escapedPlaceUrl}"
parking_info: "${escapedParkingInfo}"${ratingBlock}
---

${content}`.trim();
  } catch {
    return null;
  }
}

function normalizeGeneratedMarkdown(generatedText, fileStem, candidate) {
  const lines = String(generatedText || '').split('\n');
  let filename = `${fileStem}.md`;
  const contentLines = [];

  for (const line of lines) {
    if (line.trim().startsWith('FILENAME:')) {
      filename = `${line.replace('FILENAME:', '').trim().replace(/\.md$/i, '')}.md`;
    } else {
      contentLines.push(line);
    }
  }

  let finalContent = contentLines.join('\n').trim();
  const convertedFromJson = tryConvertJsonResponseToMarkdown(finalContent);
  if (convertedFromJson) {
    finalContent = convertedFromJson;
  }
  if (finalContent.startsWith('```markdown')) finalContent = finalContent.substring(11);
  else if (finalContent.startsWith('```')) finalContent = finalContent.substring(3);
  if (finalContent.endsWith('```')) finalContent = finalContent.slice(0, -3);
  finalContent = finalContent.trim();

  finalContent = finalContent.replace(/^(title:\s*)(.+)$/m, (match, prefix, value) => {
    if (value.includes(':') && !value.startsWith('"') && !value.startsWith("'")) {
      return `${prefix}"${value.replace(/"/g, '\\"')}"`;
    }
    return match;
  });

  finalContent = finalContent.replace(/^(description:\s*)(.+)$/m, (match, prefix, value) => {
    const clean = String(value || '').replace(/^"|"$/g, '').trim();
    const shortened = clean.length > 160 ? `${clean.slice(0, 157).trimEnd()}...` : clean;
    return `${prefix}"${shortened.replace(/"/g, '\\"')}"`;
  });

  finalContent = postProcessRestaurantMarkdown(finalContent, {
    itemName: candidate.item.name,
  });

  return { filename, finalContent };
}

function isLikelyPoliteSentence(sentence) {
  const text = String(sentence || '').trim().replace(/[.!?！？。]+$/g, '');
  if (!text || !/[가-힣]/.test(text)) return true;
  return /(요|니다|이에요|예요|더라고요|거든요|랍니다|네요|죠)$/.test(text);
}

function isSubheadingLine(line) {
  const text = String(line || '').trim();
  if (!text) return false;
  if (/^###\s+\S+/.test(text)) return true;
  if (/^\*\*[^*]+\*\*$/.test(text)) return true;
  return false;
}

function countSentenceLike(text) {
  const value = String(text || '').trim();
  if (!value) return 0;
  const protectedText = value.replace(/(\d)\.(\d)/g, '$1__DOT__$2');
  return protectedText
    .split(/(?<=[.!?！？。])/)
    .map((s) => s.replace(/__DOT__/g, '.').trim())
    .filter((s) => /[가-힣A-Za-z0-9]/.test(s)).length;
}

function validateSubheadingAndReadability(bodyText) {
  const issues = [];
  const mainBody = String(bodyText || '').split('## 방문 정보 한눈에')[0] || '';
  const rawLines = mainBody.split('\n');
  const lines = rawLines.map((line) => line.trim());

  const subheadingCount = lines.filter((line) => isSubheadingLine(line)).length;
  if (subheadingCount < 3) {
    issues.push(`소제목 부족(${subheadingCount}개 / 최소 3개)`);
  }

  const firstContentIndex = lines.findIndex((line) => line.length > 0);
  if (firstContentIndex !== -1 && /^##\s+/.test(lines[firstContentIndex])) {
    const hookNext = rawLines[firstContentIndex + 1] ?? '';
    if (hookNext.trim().length > 0) {
      issues.push('여백 체크 실패: HOOK 바로 다음 줄이 비어있지 않음');
    }

    const firstSubheadingRawIndex = rawLines.findIndex((line, i) => i > firstContentIndex && isSubheadingLine(line));
    if (firstSubheadingRawIndex === -1) {
      issues.push('구조 체크 실패: 첫 번째 소제목이 없음');
    } else {
      const bridgeLines = rawLines
        .slice(firstContentIndex + 1, firstSubheadingRawIndex)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (bridgeLines.length < 2) {
        issues.push(`여백 체크 실패: 브릿지 문단 부족(${bridgeLines.length}줄 / 최소 2줄)`);
      }

      const introText = rawLines.slice(firstContentIndex + 1, firstSubheadingRawIndex).join('\n').replace(/\s+/g, '');
      if (introText.length > 150) {
        issues.push(`구조 체크 실패: 첫 소제목 전 서론이 너무 김(${introText.length}자 / 최대 150자)`);
      }

      // ### 소제목은 위아래 2줄 이상 공백 확보
      for (let i = 0; i < rawLines.length; i++) {
        if (!/^###\s+\S+/.test(rawLines[i].trim())) continue;

        const before1 = (rawLines[i - 1] ?? '').trim();
        const before2 = (rawLines[i - 2] ?? '').trim();
        const after1 = (rawLines[i + 1] ?? '').trim();
        const after2 = (rawLines[i + 2] ?? '').trim();
        if (before1.length > 0 || before2.length > 0 || after1.length > 0 || after2.length > 0) {
          issues.push('여백 체크 실패: ### 소제목 위아래 2줄 공백 미충족');
          break;
        }
      }
    }
  }

  let consecutiveParagraphsWithoutHeading = 0;
  for (const line of lines) {
    if (!line) continue;

    if (line.startsWith('#')) {
      consecutiveParagraphsWithoutHeading = 0;
      continue;
    }

    if (isSubheadingLine(line)) {
      consecutiveParagraphsWithoutHeading = 0;
      continue;
    }

    if (/^[-*]\s+/.test(line)) continue;
    if (/^\*\*[^*]+\*\*\s*:/.test(line)) continue;

    const sentenceCount = countSentenceLike(line);
    if (sentenceCount > 4) {
      issues.push(`가독성 저하: 소제목 하위 문단이 과도하게 김(한 문단 ${sentenceCount}문장)`);
      break;
    }

    if (sentenceCount > 0) {
      consecutiveParagraphsWithoutHeading += 1;
      if (sentenceCount >= 3 && consecutiveParagraphsWithoutHeading >= 2) {
        issues.push(`가독성 저하: 소제목 없이 긴 줄글이 이어짐(문단 ${consecutiveParagraphsWithoutHeading}개째, ${sentenceCount}문장)`);
        break;
      }
      if (consecutiveParagraphsWithoutHeading >= 3) {
        issues.push('가독성 저하: 소제목 없이 3개 이상 문단이 연속됨');
        break;
      }
    }
  }

  return issues;
}

function validateGeneratedRestaurantMarkdown(markdown) {
  const issues = [];
  const { body } = splitMarkdownSections(markdown);
  const bodyText = String(body || '');

  const compactLength = bodyText.replace(/\s+/g, '').length;
  if (compactLength < 500) {
    issues.push(`최소 분량 미달(공백 제외 ${compactLength}자 / 기준 500자)`);
  }

  for (const rule of REQUIRED_SECTION_PATTERNS) {
    if (!rule.pattern.test(bodyText)) {
      issues.push(`필수 섹션/항목 누락: ${rule.label}`);
    }
  }

  const bannedFound = BANNED_WORDS.filter((word) => bodyText.includes(word));
  if (bannedFound.length > 0) {
    issues.push(`금지어 포함: ${bannedFound.join(', ')}`);
  }

  const politeSkippedPrefixes = [
    '#',
    '-',
    '*',
    '상호명:',
    '주소:',
    '전화번호:',
    '주차:',
    '이럴 때 체크하면 좋아요:',
    '식사 후 동선:',
    '에디터 한 줄 평',
    '"',
    '{',
    '}',
    '[',
    ']',
  ];

  const plainStyleSamples = [];
  for (const rawLine of bodyText.split('\n')) {
    const line = rawLine.trim();
    if (!line || politeSkippedPrefixes.some((prefix) => line.startsWith(prefix))) continue;

    const protectedLine = line.replace(/(\d)\.(\d)/g, '$1__DOT__$2');
    const sentences = protectedLine
      .split(/(?<=[.!?！？。])/)
      .map((s) => s.replace(/__DOT__/g, '.').trim())
      .filter(Boolean);
    for (const sentence of sentences) {
      if (!/[가-힣]/.test(sentence)) continue;
      if (!isLikelyPoliteSentence(sentence)) {
        plainStyleSamples.push(sentence.replace(/\s+/g, ' ').slice(0, 80));
      }
    }
  }

  if (plainStyleSamples.length > 0) {
    issues.push(`평어체 의심 문장 발견: ${plainStyleSamples.slice(0, 3).join(' | ')}`);
  }

  const headingAndReadabilityIssues = validateSubheadingAndReadability(bodyText);
  issues.push(...headingAndReadabilityIssues);

  return issues;
}

async function getExistingRestaurantStats() {
  const ids = new Set();
  const bucketCounts = new Map(TARGET_BUCKETS.map((bucket) => [bucket, 0]));

  await fs.mkdir(postsDir, { recursive: true });

  for (const dir of existingPostDirs) {
    let files = [];
    try {
      await fs.mkdir(dir, { recursive: true });
      files = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const fullPath = path.join(dir, file);
      const raw = await fs.readFile(fullPath, 'utf-8');
      const parsed = matter(raw);
      if (parsed.data.category !== '픽앤조이 맛집 탐방') continue;

      const sourceId = String(parsed.data.source_id || parsed.data.sourceId || '').trim();
      if (sourceId) ids.add(sourceId);

      const bucket = classifyBucketFromPostFrontmatter(parsed.data);
      bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);

      if (sourceId && FORCE_RESTAURANT_SOURCE_IDS.has(sourceId)) {
        await fs.unlink(fullPath);
        ids.delete(sourceId);
        bucketCounts.set(bucket, Math.max(0, (bucketCounts.get(bucket) || 1) - 1));
        console.log(`♻️ 기존 맛집 포스트 재생성 준비: ${file} (${sourceId})`);
      }
    }
  }

  return { ids, bucketCounts };
}

async function readSnapshot() {
  const raw = await fs.readFile(snapshotPath, 'utf-8');
  return JSON.parse(raw);
}

function buildRoundRobinCandidates(regions) {
  const queues = Object.entries(regions).map(([region, items]) => ({
    region,
    items: Array.isArray(items) ? [...items] : [],
  }));

  const out = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const queue of queues) {
      if (queue.items.length > 0) {
        out.push({ region: queue.region, item: queue.items.shift() });
        progressed = true;
      }
    }
  }
  return out;
}

async function generateRestaurantPost(candidate) {
  const today = new Date().toISOString().split('T')[0];
  const locality = inferLocality(candidate.item.address, candidate.regionLabel);
  const slugBase = buildRestaurantSlug(candidate, locality);
  const fileStem = `${today}-${slugBase}`;
  const defaultImage = '/images/default-restaurant.svg';

  const ratingFrontmatter = candidate.item.googleRating != null
    ? `\nrating_value: "${candidate.item.googleRating}"\nreview_count: "${candidate.item.googleRatingCount ?? ''}"`
    : '';

  const prompt = `아래 맛집 데이터를 바탕으로 '2030이 저장해두고 싶은 핫플 큐레이션 글'을 작성해줘.

입력 데이터:
${JSON.stringify(candidate, null, 2)}

반드시 아래 형식만 출력해줘. 다른 설명은 절대 붙이지 마:
---
title: (콜론(:) 포함 시 반드시 큰따옴표로 감싸기)
date: ${today}
summary: (130~160자. 약속 전 메뉴/분위기 고민 + 이곳을 체크하게 되는 이유 + 기대 포인트를 자연스럽게 담기)
description: (130~160자. '평점 4.2가 증명하는 찐맛집' 뉘앙스를 포함해 클릭을 유도하는 검색 문장)
category: 픽앤조이 맛집 탐방
tags: [맛집탐방, ${candidate.regionLabel}, ${candidate.areaTag}, ${candidate.item.cuisineHint || '핫플'}, ${candidate.item.vibeHint || '분위기맛집'}, 카카오맵]
image: "${defaultImage}"
source_id: "${candidate.item.id}"
slug: "${slugBase}"
place_name: "${candidate.item.name.replace(/"/g, '\\"')}"
place_address: "${candidate.item.address.replace(/"/g, '\\"')}"
place_locality: "${locality}"
place_region: "KR"
place_phone: "${candidate.item.phone.replace(/"/g, '\\"')}"
place_url: "${candidate.item.mapUrl.replace(/"/g, '\\"')}"
parking_info: "확인 필요"${ratingFrontmatter}
---

[픽앤조이 메인 에디터 페르소나]
- 당신은 2030 세대의 라이프스타일을 꿰뚫고 있는 센스 있는 맛집 에디터야.
- 단순 정보 전달을 넘어, 독자의 상황에 공감하고 "여긴 진짜 가보고 싶다"는 감정을 만들 것.

[필수]
- 제목 규칙: [지역명] + [대표 메뉴/장르] + [호기심 유발 키워드] 조합으로 작성.
- 제목에는 반드시 음식 장르(한식/양식/일식/카페/브런치 등) 또는 대표 메뉴(파스타/오마카세/국밥 등)를 포함.
- slug는 이미 정해져 있으니 절대 변경하지 마.
- 본문 첫 줄은 반드시 ## HOOK 헤딩으로 시작. 독자의 고민(웨이팅/동선/메뉴 고민)을 찌르는 질문 또는 공감 문장으로 작성.
- HOOK 바로 다음 줄은 반드시 빈 줄 1개를 넣어 시선을 분리할 것.
- HOOK 다음에는 첫 소제목 전에 브릿지 문단 2~3줄을 반드시 작성해 장소의 전체 인상을 먼저 전달할 것.
- 본문 전개는 아래 순서를 따를 것:
  1) HOOK: 지금 겪는 고민을 찌르는 시작
  2) SCENARIO: scenarioHint를 바탕으로 방문 상황을 구체적으로 묘사
  3) SENSORY: 식감(쫄깃/바삭), 향(불향/고소함), 온도감 중심의 맛 표현
  4) TRANSITION: 문단 전환은 부드러운 연결 문구 사용
- TRANSITION 문구 예시: "이곳의 진짜 매력은 따로 있어요", "동선 안에서 답을 찾았네요".
- 반드시 sourceQuery, scenarioHint, vibeHint, cuisineHint를 본문에 자연스럽게 녹여 쓸 것.
- 소제목은 감성 문장형으로 최소 3~4개를 반드시 작성.
- 소제목 표기 형식은 반드시 아래 둘 중 하나를 사용:
  1) ### 소제목 문장
  2) **소제목 문장**
- 소제목은 단어형(예: 분위기, 맛, 위치) 금지. 문장형으로 작성.
- 소제목 예시: "동선 안에 답이 있었네요", "자극적이지 않아서 더 좋아요", "가기 전에 이것만은 꼭".
- 레이아웃 예시: HOOK 이후에 위와 같은 문장형 소제목이 중간중간 끼어드는 블로그 구조를 그대로 따를 것.
- 모든 ### 소제목의 위/아래에는 빈 줄을 2개 이상 넣어 여백의 미를 살릴 것.
- 각 소제목 아래 문단은 최대 3~4문장으로 끊고, 문단 사이에도 빈 줄을 넣어 가독성을 유지할 것.
- 2~3문장마다 줄바꿈해 가독성을 유지.

[스타일]
- 경어체(~해요, ~예요, ~더라고요)만 사용하고 평어체(~이다/~한다)는 금지.
- 같은 종결 어미 반복을 피하고 문장 리듬을 다양하게 유지.
- 감탄사/의성어/의태어는 과하지 않게 섞어 생동감을 줄 것.
- 광고 카피가 아니라 실제 다녀온 에디터의 체감 중심 톤으로 작성.
- 과장 대신 "에디터의 사심"이 느껴지는 구체적 이유를 강조.
- 마지막 문장은 홍보 문구 대신 개인적 여운으로 마무리.

[금지]
- 연도/숫자/TOP/베스트/총정리/완전정복/맛집 추천 리스트형 제목 금지.
- 상황만 나열하고 음식 장르/메뉴가 빠진 제목 금지.
- 확인되지 않은 정보 단정 금지(메뉴 세부, 웨이팅 시간, 인테리어 디테일, 대표 메뉴, 주차 가능 여부).
- 아래 표현은 사용 금지: 추천합니다, 방문해보세요, 만족도가 높습니다, 다양한 메뉴가 있어요, 최고의 선택, 주말 고민 해결, 무조건, 찐으로, 인생맛집 TOP, 총정리.
- 과한 광고성 문구(최고, 대박, 무조건) 반복 금지.

[반드시 포함할 정보 박스 섹션]
본문 후반에 '## 방문 정보 한눈에' 섹션을 만들고 아래를 모두 넣어줘.
- 상호명: markdown 링크 형식으로 카카오맵 주소 연결
- 주소
- 전화번호
- 주차: 확인 필요 (명확한 정보가 없으면 이렇게 쓰기)
- 이럴 때 체크하면 좋아요: scenarioHint를 바탕으로 한 한 줄
- 식사 후 동선: '여기서 식사하고 도보 5분 거리의 OO 카페까지 이어가면 코스가 완성돼요' 같은 형태로 한 줄
- 에디터 한 줄 평

[형식 규칙]
- 본문 첫 줄 ## 헤딩은 훅 문장 자체를 그대로 써줘. 예: ## 여기 안 가본 사람 아직도 있어요? 처럼 작성하고, "훅"이라는 단어 자체를 제목으로 쓰는 것은 절대 금지.
- 본문 중간에 반드시 문장형 소제목을 배치해 레이아웃을 살려줘. 예: "### 동선 안에 답이 있었네요", "### 자극적이지 않아서 더 좋아요", "### 가기 전에 이것만은 꼭".
- 출력 형식은 마크다운(frontmatter + 본문)만 허용. JSON/객체 포맷으로 출력하면 실패로 간주해.
- 표는 필요할 때만 간단히 사용
- 마지막 줄에는 반드시 FILENAME: ${fileStem} 형식으로 출력
`;

  let generatedText = '';
  let lastFinishReason = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    const retryHint = attempt > 1
      ? '\n\n[재시도 지시]\n응답이 중간에 끊기지 않게 처음부터 완성본으로 다시 작성하고, 마지막 줄 FILENAME까지 반드시 출력해줘.'
      : '';

    const gemini = await callGemini(`${prompt}${retryHint}`);
    generatedText = gemini.text || '';
    lastFinishReason = gemini.finishReason || '';

    const incomplete = lastFinishReason === 'MAX_TOKENS' || looksIncompleteGeminiOutput(generatedText);
    if (!incomplete) break;
    if (attempt < 3) await sleep(2000);
  }

  if (!generatedText || looksIncompleteGeminiOutput(generatedText)) {
    throw new Error(`Gemini 응답 불완전(finishReason=${lastFinishReason || 'N/A'})`);
  }

  let { filename, finalContent } = normalizeGeneratedMarkdown(generatedText, fileStem, candidate);
  const firstValidationIssues = validateGeneratedRestaurantMarkdown(finalContent);

  if (firstValidationIssues.length > 0) {
    console.warn(`⚠️ 후처리 검증 실패(1차): ${firstValidationIssues.join(' / ')}`);
    const validationFeedback = firstValidationIssues.map((issue) => `- ${issue}`).join('\n');
    const retryPrompt = `${prompt}\n\n[검증 피드백]\n방금 작성한 글에서 아래 문제가 발견되었습니다.\n${validationFeedback}\n지침을 엄수하여 처음부터 다시 작성해 주세요.`;

    try {
      const retryGemini = await callGemini(retryPrompt);
      const retryText = String(retryGemini.text || '').trim();

      if (retryText) {
        const normalizedRetry = normalizeGeneratedMarkdown(retryText, fileStem, candidate);
        filename = normalizedRetry.filename;
        finalContent = normalizedRetry.finalContent;

        const secondValidationIssues = validateGeneratedRestaurantMarkdown(finalContent);
        if (secondValidationIssues.length > 0) {
          console.warn(`⚠️ 후처리 검증 실패(2차, 최종 결과로 저장): ${secondValidationIssues.join(' / ')}`);
        } else {
          console.log('✅ 후처리 검증 통과(2차 재생성)');
        }
      } else {
        console.warn('⚠️ 2차 재생성 응답이 비어 있어 1차 결과를 유지합니다.');
      }
    } catch (error) {
      console.warn(`⚠️ 2차 재생성 호출 실패: ${error?.message || error}`);
    }
  }

  await fs.writeFile(path.join(postsDir, filename), finalContent, 'utf-8');
  console.log(`✅ 맛집 포스트 생성: ${filename} (${candidate.item.name})`);
}

function buildFilteredCandidates(snapshot, existingIds) {
  const rawCandidates = buildRoundRobinCandidates(snapshot.regions || {});
  return rawCandidates
    .filter(({ item }) => item?.id && item?.name)
    .filter(({ item }) => {
      const sourceId = String(item.id);
      if (FORCE_RESTAURANT_SOURCE_IDS.size > 0) {
        return FORCE_RESTAURANT_SOURCE_IDS.has(sourceId);
      }
      return !existingIds.has(sourceId);
    })
    .map(({ region, item }) => ({
      region,
      regionLabel: { incheon: '인천', seoul: '서울', gyeonggi: '경기' }[region] || region,
      areaTag: { incheon: '인천', seoul: '서울', gyeonggi: '경기' }[region] || region,
      item,
    }));
}

function findEmptyBuckets(candidates) {
  const bucketHas = new Map(TARGET_BUCKETS.map((b) => [b, false]));
  for (const c of candidates) {
    const bucket = classifyRegionBucket(c.item);
    bucketHas.set(bucket, true);
  }
  return TARGET_BUCKETS.filter((b) => !bucketHas.get(b));
}

function recollectRestaurants() {
  const collectScript = path.join(process.cwd(), 'scripts', 'collect-life-restaurants.mjs');
  execFileSync(process.execPath, [collectScript], {
    stdio: 'inherit',
    env: process.env,
  });
}

async function run() {
  if (!GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY');
    process.exit(1);
  }

  let snapshot = await readSnapshot();
  const existing = await getExistingRestaurantStats();
  const existingIds = existing.ids;

  let candidates = buildFilteredCandidates(snapshot, existingIds);

  const emptyBuckets = findEmptyBuckets(candidates);
  const needsRecollectByCount = candidates.length < MIN_UNUSED_CANDIDATES;
  const needsRecollectByBucket = emptyBuckets.length > 0;
  const shouldRecollect = FORCE_RESTAURANT_SOURCE_IDS.size === 0 && (needsRecollectByCount || needsRecollectByBucket);

  if (shouldRecollect) {
    const reason = needsRecollectByCount
      ? `unused 후보 ${candidates.length}건으로 기준 ${MIN_UNUSED_CANDIDATES}건 미만`
      : `필수 버킷 후보 부족 (${emptyBuckets.join(', ')})`;
    console.log(`\n🔄 맛집 후보 재수집 시작 — ${reason}`);
    try {
      recollectRestaurants();
      snapshot = await readSnapshot();
      candidates = buildFilteredCandidates(snapshot, existingIds);
      const stillEmpty = findEmptyBuckets(candidates);
      if (stillEmpty.length > 0) {
        console.warn(`⚠️ 재수집 후에도 ${stillEmpty.join(', ')} 버킷 후보 부족 — 다른 버킷에서 재분배합니다.`);
      } else {
        console.log('✅ 재수집으로 모든 버킷 후보 확보 완료');
      }
    } catch (err) {
      console.warn(`⚠️ 맛집 데이터 재수집 실패: ${err.message || err}`);
    }
  }

  const selectedCandidates = selectCandidatesByBucket(candidates, existing.bucketCounts);

  const bucketCountLog = TARGET_BUCKETS
    .map((bucket) => `${bucket}:${existing.bucketCounts.get(bucket) || 0}`)
    .join(', ');

  if (BOOTSTRAP_MIN_PER_BUCKET > 0) {
    console.log(`🥢 부트스트랩 모드: 버킷별 최소 ${BOOTSTRAP_MIN_PER_BUCKET}건 보정 (현재 ${bucketCountLog})`);
  }

  console.log(`🥢 맛집 포스트 생성 후보: ${selectedCandidates.length}건 (목표 ${TARGET_POSTS_PER_RUN}건: 서울/인천/경기기타 각 ${TARGET_POSTS_PER_BUCKET}건)`);
  if (selectedCandidates.length === 0) {
    console.log('생성할 새 맛집 포스트가 없습니다.');
    return;
  }

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < selectedCandidates.length; i++) {
    const candidate = selectedCandidates[i];
    try {
      await generateRestaurantPost(candidate);
      successCount += 1;
    } catch (error) {
      failedCount += 1;
      console.warn(`⚠️ 후보 처리 실패(다음 후보로 계속): ${candidate.item?.name || candidate.item?.id || 'unknown'} / ${error?.message || error}`);
    }

    if (i < selectedCandidates.length - 1) {
      console.log(`  ⏳ ${INTER_REQUEST_DELAY_MS}ms 대기 중...`);
      await sleep(INTER_REQUEST_DELAY_MS);
    }
  }

  console.log(`📌 생성 완료: 성공 ${successCount}건 / 실패 ${failedCount}건`);
}

run().catch((error) => {
  console.error('❌ 맛집 포스트 생성 실패', error);
  process.exit(1);
});
