const fs = require('fs/promises');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 120000);
const TOUR_API_KEY = process.env.TOUR_API_KEY || '';

const FORCE_RUN = process.env.FESTIVAL_VERSUS_FORCE === 'true';
const FORCED_MODE = String(process.env.FESTIVAL_VERSUS_MODE || 'weekend').trim().toLowerCase();
const ENABLE_FRIDAY = process.env.FESTIVAL_VERSUS_ENABLE_FRIDAY !== 'false';
const ENABLE_HOLIDAY_EVE = process.env.FESTIVAL_VERSUS_ENABLE_HOLIDAY_EVE !== 'false';
const HOLIDAY_MIN_STREAK = Number(process.env.FESTIVAL_VERSUS_HOLIDAY_MIN_STREAK || 2);

const WEEKEND_PICK_COUNT = Math.max(2, Number(process.env.FESTIVAL_VERSUS_WEEKEND_COUNT || 2));
const HOLIDAY_PICK_COUNT = Math.max(2, Math.min(3, Number(process.env.FESTIVAL_VERSUS_HOLIDAY_COUNT || 3)));

const BLOG_PUBLISHED_BY = String(process.env.BLOG_PUBLISHED_BY || 'auto').trim().toLowerCase() === 'manual' ? 'manual' : 'auto';
const DEFAULT_IMAGE = 'https://pick-n-joy.com/images/default-festival.svg';

