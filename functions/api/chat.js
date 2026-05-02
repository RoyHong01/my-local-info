/**
 * Cloudflare Pages Function: POST /api/chat
 * RAG: /data/search-index.json에서 키워드 매칭으로 상위 3개 항목을 추려
 *      시스템 프롬프트에 주입한 뒤 Workers AI로 답변 생성.
 */

function stripMarkdown(input) {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  s = s.replace(/^\s{0,3}[-*+]\s+/gm, "");
  s = s.replace(/^\s{0,3}\d+\.\s+/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  s = s.replace(/~~([^~]+)~~/g, "$1");
  s = s.replace(/[#*_>`~]+/g, " ");

  // 문단 구분을 유지하기 위해 줄 단위 공백만 정리하고, 줄바꿈은 보존합니다.
  s = s
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .split(/[\s,.!?;:()\[\]{}<>"'`~\-+=/\\|]+/)
    .filter((t) => t && t.length >= 2);
}

function normalizeKoreanToken(token) {
  if (!token) return "";
  // 조사/어미를 단순 제거해 "보조금이" 같은 형태도 핵심어로 매칭되게 합니다.
  return String(token)
    .toLowerCase()
    .replace(/(으로|에서|에게|까지|부터|처럼|보다|마다|라도|이나|나|도|만|의|에|와|과|은|는|이|가|을|를|로|랑|께|한테|인데|이며|이고)$/u, "")
    .trim();
}

function buildQueryTokens(query) {
  const rawTokens = tokenize(query);
  const tokenSet = new Set();
  for (const tok of rawTokens) {
    tokenSet.add(tok);
    const normalized = normalizeKoreanToken(tok);
    if (normalized && normalized.length >= 2) {
      tokenSet.add(normalized);
    }
  }
  return Array.from(tokenSet);
}

function detectPreferredCategories(query) {
  const q = String(query || "").toLowerCase();
  const hasSubsidyIntent = /(보조금|복지|지원금|지원사업|정부지원|혜택)/.test(q);
  const hasFestivalIntent = /(축제|행사|여행|가볼만|공연|전시)/.test(q);
  const hasIncheonIntent = /(인천|부평|송도|미추홀|계양|연수|남동|중구|동구|서구|강화|옹진)/.test(q);

  // 의도 충돌 시 단일 카테고리를 우선 선택해 URL/내용 불일치를 줄입니다.
  if (hasSubsidyIntent) return ["전국 보조금·복지"];
  if (hasFestivalIntent) return ["전국 축제·여행"];
  if (hasIncheonIntent) return ["인천시 정보"];
  return [];
}

function searchTopK(index, query, k = 3) {
  const tokens = buildQueryTokens(query);
  const preferredCategories = detectPreferredCategories(query);
  if (!tokens.length || !Array.isArray(index)) return [];

  const scored = [];
  for (const item of index) {
    if (!item) continue;
    const tagsText = Array.isArray(item.tags) ? item.tags.join(" ") : "";
    const searchText = [item.title, item.summary, item.body, item.category, tagsText]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!searchText) continue;

    let score = 0;
    for (const tok of tokens) {
      if (!tok) continue;
      if (item.title && item.title.toLowerCase().includes(tok)) score += 3;
      if (searchText.includes(tok)) score += 1;
    }

    if (preferredCategories.length && preferredCategories.includes(item.category)) {
      score += 8;
    }

    if (score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);

  if (preferredCategories.length) {
    const preferredOnly = scored.filter((s) => preferredCategories.includes(s.item.category));
    if (preferredOnly.length) {
      return preferredOnly.slice(0, k).map((s) => s.item);
    }
  }

  return scored.slice(0, k).map((s) => s.item);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const userMessage = typeof body?.message === "string" ? body.message.trim() : "";

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    let topItems = [];
    try {
      const indexUrl = new URL(request.url).origin + "/data/search-index.json";
      const indexRes = await fetch(indexUrl);
      if (indexRes.ok) {
        const index = await indexRes.json();
        topItems = searchTopK(index, userMessage, 3);
      }
    } catch (_) {}

    const hasData = topItems.length > 0;
    const blogDataBlock = hasData
      ? topItems.map((it, i) => {
          const ourUrl = `https://pick-n-joy.com${it.href || ''}`;
          const urlLine = it.sourceUrl
            ? `   픽앤조이 페이지: ${ourUrl}\n   공식 정보: ${it.sourceUrl}`
            : `   픽앤조이 페이지: ${ourUrl}`;
          return `${i + 1}. [${it.category}] ${it.title}\n   ${it.summary || ""}\n${urlLine}`;
        }).join("\n\n")
      : "";

    const systemPrompt = hasData
      ? `당신은 픽앤조이(pick-n-joy.com)의 AI 도우미입니다.
    반드시 한국어로만 답하세요. 3~5문장으로 핵심 정보를 전달하세요.
    마크다운 기호(**, *, #, -)는 절대 사용하지 마세요. 순수 텍스트로만 답하세요.
    아래 픽앤조이 데이터를 우선 참고하여 사용자 질문에 답하세요.
    아래 데이터에 없는 사실은 추측해서 쓰지 마세요. 데이터가 부족하면 "해당 조건에 맞는 정보를 찾지 못했습니다."라고 답하세요.
    여러 항목을 안내할 때는 "항목별로 문단을 분리"하고, 각 문단 마지막 줄에 "URL: https://..." 형태로 관련 주소를 1개씩 붙이세요.
    문단과 문단 사이에는 반드시 빈 줄 1줄을 넣으세요.

[픽앤조이 데이터]
${blogDataBlock}`
      : `당신은 픽앤조이(pick-n-joy.com)의 AI 도우미입니다.
반드시 한국어로만 답하세요. 2~3문장으로 간결하게 답하세요.
마크다운 기호(**, *, #, -)는 절대 사용하지 마세요. 순수 텍스트로만 답하세요.
픽앤조이 데이터에는 관련 정보가 없습니다.
일반 지식으로 답할 수 있다면 간략히 답하세요.
만약 답을 알 수 없다면 "질문에 해당하는 답을 찾을 수 없습니다."라고만 말하세요.`;

    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      max_tokens: 400,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const rawAnswer =
      result?.response ||
      result?.result?.response ||
      result?.output_text ||
      "죄송해요. 답변을 생성하지 못했어요.";

    const answer = stripMarkdown(rawAnswer);

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message.toLowerCase() : "";
    const isRateLimit = errMsg.includes("rate limit") || errMsg.includes("quota") || errMsg.includes("exceeded") || errMsg.includes("too many");
    const answer = isRateLimit
      ? "현재 AI 응답 한도에 도달했습니다. 잠시 후 다시 질문해 주세요."
      : "죄송합니다. AI 서비스에 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    return new Response(
      JSON.stringify({ answer }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}
