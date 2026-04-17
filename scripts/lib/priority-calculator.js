/**
 * Priority Calculator for SSG Head + CSR Tail Strategy
 * 
 * Top N 항목만 정적 생성, 나머지는 CSR로 전환
 * 최종 배포 파일 수 < 15,000 목표
 */

const fs = require('fs');
const path = require('path');

/**
 * 두 날짜 문자열 비교 (YYYYMMDD 또는 YYYYMMDDHHMMSS 형식)
 * @param {string} dateStr1 - 첫 번째 날짜
 * @param {string} dateStr2 - 두 번째 날짜
 * @returns {number} dateStr1 < dateStr2 면 음수, 같으면 0, 크면 양수
 */
function compareDates(dateStr1, dateStr2) {
  const normalize = (str) => {
    if (!str || typeof str !== 'string') return '0';
    return str.substring(0, 8); // YYYYMMDD만 추출
  };
  
  const d1 = normalize(dateStr1);
  const d2 = normalize(dateStr2);
  
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
}

/**
 * Incheon (인천 정보) - Top N 추출
 * 기준: 최신순 + 조회수 상위
 */
function getTopIncheon(items = [], limit = 500) {
  if (!Array.isArray(items)) return [];
  
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  // expired 항목 제외
  const active = items.filter(item => !item.expired);
  
  // 최신순(등록일시 기준) + 조회수 상위로 정렬
  const sorted = active.sort((a, b) => {
    const scoreA = (b.조회수 || 0) * 1000 + (b.등록일시 ? parseInt(b.등록일시.substring(0, 8)) : 0);
    const scoreB = (a.조회수 || 0) * 1000 + (a.등록일시 ? parseInt(a.등록일시.substring(0, 8)) : 0);
    return scoreA - scoreB;
  });
  
  return sorted.slice(0, limit);
}

/**
 * Subsidy (보조금) - Top N 추출
 * 기준: 마감일 임박순 > 최신순 > 조회수 상위
 */
function getTopSubsidy(items = [], limit = 800) {
  if (!Array.isArray(items)) return [];
  
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  // expired 항목 제외
  const active = items.filter(item => !item.expired);
  
  // 카테고리별 분류
  const hasDeadline = [];
  const noDeadline = [];
  
  for (const item of active) {
    const deadline = item.신청기한;
    
    // "신청불필요", "상시신청", "모집시기별 상이" 등은 마감일 없는 것으로 분류
    if (deadline && 
        !deadline.includes('신청불필요') && 
        !deadline.includes('상시신청') && 
        !deadline.includes('모집시기별 상이') &&
        deadline.match(/\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}/)) {
      hasDeadline.push(item);
    } else {
      noDeadline.push(item);
    }
  }
  
  // 마감일이 있는 항목: 마감일 임박순
  hasDeadline.sort((a, b) => {
    const deadlineA = a.신청기한.match(/\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}/)?.[0] || '';
    const deadlineB = b.신청기한.match(/\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}/)?.[0] || '';
    
    const normA = deadlineA.replace(/[.\/-]/g, '');
    const normB = deadlineB.replace(/[.\/-]/g, '');
    
    // 마감일이 임박한 순서 (오늘에 가까운 순)
    if (normA === normB) return 0;
    if (normA < today) return 1; // 이미 지난 것은 뒤로
    if (normB < today) return -1;
    return normA.localeCompare(normB); // 임박한 것부터
  });
  
  // 마감일 없는 항목: 최신순 + 조회수 상위
  noDeadline.sort((a, b) => {
    const scoreA = (b.조회수 || 0) * 1000 + (b.등록일시 ? parseInt(b.등록일시.substring(0, 8)) : 0);
    const scoreB = (a.조회수 || 0) * 1000 + (a.등록일시 ? parseInt(a.등록일시.substring(0, 8)) : 0);
    return scoreA - scoreB;
  });
  
  // 마감일 있는 항목의 상위 40% + 없는 항목의 상위 60% 배분
  const deadlineTopN = Math.floor(limit * 0.4);
  const noDeadlineTopN = limit - deadlineTopN;
  
  return [
    ...hasDeadline.slice(0, deadlineTopN),
    ...noDeadline.slice(0, noDeadlineTopN)
  ];
}

/**
 * Festival (축제) - Top N 추출
 * 기준: 시작일 임박순 (오늘부터 6개월 내)
 */
function getTopFestival(items = [], limit = 300) {
  if (!Array.isArray(items)) return [];
  
  const today = new Date();
  const sixMonthsLater = new Date(today.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
  
  const todayStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const futureStr = sixMonthsLater.toISOString().slice(0, 10).replace(/-/g, '');
  
  // expired 항목 제외, 미래 축제만 선택
  const active = items.filter(item => {
    if (item.expired) return false;
    
    const eventStart = item.eventstartdate ? String(item.eventstartdate).substring(0, 8) : '';
    const eventEnd = item.eventenddate ? String(item.eventenddate).substring(0, 8) : '';
    
    // 축제가 아직 진행 중이거나 미래인 경우
    return eventEnd >= todayStr;
  });
  
  // 시작일 순서대로 정렬 (가까운 것부터)
  active.sort((a, b) => {
    const startA = a.eventstartdate ? String(a.eventstartdate).substring(0, 8) : '99999999';
    const startB = b.eventstartdate ? String(b.eventstartdate).substring(0, 8) : '99999999';
    return startA.localeCompare(startB);
  });
  
  return active.slice(0, limit);
}

/**
 * 모든 카테고리의 Top N 항목 ID 배열 추출
 */
function getAllTopIds() {
  try {
    const incheonPath = path.join(process.cwd(), 'public', 'data', 'incheon.json');
    const subsidyPath = path.join(process.cwd(), 'public', 'data', 'subsidy.json');
    const festivalPath = path.join(process.cwd(), 'public', 'data', 'festival.json');
    
    const incheonData = JSON.parse(fs.readFileSync(incheonPath, 'utf-8')) || [];
    const subsidyData = JSON.parse(fs.readFileSync(subsidyPath, 'utf-8')) || [];
    const festivalData = JSON.parse(fs.readFileSync(festivalPath, 'utf-8')) || [];
    
    const topIncheon = getTopIncheon(incheonData, 500);
    const topSubsidy = getTopSubsidy(subsidyData, 800);
    const topFestival = getTopFestival(festivalData, 300);
    
    return {
      incheon: new Set(topIncheon.map(item => item.서비스ID)),
      subsidy: new Set(topSubsidy.map(item => item.서비스ID)),
      festival: new Set(topFestival.map(item => String(item.contentid)))
    };
  } catch (error) {
    console.error('Error in getAllTopIds:', error);
    return {
      incheon: new Set(),
      subsidy: new Set(),
      festival: new Set()
    };
  }
}

module.exports = {
  getTopIncheon,
  getTopSubsidy,
  getTopFestival,
  getAllTopIds,
  compareDates
};