function toKstDate(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(isoDate, days) {
  const base = new Date(`${isoDate}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  const yyyy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDayOfWeekKst(isoDate) {
  const d = new Date(`${isoDate}T00:00:00+09:00`);
  return d.getDay();
}

function isoToCompact(isoDate) {
  return String(isoDate || '').replace(/-/g, '');
}

function normalizeDateToIso(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(text)) return text.replace(/\./g, '-');
  return '';
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function uniqueUrls(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const url = String(value || '').trim();
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function shareSameBaseImage(urlA, urlB) {
  if (!urlA || !urlB) return false;
  if (urlA === urlB) return true;
  const extract = (u) => {
    const m = String(u).match(/\/(\d{6,})_image\d+_\d+\.[a-zA-Z]+$/);
    return m ? m[1] : '';
  };
  const a = extract(urlA);
  const b = extract(urlB);
  return Boolean(a && b && a === b);
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？…])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function fetchPublicHolidays(year) {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/KR`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((row) => String(row.date || '').trim()).filter(Boolean);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function buildHolidaySet(todayIso) {
  const year = Number(todayIso.slice(0, 4));
  const [y1, y2] = await Promise.all([fetchPublicHolidays(year), fetchPublicHolidays(year + 1)]);
  return new Set([...y1, ...y2]);
}

function isNonWorkingDay(isoDate, holidaySet) {
  const day = getDayOfWeekKst(isoDate);
  const weekend = day === 0 || day === 6;
  const holiday = holidaySet.has(isoDate);
  return weekend || holiday;
}

function getNonWorkingStreakFrom(startIso, holidaySet, maxDays = 7) {
  let streak = 0;
  for (let i = 0; i < maxDays; i += 1) {
    const day = addDays(startIso, i);
    if (!isNonWorkingDay(day, holidaySet)) break;
    streak += 1;
  }
  return streak;
}

function decideRunMode(todayIso, holidaySet) {
  if (FORCE_RUN) return FORCED_MODE === 'holiday' ? 'holiday' : 'weekend';

  const day = getDayOfWeekKst(todayIso);
  if (ENABLE_FRIDAY && day === 5) return 'weekend';

  if (ENABLE_HOLIDAY_EVE) {
    const tomorrow = addDays(todayIso, 1);
    if (isNonWorkingDay(tomorrow, holidaySet)) {
      const streak = getNonWorkingStreakFrom(tomorrow, holidaySet, 7);
      if (streak >= HOLIDAY_MIN_STREAK) return 'holiday';
    }
  }

  return 'skip';
}

function chooseFestivals(items, todayIso, count) {
  const todayCompact = isoToCompact(todayIso);

  const active = items
    .filter((item) => !item.expired)
    .filter((item) => {
      const endIso = normalizeDateToIso(item.eventenddate || item.endDate);
      if (!endIso) return true;
      return isoToCompact(endIso) >= todayCompact;
    })
    .map((item) => {
      const startIso = normalizeDateToIso(item.eventstartdate || item.startDate);
      const views = Number(String(item['조회수'] ?? item.viewCount ?? item.hit ?? 0).replace(/,/g, '')) || 0;
      const hasImage = item.firstimage || item.firstimage2 ? 1 : 0;

      let distanceScore = 9999;
      if (startIso) {
        const diff = Math.abs(new Date(`${startIso}T00:00:00Z`).getTime() - new Date(`${todayIso}T00:00:00Z`).getTime());
        distanceScore = Math.floor(diff / (1000 * 60 * 60 * 24));
      }

      return {
        ...item,
        _views: views,
        _hasImage: hasImage,
        _distanceScore: distanceScore,
      };
    })
    .sort((a, b) => {
      if (a._distanceScore !== b._distanceScore) return a._distanceScore - b._distanceScore;
      if (a._hasImage !== b._hasImage) return b._hasImage - a._hasImage;
      if (a._views !== b._views) return b._views - a._views;
      return String(b.modifiedtime || b.updatedAt || '').localeCompare(String(a.modifiedtime || a.updatedAt || ''));
    });

  const picked = [];
  const seenRegion = new Set();

  for (const item of active) {
    const region = String(item.lDongRegnCd || item.areacode || '').trim();
    if (region && seenRegion.has(region) && active.length > count + 2) continue;
    picked.push(item);
    if (region) seenRegion.add(region);
    if (picked.length >= count) break;
  }

  if (picked.length < count) {
    for (const item of active) {
      if (picked.includes(item)) continue;
      picked.push(item);
      if (picked.length >= count) break;
    }
  }

  return picked.slice(0, count);
}

async function fetchTourDetailImages(contentId) {
  if (!contentId || !TOUR_API_KEY) return [];

  const url = `https://apis.data.go.kr/B551011/KorService2/detailImage2?serviceKey=${TOUR_API_KEY}&MobileOS=ETC&MobileApp=pick-n-joy&_type=json&contentId=${contentId}&imageYN=Y&numOfRows=20&pageNo=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.response?.body?.items?.item;
    const arr = Array.isArray(items) ? items : items ? [items] : [];
    return uniqueUrls(arr.map((it) => it.originimgurl || it.smallimageurl || ''));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function enrichCandidateImages(candidate) {
  const detailImages = await fetchTourDetailImages(candidate.contentid || '');
  const pool = uniqueUrls([
    candidate.firstimage,
    candidate.firstimage2,
    ...detailImages,
  ]);

  return {
    ...candidate,
    _imagePool: pool,
  };
}

function selectHeroImage(candidates, todayIso) {
  const pool = uniqueUrls(candidates.flatMap((item) => item._imagePool || []));
  if (pool.length === 0) return DEFAULT_IMAGE;
  const seed = `${todayIso}|${candidates.map((c) => c.contentid || c.title || '').join('|')}`;
  const idx = hashString(seed) % pool.length;
  return pool[idx];
}

function selectBodyImage(candidate, heroImage) {
  const pool = candidate._imagePool || [];
  if (pool.length === 0) return DEFAULT_IMAGE;
  if (pool.length === 1) return pool[0];

  const noHero = pool.find((img) => !shareSameBaseImage(img, heroImage));
  return noHero || pool[0];
}

function buildPeriodText(candidate) {
  const startIso = normalizeDateToIso(candidate.eventstartdate || candidate.startDate);
  const endIso = normalizeDateToIso(candidate.eventenddate || candidate.endDate);
  if (startIso && endIso) return `${startIso} ~ ${endIso}`;
  return startIso || endIso || '현장 공지 확인';
}

function buildKakaoMapSearchLink(candidate) {
  const title = String(candidate.title || '').trim();
  const mapx = String(candidate.mapx || '').trim();
  const mapy = String(candidate.mapy || '').trim();
  const addr = String(candidate.addr1 || '').trim();

  const lngNum = parseFloat(mapx);
  const latNum = parseFloat(mapy);
  if (!isNaN(lngNum) && !isNaN(latNum) && lngNum > 100 && latNum > 30) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(title || addr || '축제 장소')},${latNum},${lngNum}`;
  }

  if (addr) {
    return `https://map.kakao.com/link/search/${encodeURIComponent(addr)}`;
  }

  return `https://map.kakao.com/link/search/${encodeURIComponent(title || '축제')}`;
}

function deriveVibe(candidate) {
  const text = `${candidate.title || ''} ${candidate.overview || ''}`;
  if (/전통|제례|문화재|고궁/.test(text)) return '웅장하고 정갈한 전통 무드';
  if (/어린이|체험|가족|도자/.test(text)) return '아기자기하고 체험 중심 무드';
  if (/공연|페스티벌|축하|행사|야외/.test(text)) return '활기차고 에너지 넘치는 무드';
  return '여유롭게 즐기기 좋은 지역 무드';
}

function deriveAccess(candidate) {
  const addr = String(candidate.addr1 || '').trim();
  if (!addr) return '축제장 인근 교통편은 사전 확인이 필요해요';
  if (addr.includes('서울')) return '도심 대중교통 접근이 좋아서 뚜벅이 이동이 쉬워요';
  if (addr.includes('광주')) return '박물관/전시권역 중심이라 가족 단위 이동이 편해요';
  if (addr.includes('보령')) return '자가용 이동 시 주차 동선과 혼잡 시간 체크가 중요해요';
  return '현장 주변 도로·주차 상황을 미리 확인하면 훨씬 수월해요';
}

function deriveStay(candidate) {
  const startIso = normalizeDateToIso(candidate.eventstartdate || candidate.startDate);
  const endIso = normalizeDateToIso(candidate.eventenddate || candidate.endDate);
  if (startIso && endIso) {
    const days = Math.max(1, Math.floor((new Date(`${endIso}T00:00:00Z`).getTime() - new Date(`${startIso}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24)) + 1);
    if (days <= 2) return '짧고 굵게 반나절~하루 코스로 다녀오기 좋아요';
    return '반나절 체험부터 하루 코스까지 유연하게 짜기 좋아요';
  }
  return '현장 프로그램 기준으로 반나절~하루 동선을 추천해요';
}

function makeThreeLines(lines, fallbackLines) {
  const merged = [...(lines || []), ...(fallbackLines || [])].map((line) => String(line || '').trim()).filter(Boolean);
  const out = [];
  for (const line of merged) {
    out.push(line);
    if (out.length >= 3) break;
  }
  while (out.length < 3) {
    out.push('현장 공지와 공식 안내를 함께 확인하면 더 안정적으로 즐길 수 있어요.');
  }
  return out;
}

function buildPersonaHeading(slot, title) {
  const templatesBySlot = [
    [
      `🏛️ 역사의 숨결 속에서 품격 있는 산책을 원하시나요?`,
      `🤔 조용한 사색이 필요한 오늘, ${title}는 어떠세요?`,
      `✨ 천천히 걷고 깊이 느끼는 무드를 찾는다면?`,
    ],
    [
      `🎨 아이의 상상력이 자라는 시간을 선물하고 싶다면?`,
      `👨‍👩‍👧‍👦 손에 흙 묻히며 추억을 빚고 싶은 가족이라면?`,
      `📍 아기자기한 체험형 축제를 찾는다면 눈여겨보세요`,
    ],
    [
      `🔥 지루할 틈 없는 에너지 충전형 연휴를 원하시나요?`,
      `🏃‍♂️ 오늘만큼은 액티브하게, 몸으로 즐기고 싶다면?`,
      `⚡ 온 가족 스트레스를 날리는 활기찬 코스를 찾는다면?`,
    ],
  ];

  const seed = hashString(`${slot}|${title}`);
  const pool = templatesBySlot[Math.min(slot, templatesBySlot.length - 1)];
  return pool[seed % pool.length];
}

function buildCandidateParagraphs(candidate, slot) {
  const title = String(candidate.title || '이 축제').trim();
  const overviewSentences = splitSentences(candidate.overview || '');
  const p1Lines = makeThreeLines(
    overviewSentences.slice(0, 3),
    [
      `${title}는 현장 분위기 자체가 분명해서 첫인상이 선명하게 남는 편이에요.`,
      `행사 동선이 비교적 단순해 처음 가는 분도 무리 없이 즐기기 좋아요.`,
      `핵심 프로그램만 잘 고르면 짧은 시간에도 만족도가 높은 편이에요.`,
    ],
  );

  const personaBySlot = [
    '부모님 또는 연인과 정갈한 시간을 보내고 싶은 분',
    '아이와 함께 체험 중심의 하루를 보내고 싶은 가족',
    '에너지 넘치는 일정으로 연휴를 꽉 채우고 싶은 가족',
  ];

  const p2Lines = makeThreeLines(
    [
      `${personaBySlot[Math.min(slot, personaBySlot.length - 1)]}에게 특히 잘 맞는 코스예요.`,
      `${deriveAccess(candidate)} 특히 피크 시간대를 피하면 체감 만족도가 더 올라가요.`,
      `${deriveStay(candidate)} 사진 포인트와 휴식 타이밍을 함께 잡으면 동선이 깔끔해져요.`,
    ],
    [
      `동행자의 연령대와 취향을 먼저 정하면 행사 선택이 훨씬 쉬워져요.`,
      `주차·교통·현장 프로그램 시작 시간을 같이 확인하면 대기 스트레스를 줄일 수 있어요.`,
      `공식 공지 기준으로 당일 변동 가능성을 체크하면 더 안정적으로 즐길 수 있어요.`,
    ],
  );

  return {
    paragraph1: p1Lines.join('\n'),
    paragraph2: p2Lines.join('\n'),
  };
}

function buildComparisonHeading(mode, candidates) {
  const options = [
    '🔍 오늘의 나들이 결정 카드를 펼쳐볼게요',
    '📍 어디로 갈까? 한눈에 보는 테마별 비교',
    '📝 픽앤조이 에디터의 30초 퀵-스코어',
    '⚖️ 분위기부터 체류시간까지, 핵심만 콕!',
  ];
  const seed = hashString(`${mode}|${candidates.map((c) => c.contentid || c.title || '').join('|')}`);
  return options[seed % options.length];
}

function buildIntro(mode, candidates) {
  const targetLabel = mode === 'holiday' ? '연휴' : '주말';
  const titles = candidates.map((c) => c.title).filter(Boolean);
  const joined = titles.length === 2
    ? `${titles[0]}와 ${titles[1]}`
    : `${titles[0]}, ${titles[1]}, ${titles[2]}`;

  return [
    `## 이번 ${targetLabel}, 어디로 가야 후회 없을까요?`,
    `${joined} 사이에서 고민이라면, 오늘은 “내 상황에 더 맞는 선택” 기준으로 같이 정리해볼게요.`,
    `단순 정보 나열이 아니라 분위기·이동·체류시간을 기준으로 비교해서, 바로 결정할 수 있게 도와드릴게요.`,
  ].join('\n\n');
}

function buildFinalGuide(mode, candidates) {
  const targetLabel = mode === 'holiday' ? '연휴' : '주말';
  const tags = candidates.map((c) => `#${String(c.title || '').replace(/\s+/g, '')}`);

  const lines = [
    '### 💡 에디터 성우의 한 줄 정리',
    `${targetLabel}에 차분한 결을 느끼고 싶다면 ${tags[0]}를,`,
    `체험 중심으로 손에 잡히는 추억을 만들고 싶다면 ${tags[1]}를,`,
  ];

  if (tags[2]) {
    lines.push(`온 가족의 에너지를 시원하게 풀고 싶다면 ${tags[2]}를 추천해요!`);
  } else {
    lines.push(`동행 취향이 갈린다면 이동 편의가 더 좋은 쪽을 우선 선택해보세요.`);
  }

  return lines.join('\n\n');
}

function buildVersusBody({ mode, candidates, heroImage, bodyImages }) {
  const comparisonHeading = buildComparisonHeading(mode, candidates);
  const columnEmojis = ['🏛️', '🎨', '🔥'];
  const safeCell = (value) => String(value || '').replace(/\|/g, '/').trim();
  const candidateHeaders = candidates.map((candidate, idx) => `${columnEmojis[idx] || '📍'} ${safeCell(candidate.title || `후보 ${idx + 1}`)}`);
  const tableSeparator = ['---', ...candidates.map(() => '---')].join(' | ');
  const row = (label, valueFn) => `| ${label} | ${candidates.map((c) => safeCell(valueFn(c))).join(' | ')} |`;
  const comparisonTable = [
    `| 비교 항목 | ${candidateHeaders.join(' | ')} |`,
    `| ${tableSeparator} |`,
    row('✨ 바이브 (분위기)', deriveVibe),
    row('🚗 가는 길 (이동·접근성)', deriveAccess),
    row('⏳ 머무는 시간 (체류감)', deriveStay),
  ].join('\n');

  const detailSections = candidates.map((candidate, index) => {
    const personaHeading = buildPersonaHeading(index, candidate.title || '이 축제');
    const sectionTitle = `### ${personaHeading}`;
    const eventHeading = `#### ${candidate.title || `후보 ${index + 1}`}`;
    const bodyImage = bodyImages[index] || DEFAULT_IMAGE;
    const period = buildPeriodText(candidate);
    const addr = String(candidate.addr1 || '현장 공지 확인').trim();
    const tel = String(candidate.tel || '현장 공지 확인').trim();
    const mapLink = buildKakaoMapSearchLink(candidate);
    const { paragraph1, paragraph2 } = buildCandidateParagraphs(candidate, index);

    return [
      sectionTitle,
      eventHeading,
      `![${candidate.title || '축제'} 현장 이미지](${bodyImage})`,
      `- 📅 행사 기간: ${period}`,
      `- 📍 주소: ${addr}`,
      `- 📞 문의: ${tel}`,
      '',
      paragraph1,
      '',
      paragraph2,
      '',
      `👉 [카카오맵 바로가기](${mapLink})`,
    ].join('\n');
  });

  const detailLinks = [
    '### 🔎 구체적인 정보 더 보기',
    ...candidates.map((candidate) => `- [${candidate.title}](/festival/${candidate.contentid})`),
  ].join('\n');

  return [
    buildIntro(mode, candidates),
    `### ${comparisonHeading}`,
    comparisonTable,
    ...detailSections,
    buildFinalGuide(mode, candidates),
    detailLinks,
  ].join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildGeminiFrontmatterPrompt({ mode, todayIso, candidates }) {
  const targetLabel = mode === 'holiday' ? '이번 연휴' : '이번 주말';
  const sourceJson = JSON.stringify(candidates.map((item) => ({
    title: item.title,
    eventstartdate: item.eventstartdate,
    eventenddate: item.eventenddate,
    addr1: item.addr1,
    overview: item.overview,
  })), null, 2);

  return `아래 데이터로 비교형 축제 블로그 frontmatter를 작성해줘.\n후보 데이터:\n${sourceJson}\n\n반드시 아래 형식만 출력:\n---\ntitle: "${targetLabel}에는 ${candidates[0]?.title || '축제 A'}${candidates[1] ? ` vs ${candidates[1].title}` : ''}${candidates[2] ? ` vs ${candidates[2].title}` : ''}, 어디가 더 맞을까요?"\ndate: ${todayIso}\nsummary: (130~160자, 사용자 의사결정 중심)\ndescription: (summary와 동일)\ncategory: 전국 축제·여행\npublished_by: ${BLOG_PUBLISHED_BY}\ntags: [전국 축제·여행, 비교 분석, ${targetLabel}]\n---\n\nFILENAME: YYYY-MM-DD-festival-versus-....md`;
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) return '';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!res.ok) return '';
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

function splitMarkdownSections(markdown) {
  const normalized = String(markdown || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized.startsWith('---\n')) return { frontmatter: '', body: normalized };
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return { frontmatter: '', body: normalized };
  return {
    frontmatter: normalized.slice(0, end + 5),
    body: normalized.slice(end + 5).trim(),
  };
}

function removeCodeFence(text) {
  let output = String(text || '').trim();
  if (output.startsWith('```markdown')) output = output.slice(11).trim();
  else if (output.startsWith('```')) output = output.slice(3).trim();
  if (output.endsWith('```')) output = output.slice(0, -3).trim();
  return output;
}

function extractFrontmatterValue(content, key) {
  const m = String(content || '').match(new RegExp(`^${key}:\\s*(.+)\\s*$`, 'm'));
  if (!m) return '';
  return m[1].trim().replace(/^['"]|['"]$/g, '');
}

function quoteYaml(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim()}"`;
}

async function getExistingVersusKeys(postsDir) {
  const keys = new Set();
  const files = await fs.readdir(postsDir);

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const content = await fs.readFile(path.join(postsDir, file), 'utf-8');
    const contentType = extractFrontmatterValue(content, 'content_type');
    if (contentType !== 'festival-versus') continue;

    const versusKey = extractFrontmatterValue(content, 'versus_key');
    if (versusKey) keys.add(versusKey);
  }

  return keys;
}

function buildVersusKey(mode, ids) {
  const sorted = [...ids].map((v) => String(v || '').trim()).filter(Boolean).sort();
  return `${mode}|${sorted.join(',')}`;
}

function buildFallbackFrontmatter({ title, todayIso, summary }) {
  return [
    '---',
    `title: "${String(title || '').replace(/"/g, '\\"')}"`,
    `date: ${todayIso}`,
    `summary: "${String(summary || '').replace(/"/g, '\\"')}"`,
    `description: "${String(summary || '').replace(/"/g, '\\"')}"`,
    'category: 전국 축제·여행',
    `published_by: ${BLOG_PUBLISHED_BY}`,
    'tags: [전국 축제·여행, 비교 분석, 이번 주말]',
    '---',
  ].join('\n');
}

async function run() {
  const todayIso = toKstDate();
  const holidaySet = await buildHolidaySet(todayIso);
  const mode = decideRunMode(todayIso, holidaySet);

  console.log(`festival-versus mode=${mode} (today=${todayIso})`);

  if (mode === 'skip') {
    console.log('금요일/연휴 전 조건 미충족: 생성 건너뜀');
    return;
  }

  const festivalPath = path.join(process.cwd(), 'public', 'data', 'festival.json');
  const raw = await fs.readFile(festivalPath, 'utf-8');
  const festivals = JSON.parse(raw);

  const pickCount = mode === 'holiday' ? HOLIDAY_PICK_COUNT : WEEKEND_PICK_COUNT;
  const baseCandidates = chooseFestivals(festivals, todayIso, pickCount);

  if (baseCandidates.length < 2) {
    console.log(`비교형 생성 후보 부족: ${baseCandidates.length}건`);
    return;
  }

  const candidates = await Promise.all(baseCandidates.map((candidate) => enrichCandidateImages(candidate)));

  const postsDir = path.join(process.cwd(), 'src', 'content', 'posts');
  await fs.mkdir(postsDir, { recursive: true });

  const sourceIds = candidates.map((item) => String(item.contentid || '').trim()).filter(Boolean);
  const versusKey = buildVersusKey(mode, sourceIds);
  const existingKeys = await getExistingVersusKeys(postsDir);

  if (existingKeys.has(versusKey)) {
    console.log(`동일 후보 조합의 festival-versus 이미 존재: ${versusKey}`);
    return;
  }

  const heroImage = selectHeroImage(candidates, todayIso);
  const bodyImages = candidates.map((candidate) => selectBodyImage(candidate, heroImage));

  const targetLabel = mode === 'holiday' ? '이번 연휴' : '이번 주말';
  const defaultTitle = `${targetLabel}에는 ${candidates.map((c) => c.title).join(' vs ')}, 어디가 더 맞을까요?`;
  const defaultSummary = `${targetLabel} 일정에서 고민되는 ${candidates.map((c) => c.title).join(', ')}를 분위기·이동·체류시간 기준으로 비교해 지금 바로 선택할 수 있게 정리했어요.`;

  const prompt = buildGeminiFrontmatterPrompt({ mode, todayIso, candidates });
  const generated = removeCodeFence(await callGemini(prompt));

  let filename = '';
  const contentLines = [];
  for (const line of generated.split('\n')) {
    if (line.trim().startsWith('FILENAME:')) {
      filename = line.replace('FILENAME:', '').trim();
    } else {
      contentLines.push(line);
    }
  }

  const generatedMarkdown = contentLines.join('\n').trim();
  const parsed = splitMarkdownSections(generatedMarkdown);
  const fallbackFrontmatter = buildFallbackFrontmatter({
    title: defaultTitle,
    todayIso,
    summary: defaultSummary,
  });

  const baseFrontmatter = parsed.frontmatter || fallbackFrontmatter;

  if (!filename) {
    const modeLabel = mode === 'holiday' ? 'holiday' : 'weekend';
    filename = `${todayIso}-festival-versus-${modeLabel}-selection.md`;
  }
  if (!filename.endsWith('.md')) filename += '.md';

  const structuredBody = buildVersusBody({ mode, candidates, heroImage, bodyImages });

  const fmTitle = extractFrontmatterValue(baseFrontmatter, 'title') || defaultTitle;
  const fmSummary = extractFrontmatterValue(baseFrontmatter, 'summary') || defaultSummary;
  const fmDescription = extractFrontmatterValue(baseFrontmatter, 'description') || fmSummary;
  const fmTags = extractFrontmatterValue(baseFrontmatter, 'tags') || `[전국 축제·여행, 비교 분석, ${targetLabel}]`;

  const normalizedFrontmatter = [
    '---',
    `title: ${quoteYaml(fmTitle)}`,
    `date: ${todayIso}`,
    `summary: ${quoteYaml(fmSummary)}`,
    `description: ${quoteYaml(fmDescription)}`,
    'category: 전국 축제·여행',
    `published_by: ${BLOG_PUBLISHED_BY}`,
    `tags: ${fmTags}`,
    `image: ${quoteYaml(heroImage)}`,
    'content_type: festival-versus',
    `versus_mode: ${mode}`,
    `versus_key: ${quoteYaml(versusKey)}`,
    `source_ids: ${quoteYaml(sourceIds.join(','))}`,
    '---',
  ].join('\n');

  const finalContent = `${normalizedFrontmatter}\n\n${structuredBody}`.replace(/\n{3,}/g, '\n\n').trim();

  const outputPath = path.join(postsDir, filename);
  await fs.writeFile(outputPath, finalContent, 'utf-8');

  console.log(`✅ festival-versus 생성 완료: ${filename}`);
  console.log(`   mode=${mode} / hero=${heroImage}`);
  console.log(`   candidates=${candidates.map((item) => item.title).join(' | ')}`);
}

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
