/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const runFile = promisify(execFile);

const DAILY_THEMES = {
  1: {
    key: 'health',
    name: '건강',
    keywordHint: ['프로바이오틱스', '오메가3', '멀티비타민', '루테인'],
    tags: ['건강', '루틴관리', '자기관리템', '픽앤조이초이스'],
  },
  2: {
    key: 'living',
    name: '생활',
    keywordHint: ['수납 정리함', '청소용품', '생활필수품', '욕실 정리'],
    tags: ['생활용품', '정리템', '실용템', '픽앤조이초이스'],
  },
  3: {
    key: 'kitchen',
    name: '주방',
    keywordHint: ['진공포장기', '프라이팬', '밀폐용기', '에어프라이어 용품'],
    tags: ['주방용품', '식재료보관', '홈쿡', '픽앤조이초이스'],
  },
  4: {
    key: 'digital',
    name: '디지털',
    keywordHint: ['무선이어폰', '보조배터리', '무선마우스', '블루투스 키보드'],
    tags: ['디지털', '데스크셋업', '생산성', '픽앤조이초이스'],
  },
  5: {
    key: 'pet-life',
    name: '반려 생활',
    keywordHint: ['고양이 사료', '강아지 간식', '반려동물 배변패드', '펫 케어'],
    tags: ['반려생활', '펫케어', '반려템', '픽앤조이초이스'],
  },
  6: {
    key: 'beauty-fashion',
    name: '뷰티/패션',
    keywordHint: ['헤어 케어', '선크림', '이너웨어', '패션 소품'],
    tags: ['뷰티', '패션', '데일리템', '픽앤조이초이스'],
  },
  0: {
    key: 'home-appliance-furniture',
    name: '가전/가구',
    keywordHint: ['스탠드 조명', '의자', '소형 가전', '수납 가구'],
    tags: ['가전', '가구', '홈리빙', '픽앤조이초이스'],
  },
};

function getTodayKstDate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function getKstWeekdayNumber() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCDay();
}

function getDailyTheme() {
  const explicit = Number(process.env.CHOICE_AUTO_THEME_DAY || Number.NaN);
  const weekday = Number.isInteger(explicit) && explicit >= 0 && explicit <= 6
    ? explicit
    : getKstWeekdayNumber();

  const theme = DAILY_THEMES[weekday];
  if (!theme) {
    throw new Error(`요일(${weekday})에 매핑된 초이스 테마가 없습니다.`);
  }

  return { weekday, theme };
}

async function buildTempInput(themeInfo, dateKst) {
  const { theme, weekday } = themeInfo;
  const englishName = slugify(`${theme.key}-${dateKst}`);
  const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const weekdayKo = weekdayNames[weekday] || '요일';
  const payload = {
    title: `${weekdayKo}요일 픽앤조이 초이스 | ${theme.name} 카테고리 실시간 인기 상품 큐레이션`,
    englishName,
    summary: `${theme.name} 테마에서 쿠팡 판매량 상위권 상품 중 중복 필터와 품질 필터를 통과한 신규 아이템 3개를 엄선한 픽앤조이 초이스입니다.`,
    brand: '픽앤조이 초이스',
    rating: '4.7',
    reviewCount: '100',
    keywordHint: theme.keywordHint || [],
    tags: Array.isArray(theme.tags) ? [...theme.tags, '쿠팡', '리뷰'] : ['쿠팡', '리뷰', '픽앤조이초이스'],
    themeKey: theme.key,
    themeName: theme.name,
    outputFileName: `${dateKst}-choice-${englishName}.md`,
  };

  const tempPath = path.join(os.tmpdir(), `picknjoy-choice-auto-${Date.now()}.json`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
  return { tempPath, payload };
}

async function run() {
  const enabled = (process.env.CHOICE_AUTO_ENABLED || 'true').toLowerCase() === 'true';
  if (!enabled) {
    console.log('CHOICE_AUTO_ENABLED=false 이므로 자동 초이스 생성을 건너뜁니다.');
    return;
  }

  const dateKst = getTodayKstDate();
  const themeInfo = getDailyTheme();
  const { tempPath, payload } = await buildTempInput(themeInfo, dateKst);

  try {
    console.log(`자동 초이스 요일 테마: ${themeInfo.theme.name} (${themeInfo.theme.key})`);
    console.log(`자동 키워드: ${(payload.keywordHint || []).join(', ') || '없음'}`);

    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-choice-post.js');
    const { stdout, stderr } = await runFile(process.execPath, [scriptPath, '--input', tempPath], {
      cwd: process.cwd(),
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

run().catch((error) => {
  console.error(`❌ 자동 초이스 생성 실패: ${error.message}`);
  process.exit(1);
});