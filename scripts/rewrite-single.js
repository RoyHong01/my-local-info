// 진해군항제 포스트 단독 재작성
try { require('dotenv').config({ path: '.env.local' }); } catch (_) {}
const fs = require('fs/promises');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 4096 },
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

const originalBody = `
경상남도 창원시 진해구에서 매년 봄 열리는 진해군항제. 1952년 충무공 이순신 장군 추모행사로 시작해 지금은 36만 그루 왕벚나무와 군악의장페스티벌, 해군기지 체험까지 즐길 수 있는 전국 규모 축제입니다. 200만 명 이상이 찾는 세계 최대 벚꽃 도시.

군악의장페스티벌: 금요일 저녁과 주말에 펼쳐지는 군악대 마칭과 의장대 퍼포먼스. 벚꽃이 내리는 가운데 군악이 울려 퍼짐.

해군사관학교·해군기지 특별 개방: 축제 기간 해군사관학교와 해군진해기지사령부 특별 개방. 거북선 관람, 함정 공개, 해군복 입기, 요트크루즈 체험.

100년 근대건축물: 진해우체국, 흑백다방, 영해루. 군항마을역사관에서 1902년부터 시작된 군항 개발 역사 관람.

체험 코스:
- 벚꽃 명소: 내수면 생태공원, 여좌천, 경화역 (2~3시간)
- 역사 코스: 중원로터리 8거리, 군항마을역사관 (1.5~2시간)
- 해군 체험: 해군사관학교, 해군기지 (2~3시간)
- 전망: 제황산 모노레일·진해탑 옥상 (1시간)

꿀팁:
- 주차는 이른 아침 확보 (200만 명 방문, 주차 전쟁)
- 포토존은 오전 10~11시
- 중원로터리 주변 카페, 100년 건물 개조 카페 필수
- 전야제·팔도풍물시장은 중원로터리, 추모대제·승전행차 퍼레이드는 북원로터리

주소: 경상남도 창원시 진해구 통신동 및 중원로터리, 창원시 진해구 일원
문의: 055-546-4310
우편번호: 51678
매년 봄 개최 (벚꽃 개화 시기 맞춰 날짜 확정)
`;

const prompt = `아래 기존 블로그 글을 스타일 가이드에 맞게 완전히 재작성해줘.
카테고리: 전국 축제·여행

[기존 글 제목]
36만 그루 벚꽃이 하얀 눈처럼 내려앉는 봄, 진해군항제 완전정복

[기존 본문 내용 - 모든 실질 정보(날짜, 장소, 연락처 등) 반드시 유지]
${originalBody}

반드시 아래 형식으로만 출력해줘. 다른 텍스트 절대 추가 금지:
---
title: (새 제목. 콜론(:) 있으면 큰따옴표로 감싸기)
date: 2026-03-27
slug: "2026-03-27-post-1774652966257"
summary: (130~160자. 장소·핵심 내용 포함)
description: (summary와 동일)
category: 전국 축제·여행
tags: [진해군항제, 벚꽃축제, 진해벚꽃, 봄축제, 경남여행]
image: "https://tong.visitkorea.or.kr/cms/resource/72/4020672_image2_1.JPG"
source_id: "523079"
---

[전국 축제·여행 전용 규칙]
- 제목에 연도('2026' 등) 금지. '완전정복', '총정리' 금지.
- 소제목에 '1.', '2.', '3.' 숫자 번호 금지. 감성 소제목으로 2~4개.
- '---' 분리선은 전체 글에서 최대 1번만.

[글쓰기 스타일]
- 경어체 필수: '~해요/~거든요/~입니다/~네요'. 평어체('~이다/~한다/~이야') 절대 금지.
- AI 금지어: 결론적으로/다양한/인상적인/포착한/주목할만한/대표적인/각광받는/선사한다/즐길 수 있다/만끽할 수 있다
- 본문 첫 줄: ## 훅 소제목 (짧고 강렬하게)
- 꿀팁: 이모지 리스트 (주차/포토존/카페)
- 마무리: 작가 주관적 한 줄 소감. "함께 가면 좋은 사람" 금지.
- 본문 1500자 이상`;

(async () => {
  const text = await callGemini(prompt);
  if (!text) { console.error('응답 없음'); process.exit(1); }

  let content = text.trim();
  if (content.startsWith('```markdown')) content = content.substring(11);
  else if (content.startsWith('```')) content = content.substring(3);
  if (content.endsWith('```')) content = content.slice(0, -3);
  content = content.trim();

  content = content.replace(/^image:.*$/m, 'image: "https://tong.visitkorea.or.kr/cms/resource/72/4020672_image2_1.JPG"');
  content = content.replace(/^source_id:.*$/m, 'source_id: "523079"');
  content = content.replace(/^slug:.*$/m, 'slug: "2026-03-27-post-1774652966257"');
  content = content.replace(/^date:.*$/m, 'date: 2026-03-27');

  const filePath = path.join(process.cwd(), 'src', 'content', 'posts', '2026-03-27-post-1774652966257.md');
  await fs.writeFile(filePath, content, 'utf-8');
  console.log('완료');
})();
