const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&#034;|&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

async function run() {
  loadEnvLocal();

  const token = process.env.INCHEON_PHOTO_TOKEN;
  const endpoint = process.env.INCHEON_PHOTO_API_URL || 'https://api.incheoneasy.com/api/tour/touristPhotoInfo';
  const keyword = process.argv[2] || '송도';

  if (!token) {
    console.error('Missing INCHEON_PHOTO_TOKEN');
    process.exit(1);
  }

  const params = new URLSearchParams({
    accessToken: token,
    pageNo: '1',
    trrsrtNm: keyword,
  });

  const url = `${endpoint}?${params.toString()}`;
  const response = await fetch(url);
  const raw = await response.text();

  if (!response.ok) {
    console.error(`HTTP ${response.status}`);
    console.error(raw.slice(0, 500));
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(decodeHtmlEntities(raw));
  } catch (err) {
    console.error('JSON parse failed');
    console.error(raw.slice(0, 500));
    process.exit(1);
  }

  const list = Array.isArray(data.dataList) ? data.dataList : [];
  console.log(`[incheon-photo] returnCode=${data.returnCode} returnMsg=${data.returnMsg}`);
  console.log(`[incheon-photo] expireDt=${data.expireDt || '-'} totalCnt=${data.totalCnt || 0} dataList=${list.length}`);

  if (!list.length) {
    console.log('[incheon-photo] 결과가 없어도 토큰/호출 자체는 정상일 수 있습니다. 키워드를 바꿔 재시도하세요.');
    return;
  }

  const first = list[0] || {};
  console.log('[incheon-photo] sample:', {
    trrsrtId: first.trrsrtId,
    trrsrtNm: first.trrsrtNm,
    trrsrtAddr: first.trrsrtAddr,
    photoFileCours: first.photoFileCours,
  });
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
