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
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .split(/[\s,.!?;:()\[\]{}<>"'`~\-+=/\\|]+/)
    .filter((t) => t && t.length >= 2);
}

function searchTopK(index, query, k = 3) {
  const tokens = Array.from(new Set(tokenize(query)));
  if (!tokens.length || !Array.isArray(index)) return [];

  const scored = [];
  for (const item of index) {
    if (!item) continue;
    const searchText = [item.title, item.summary, item.body, item.category]
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
    if (score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
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
      ? topItems.map((it, i) => `${i + 1}. ${it.title}\n   ${it.summary || ""}`).join("\n\n")
      : "";

    const systemPrompt = hasData
      ? `당신은 픽앤조이(pick-n-joy.com)의 AI 도우미입니다.
반드시 한국어로만 답하세요. 2~3문장으로 간결하게 답하세요.
마크다운 기호(**, *, #, -)는 절대 사용하지 마세요. 순수 텍스트로만 답하세요.
아래 픽앤조이 데이터를 우선 참고하여 사용자 질문에 답하세요.

[픽앤조이 데이터]
${blogDataBlock}`
      : `당신은 픽앤조이(pick-n-joy.com)의 AI 도우미입니다.
반드시 한국어로만 답하세요. 2~3문장으로 간결하게 답하세요.
마크다운 기호(**, *, #, -)는 절대 사용하지 마세요. 순수 텍스트로만 답하세요.
픽앤조이 데이터에는 관련 정보가 없습니다.
일반 지식으로 답할 수 있다면 간략히 답하세요.
만약 답을 알 수 없다면 "질문에 해당하는 답을 찾을 수 없습니다."라고만 말하세요.`;

    const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      max_tokens: 150,
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
    return new Response(
      JSON.stringify({
        error: "failed to generate answer",
        detail: error instanceof Error ? error.message : "unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}
